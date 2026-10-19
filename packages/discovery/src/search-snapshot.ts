import { createHash } from "node:crypto";
import { z } from "zod";
import type { DiscoveryAdapter } from "./runner.js";
import { observationSchema, publicLinkSchema } from "./schema.js";

const timestamp = z.iso.datetime({ offset: true });
export const searchLeadSnapshotSchema = z
  .strictObject({
    snapshotId: z.string().min(1).max(160),
    capturedAt: timestamp,
    retentionUntil: timestamp,
    results: z
      .array(
        z.strictObject({
          sourceRecordId: z.string().min(1).max(8192),
          queryRef: z.string().regex(/^[a-zA-Z0-9_-]{1,160}$/),
          resultRef: z.string().min(1).max(1000),
          url: publicLinkSchema,
        }),
      )
      .min(1)
      .max(100),
  })
  .superRefine((value, context) => {
    if (
      Date.parse(value.retentionUntil) <= Date.parse(value.capturedAt) ||
      Date.parse(value.retentionUntil) - Date.parse(value.capturedAt) >
        7 * 86400000
    )
      context.addIssue({
        code: "custom",
        message: "Snapshot retention is bounded by capture time and seven days",
      });
    if (
      new Set(value.results.map((result) => result.sourceRecordId)).size !==
      value.results.length
    )
      context.addIssue({ code: "custom", message: "Duplicate source record" });
  });
export type SearchLeadSnapshot = z.infer<typeof searchLeadSnapshotSchema>;
const permissionSchema = z.discriminatedUnion("status", [
  z.strictObject({
    status: z.literal("permitted"),
    evidenceRef: z.string().min(1).max(1000),
    expiresAt: timestamp,
  }),
  z.strictObject({ status: z.enum(["unresolved", "restricted"]) }),
]);
export type SearchSnapshotPermission = z.infer<typeof permissionSchema>;
/** Trusted operator policy is separate from the untrusted, provider-neutral snapshot. */
export function createSearchLeadSnapshotAdapter(input: {
  sourceId: string;
  snapshot: SearchLeadSnapshot;
  permission: (
    result: SearchLeadSnapshot["results"][number],
    snapshot: Readonly<SearchLeadSnapshot>,
  ) => SearchSnapshotPermission;
}): DiscoveryAdapter {
  const snapshot = searchLeadSnapshotSchema.parse(input.snapshot);
  if (typeof input.permission !== "function")
    throw new Error("search_storage_permission_required");
  const version = `search-snapshot-v1-${createHash("sha256").update(JSON.stringify(snapshot)).digest("hex").slice(0, 24)}`;
  return {
    sourceId: input.sourceId,
    version,
    async step(cursor, context) {
      context.signal.throwIfAborted();
      const index = cursor === null ? 0 : Number(cursor);
      if (
        !Number.isInteger(index) ||
        index < 0 ||
        index >= snapshot.results.length ||
        (cursor !== null && String(index) !== cursor)
      )
        throw new Error("invalid_source_cursor");
      const result = snapshot.results[index];
      if (!result) throw new Error("search_result_missing");
      const permission = permissionSchema.parse(
        input.permission(structuredClone(result), structuredClone(snapshot)),
      );
      if (permission.status !== "permitted")
        throw new Error("search_storage_permission_required");
      const expires = Math.min(
        Date.parse(snapshot.retentionUntil),
        Date.parse(permission.expiresAt),
      );
      if (
        Date.parse(snapshot.capturedAt) > context.now.getTime() ||
        expires <= context.now.getTime()
      )
        throw new Error("search_snapshot_expired");
      const retentionUntil = new Date(expires).toISOString();
      const observation = observationSchema.parse({
        sourceId: input.sourceId,
        sourceRecordId: result.sourceRecordId,
        sourcePolicyRef: permission.evidenceRef,
        discoveryProvenance: {
          kind: "search_result",
          snapshotId: snapshot.snapshotId,
          queryRef: result.queryRef,
          resultRef: result.resultRef,
          capturedAt: snapshot.capturedAt,
          retentionUntil,
          permissionRef: permission.evidenceRef,
        },
        observedAt: context.now.toISOString(),
        kind: "search_lead",
        originalUrl: result.url,
        title: null,
        employer: null,
        location: null,
        employmentType: null,
        englishAccepted: { status: "unknown" },
        remoteFromGermany: { status: "unknown" },
        applicationLinks: [],
        publishedAt: null,
        expiresAt: null,
        retentionUntil,
      });
      return {
        observations: [observation],
        nextCursor:
          index + 1 < snapshot.results.length ? String(index + 1) : null,
        done: index + 1 >= snapshot.results.length,
      };
    },
  };
}
