import { z } from "zod";

const identifier = z.string().regex(/^[a-zA-Z0-9_-]{1,160}$/);
const timestamp = z.iso.datetime({ offset: true });
// Display links are checked independently from the DNS/policy fetch boundary.
export const publicLinkSchema = z
  .url()
  .max(8192)
  .refine((value) => {
    const url = new URL(value);
    const hostname = url.hostname.toLowerCase();
    return (
      ["https:", "http:"].includes(url.protocol) &&
      !url.username &&
      !url.password &&
      !url.port &&
      hostname.includes(".") &&
      !hostname.endsWith(".") &&
      !/^[\d.]+$/.test(hostname) &&
      !hostname.includes(":") &&
      !/\.(?:localhost|local|internal|home\.arpa)$/.test(hostname)
    );
  }, "Expected an unauthenticated public HTTP link");
export const evidenceSchema = z.strictObject({
  url: publicLinkSchema,
  quote: z.string().trim().min(1).max(4000),
  selector: z.string().trim().min(1).max(1000),
});
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
