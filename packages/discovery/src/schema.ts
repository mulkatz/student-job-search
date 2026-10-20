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
const unresolvedRequirements = [
  z.strictObject({ status: z.literal("unknown") }),
  z.strictObject({
    status: z.literal("conflicting"),
    evidence: evidenceSchema,
  }),
] as const;
export const languageRequirementSchema = z.strictObject({
  language: z.string().trim().min(1).max(80),
  minimumLevel: z
    .enum(["A1", "A2", "B1", "B2", "C1", "C2", "fluent"])
    .nullable(),
  evidence: evidenceSchema,
});
export const languageRequirementsSchema = z.discriminatedUnion("status", [
  ...unresolvedRequirements,
  z.strictObject({
    status: z.literal("complete"),
    alternatives: z
      .array(
        z
          .array(languageRequirementSchema)
          .min(1)
          .max(10)
          .refine(
            (requirements) =>
              new Set(
                requirements.map((requirement) =>
                  requirement.language.trim().toLowerCase(),
                ),
              ).size === requirements.length,
            "A language occurs once per required set",
          ),
      )
      .min(1)
      .max(5),
    evidence: evidenceSchema,
  }),
]);
export const employmentOptionsSchema = z.discriminatedUnion("status", [
  ...unresolvedRequirements,
  z.strictObject({
    status: z.literal("complete"),
    options: z
      .array(
        z.strictObject({
          employmentType: z.enum([
            "part_time",
            "working_student",
            "minijob",
            "short_term",
            "full_time",
            "freelance",
          ]),
          weeklyHours: z
            .strictObject({
              minimum: z.number().positive().max(168),
              maximum: z.number().positive().max(168),
              flexibleWithinRange: z.boolean(),
            })
            .refine(
              (hours) => hours.minimum <= hours.maximum,
              "Weekly hours range must be ordered",
            ),
          evidence: evidenceSchema,
        }),
      )
      .min(1)
      .max(10),
    evidence: evidenceSchema,
  }),
]);
const countryCode = z.string().regex(/^[A-Z]{2}$/);
export const workArrangementsSchema = z.discriminatedUnion("status", [
  ...unresolvedRequirements,
  z.strictObject({
    status: z.literal("complete"),
    arrangements: z
      .array(
        z.union([
          z.strictObject({
            mode: z.enum(["on_site", "hybrid"]),
            city: z.string().trim().min(1).max(100),
            countryCode,
            evidence: evidenceSchema,
          }),
          z.strictObject({
            mode: z.literal("remote"),
            allowedCountries: z
              .array(countryCode)
              .min(1)
              .max(30)
              .refine(
                (countries) => new Set(countries).size === countries.length,
                "Allowed countries are unique",
              ),
            evidence: evidenceSchema,
          }),
        ]),
      )
      .min(1)
      .max(10),
    evidence: evidenceSchema,
  }),
]);
export const additionalRequirementsSchema = z.discriminatedUnion("status", [
  z.strictObject({ status: z.literal("unknown") }),
  z.strictObject({
    status: z.enum(["none", "unresolved"]),
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
export const applicationAnswerKindSchema = z.enum([
  "working_languages",
  "skills",
  "employment_preferences",
  "location_preferences",
  "weekly_availability",
  "work_authorization",
  "unknown",
  "start_date",
  "consent",
  "signature",
  "declaration",
]);
const applicationSourceCommon = {
  sourceId: identifier,
  sourceRecordId: z.string().trim().min(1).max(8192),
  sourceUrl: publicLinkSchema,
  review: z.strictObject({
    method: z.enum(["synthetic_operator_fixture", "source_review"]),
    reviewedAt: timestamp,
    expiresAt: timestamp,
    payloadHash: z.string().regex(/^[a-f0-9]{64}$/),
  }),
};
export const applicationSourceSchema = z.discriminatedUnion("kind", [
  z.strictObject({
    kind: z.literal("email"),
    ...applicationSourceCommon,
    recipient: z.email().max(254),
    evidence: evidenceSchema,
  }),
  z.strictObject({
    kind: z.literal("questionnaire"),
    ...applicationSourceCommon,
    url: publicLinkSchema,
    evidence: evidenceSchema,
    fields: z
      .array(
        z.strictObject({
          internalId: z.string().regex(/^[a-zA-Z0-9_-]{1,80}$/),
          prompt: z.string().trim().min(1).max(1000),
          evidence: evidenceSchema,
          required: z.boolean(),
          answerKind: applicationAnswerKindSchema,
        }),
      )
      .min(1)
      .max(20)
      .refine(
        (fields) =>
          new Set(fields.map((field) => field.internalId)).size ===
          fields.length,
        "Question IDs must be unique",
      ),
  }),
]);
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
    languageRequirements: languageRequirementsSchema.optional(),
    employmentOptions: employmentOptionsSchema.optional(),
    workArrangements: workArrangementsSchema.optional(),
    additionalRequirements: additionalRequirementsSchema.optional(),
    remoteFromGermany: decisiveEvidenceSchema,
    weeklyHours: z
      .discriminatedUnion("status", [
        z.strictObject({ status: z.literal("unknown") }),
        z.strictObject({
          status: z.literal("confirmed"),
          minimum: z.number().positive().max(168),
          maximum: z.number().positive().max(168),
          evidence: evidenceSchema,
        }),
      ])
      .refine(
        (value) => value.status === "unknown" || value.minimum <= value.maximum,
        "Weekly hours range must be ordered",
      )
      .optional(),
    workAuthorization: z
      .discriminatedUnion("status", [
        z.strictObject({ status: z.literal("unknown") }),
        z.strictObject({
          status: z.literal("confirmed"),
          requirement: z.enum([
            "employee_work_in_germany",
            "additional_restrictions",
          ]),
          evidence: evidenceSchema,
        }),
      ])
      .optional(),
    applicationSource: applicationSourceSchema.optional(),
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
    if (value.applicationSource) {
      const source = value.applicationSource;
      const sourceUrl = value.finalUrl ?? value.originalUrl;
      const allowedEvidence = new Set([
        source.sourceUrl,
        ...(source.kind === "questionnaire" ? [source.url] : []),
      ]);
      if (
        source.sourceId !== value.sourceId ||
        source.sourceRecordId !== value.sourceRecordId ||
        source.sourceUrl !== sourceUrl ||
        Date.parse(source.review.reviewedAt) < Date.parse(value.observedAt) ||
        Date.parse(source.review.expiresAt) <=
          Date.parse(source.review.reviewedAt) ||
        Date.parse(source.review.expiresAt) >
          Date.parse(value.retentionUntil) ||
        !allowedEvidence.has(source.evidence.url) ||
        (source.kind === "questionnaire" &&
          source.fields.some(
            (field) =>
              !allowedEvidence.has(field.evidence.url) ||
              !field.evidence.quote.includes(field.prompt),
          ))
      )
        context.addIssue({
          code: "custom",
          path: ["applicationSource"],
          message:
            "Application source review must bind the exact source payload, evidence and retention",
        });
    }
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
