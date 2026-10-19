import { z } from "zod";

const identifier = z.string().regex(/^[a-zA-Z0-9_-]{1,160}$/);
const timestamp = z.iso.datetime({ offset: true });

export { evidenceSchema, publicLinkSchema } from "./schema-links.js";

import { discoveryProvenanceSchema } from "./provenance.js";
import { evidenceSchema, publicLinkSchema } from "./schema-links.js";
export const evidenceValueSchema = z.strictObject({
  value: z.string().trim().min(1).max(2000),
  evidence: evidenceSchema,
});
export const decisiveEvidenceSchema = z.discriminatedUnion("status", [
  z.strictObject({ status: z.literal("unknown") }),
  z.strictObject({
    status: z.literal("confirmed"),
    value: z.boolean(),
    evidence: evidenceSchema,
  }),
]);
const applicationUrl = z
  .string()
  .max(8192)
  .refine((value) => {
    if (publicLinkSchema.safeParse(value).success) return true;
    return /^mailto:[^\s@,;?]+@[^\s@,;?]+\.[^\s@,;?]+$/.test(value);
  });
export const observationSchema = z
  .strictObject({
    sourceId: identifier,
    sourceRecordId: z.string().trim().min(1).max(8192),
    sourcePolicyRef: z.string().trim().min(1).max(1000),
    discoveryProvenance: discoveryProvenanceSchema.optional(),
    observedAt: timestamp,
    kind: z.enum([
      "search_lead",
      "career_lead",
      "vacancy_detail",
      "unavailable",
    ]),
    originalUrl: publicLinkSchema,
    finalUrl: publicLinkSchema.optional(),
    title: evidenceValueSchema.nullable(),
    employer: evidenceValueSchema.nullable(),
    location: evidenceValueSchema.nullable(),
    employmentType: evidenceValueSchema.nullable(),
    englishAccepted: decisiveEvidenceSchema,
    remoteFromGermany: decisiveEvidenceSchema,
    applicationLinks: z
      .array(z.strictObject({ url: applicationUrl, evidence: evidenceSchema }))
      .max(100),
    publishedAt: timestamp.nullable(),
    expiresAt: timestamp.nullable(),
    retentionUntil: timestamp,
  })
  .superRefine((value, context) => {
    if (
      Date.parse(value.retentionUntil) <= Date.parse(value.observedAt) ||
      Date.parse(value.retentionUntil) - Date.parse(value.observedAt) >
        7 * 86400000
    )
      context.addIssue({
        code: "custom",
        path: ["retentionUntil"],
        message: "Retention must end within seven days after observation",
      });
    if (value.discoveryProvenance) {
      const start =
        value.discoveryProvenance.kind === "search_result" ||
        value.discoveryProvenance.kind === "brave_search_result"
          ? value.discoveryProvenance.capturedAt
          : value.discoveryProvenance.kind === "operator_seed"
            ? value.discoveryProvenance.observedAt
            : value.discoveryProvenance.parentObservedAt;
      if (Date.parse(value.observedAt) < Date.parse(start))
        context.addIssue({
          code: "custom",
          path: ["discoveryProvenance"],
          message: "Discovery evidence cannot come from the future",
        });
    }
    if (
      value.discoveryProvenance &&
      Date.parse(value.retentionUntil) >
        Date.parse(value.discoveryProvenance.retentionUntil)
    )
      context.addIssue({
        code: "custom",
        path: ["retentionUntil"],
        message: "Observation cannot outlive discovery evidence",
      });
    if (value.kind === "vacancy_detail" && (!value.title || !value.employer))
      context.addIssue({
        code: "custom",
        path: ["kind"],
        message: "Vacancy details need evidenced title and employer",
      });
  });
export const discoveryJobSchema = z.strictObject({
  jobId: z.string().regex(/^job_[a-f0-9]{32}$/),
  sourceId: identifier,
  sourceRecordId: z.string().trim().min(1).max(8192),
  currentRevisionId: z.string().regex(/^rev_[a-f0-9]{64}$/),
  firstSeenAt: timestamp,
  lastSeenAt: timestamp,
  lastCheckedAt: timestamp,
  observation: observationSchema,
  possibleDuplicateIds: z
    .array(z.string().regex(/^job_[a-f0-9]{32}$/))
    .max(1000),
  fitScore: z.null(),
});
export type EvidenceValue = z.infer<typeof evidenceValueSchema>;
export type NormalizedObservation = z.infer<typeof observationSchema>;
export type DiscoveryJob = z.infer<typeof discoveryJobSchema>;
