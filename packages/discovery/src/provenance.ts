import { z } from "zod";
import { braveAccessSchema } from "./brave-access.js";
import { evidenceSchema, publicLinkSchema } from "./schema-links.js";

const timestamp = z.iso.datetime({ offset: true });
export const discoveryProvenanceSchema = z
  .discriminatedUnion("kind", [
    z.strictObject({
      kind: z.literal("search_result"),
      snapshotId: z.string().min(1).max(160),
      queryRef: z.string().regex(/^[a-zA-Z0-9_-]{1,160}$/),
      resultRef: z.string().min(1).max(1000),
      capturedAt: timestamp,
      retentionUntil: timestamp,
      permissionRef: z.string().min(1).max(1000),
    }),
    braveAccessSchema.extend({
      kind: z.literal("brave_search_result"),
      queryRef: z.string().regex(/^[a-zA-Z0-9_-]{1,80}$/),
      resultRef: z.string().regex(/^brave_[a-f0-9]{64}$/),
      manifestHash: z.string().regex(/^[a-f0-9]{64}$/),
      attemptId: z.string().uuid(),
      capturedAt: timestamp,
      retentionUntil: timestamp,
    }),
    z.strictObject({
      kind: z.literal("operator_seed"),
      seedRef: z.string().min(1).max(160),
      sourcePolicyRef: z.string().min(1).max(1000),
      observedAt: timestamp,
      retentionUntil: timestamp,
    }),
    z.strictObject({
      kind: z.literal("parent_anchor"),
      parentSourceId: z.string().regex(/^[a-zA-Z0-9_-]{1,160}$/),
      parentSourceRecordId: z.string().min(1).max(8192),
      parentObservedAt: timestamp,
      retentionUntil: timestamp,
      evidence: evidenceSchema,
    }),
  ])
  .superRefine((value, context) => {
    const start =
      value.kind === "search_result" || value.kind === "brave_search_result"
        ? value.capturedAt
        : value.kind === "operator_seed"
          ? value.observedAt
          : value.parentObservedAt;
    if (
      value.kind === "brave_search_result" &&
      Date.parse(value.retentionUntil) > Date.parse(value.expiresAt)
    )
      context.addIssue({
        code: "custom",
        message: "Brave provenance cannot outlive operator authorization",
      });
    if (
      Date.parse(value.retentionUntil) <= Date.parse(start) ||
      Date.parse(value.retentionUntil) - Date.parse(start) > 7 * 86400000
    )
      context.addIssue({
        code: "custom",
        message: "Discovery evidence expires within seven days",
      });
  });
export type DiscoveryProvenance = z.infer<typeof discoveryProvenanceSchema>;
const pendingSchema = z
  .strictObject({
    url: publicLinkSchema,
    depth: z.number().int().min(0).max(2),
    expiresAt: timestamp,
    provenance: discoveryProvenanceSchema,
  })
  .superRefine((value, context) => {
    if (
      Date.parse(value.expiresAt) > Date.parse(value.provenance.retentionUntil)
    )
      context.addIssue({
        code: "custom",
        message: "Pending target outlives its discovery evidence",
      });
  });
export const traversalCheckpointSchema = z
  .strictObject({
    version: z.literal(1),
    expiresAt: timestamp,
    pending: z.array(pendingSchema).max(64),
    visited: z
      .array(
        z
          .strictObject({
            urlKey: z.string().regex(/^[a-f0-9]{64}$/),
            observedAt: timestamp,
            expiresAt: timestamp,
          })
          .superRefine((value, context) => {
            if (
              Date.parse(value.expiresAt) <= Date.parse(value.observedAt) ||
              Date.parse(value.expiresAt) - Date.parse(value.observedAt) >
                7 * 86400000
            )
              context.addIssue({
                code: "custom",
                message: "Visited state expires within seven days",
              });
          }),
      )
      .max(256),
    expiredTargets: z.number().int().min(0).max(1000000).optional(),
    limitsReached: z
      .array(z.enum(["depth", "links", "pending", "visited"]))
      .max(4)
      .optional(),
    rejectedLinks: z.number().int().min(0).max(1000000),
    excessLinks: z.number().int().min(0).max(1000000),
  })
  .superRefine((value, context) => {
    if (
      [...value.pending, ...value.visited].some(
        (entry) => Date.parse(entry.expiresAt) > Date.parse(value.expiresAt),
      )
    )
      context.addIssue({
        code: "custom",
        message: "Checkpoint entries cannot outlive checkpoint",
      });
  });
export type TraversalCheckpoint = z.infer<typeof traversalCheckpointSchema>;
