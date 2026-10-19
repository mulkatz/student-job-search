import { z } from "zod";

export const profilePolicy = {
  maximumPdfBytes: 2 * 1024 * 1024,
  maximumPages: 10,
  maximumText: 100_000,
  maximumAssets: 3,
  maximumVersions: 5,
  maximumEvaluations: 100,
  rawRetentionMs: 7 * 86_400_000,
  profileRetentionMs: 90 * 86_400_000,
  maximumDocumentBytes: 700 * 1024,
} as const;
const timestamp = z.iso.datetime({ offset: true });
const digest = z.string().regex(/^[a-f0-9]{64}$/);
export const factCategorySchema = z.enum([
  "working_language",
  "skill",
  "employment_preference",
  "location_preference",
  "weekly_availability_hours",
  "work_authorization",
  "other",
]);
export const factIdSchema = z.string().regex(/^[a-zA-Z0-9_-]{1,80}$/);
const sourceQuoteSchema = z.strictObject({
  page: z.number().int().min(1).max(10),
  quote: z.string().min(1).max(1000),
});
export const profileFactSchema = z.strictObject({
  id: factIdSchema,
  category: factCategorySchema,
  value: z.string().trim().min(1).max(300),
  provenance: z.discriminatedUnion("kind", [
    sourceQuoteSchema.extend({ kind: z.literal("pdf_quote") }),
    z.strictObject({
      kind: z.literal("user_attestation"),
      statement: z.string().trim().min(1).max(1000),
      priorSource: sourceQuoteSchema.optional(),
    }),
  ]),
});
export type ProfileFact = z.infer<typeof profileFactSchema>;
export const profileEditSchema = z.strictObject({
  draftId: z.string().uuid(),
  expectedRevision: z.number().int().min(0),
  facts: z
    .array(
      z.strictObject({
        id: factIdSchema,
        category: factCategorySchema,
        value: z.string().trim().min(1).max(300),
        attestation: z.string().trim().min(1).max(1000).optional(),
      }),
    )
    .min(1)
    .max(20),
});
export const profileApprovalSchema = z.strictObject({
  draftId: z.string().uuid(),
  expectedRevision: z.number().int().min(0),
  expectedActiveVersionId: digest.nullable(),
  operationId: z.string().uuid(),
  confirmFacts: z.literal(true),
});
export const profileAssetSchema = z.strictObject({
  id: z.string().uuid(),
  hash: digest,
  bytes: z.number().int().min(1).max(profilePolicy.maximumPdfBytes),
  status: z.enum(["pending", "ready", "failed", "uncertain"]),
  expiresAt: timestamp,
  pendingUntil: timestamp,
});
export const profileDraftSchema = z.strictObject({
  id: z.string().uuid(),
  assetId: z.string().uuid(),
  revision: z.number().int().min(0),
  outcome: z.enum([
    "text_extracted",
    "needs_review",
    "parse_failed",
    "encrypted",
    "limits_exceeded",
    "synthetic_only",
  ]),
  pages: z
    .array(
      z.strictObject({
        page: z.number().int().min(1).max(10),
        text: z.string().max(profilePolicy.maximumText),
      }),
    )
    .max(10),
  facts: z.array(profileFactSchema).max(20),
  createdAt: timestamp,
  expiresAt: timestamp,
});
export type ProfileDraft = z.infer<typeof profileDraftSchema>;
export const profileVersionSchema = z.strictObject({
  id: digest,
  ownerId: z.string().regex(/^[A-Za-z0-9_-]{1,128}$/),
  draftId: z.string().uuid(),
  draftRevision: z.number().int().min(0),
  facts: z.array(profileFactSchema).min(1).max(20),
  profileHash: digest,
  sourceAssetHash: digest,
  approvedAt: timestamp,
  expiresAt: timestamp,
  operationId: z.string().uuid(),
  approvalRequestHash: digest,
});
export type ProfileVersion = z.infer<typeof profileVersionSchema>;
export const evaluationReasonSchema = z.strictObject({
  code: z.enum([
    "not_a_vacancy",
    "expired_posting",
    "freshness_unknown",
    "language_unknown",
    "language_incompatible",
    "profile_language_unknown",
    "location_unknown",
    "location_incompatible",
    "germany_remote_unknown",
    "germany_remote_incompatible",
    "employment_unknown",
    "employment_incompatible",
    "profile_preferences_unknown",
    "hours_unknown",
    "hours_incompatible",
    "hours_range_unknown",
    "profile_availability_unknown",
    "authorization_unknown",
    "authorization_incompatible",
    "profile_authorization_unknown",
    "additional_authorization_restrictions",
    "supported_conditions",
    "title_skill_overlap",
    "no_title_skill_overlap",
  ]),
  outcome: z.enum(["blocked", "unknown", "supported", "informational"]),
  jobField: z.enum([
    "kind",
    "expiresAt",
    "englishAccepted",
    "remoteFromGermany",
    "location",
    "employmentType",
    "weeklyHours",
    "workAuthorization",
    "title",
  ]),
  quote: z.string().max(4000).nullable(),
  factIds: z.array(factIdSchema).max(20),
});
export const privateEvaluationSchema = z.strictObject({
  id: digest,
  ownerId: z.string().regex(/^[A-Za-z0-9_-]{1,128}$/),
  jobId: z.string().regex(/^job_[a-f0-9]{32}$/),
  jobRevisionId: z.string().regex(/^rev_[a-f0-9]{64}$/),
  profileVersionId: digest,
  profileHash: digest,
  evaluatorVersion: z.literal("g5-deterministic-v1"),
  assessment: z
    .strictObject({
      version: z.string().regex(/^[a-zA-Z0-9_-]{1,80}$/),
      promptVersion: z.string().regex(/^[a-zA-Z0-9_-]{1,80}$/),
      modelVersion: z.string().regex(/^[a-zA-Z0-9_.-]{1,160}$/),
    })
    .optional(),
  eligibility: z.enum(["blocked", "needs_review", "eligible"]),
  fitScore: z.number().int().min(0).max(100).nullable(),
  evidenceConfidence: z.number().min(0).max(1),
  reasons: z.array(evaluationReasonSchema).min(1).max(20),
  evaluatedAt: timestamp,
  expiresAt: timestamp,
});
export type PrivateEvaluation = z.infer<typeof privateEvaluationSchema>;
export const profileStateSchema = z.strictObject({
  ownerId: z.string().regex(/^[A-Za-z0-9_-]{1,128}$/),
  generation: z.string().uuid(),
  lifecycle: z.enum(["active", "deleting", "deleted"]),
  revision: z.number().int().min(0),
  activeVersionId: digest.nullable(),
  assets: z.array(profileAssetSchema).max(profilePolicy.maximumAssets),
  cleanupObjects: z
    .array(
      z.strictObject({
        id: z.string().uuid(),
        status: z.enum(["pending", "uncertain", "settled"]),
      }),
    )
    .max(profilePolicy.maximumAssets),
  drafts: z.array(profileDraftSchema).max(profilePolicy.maximumAssets),
  versions: z.array(profileVersionSchema).max(profilePolicy.maximumVersions),
  evaluations: z
    .array(privateEvaluationSchema)
    .max(profilePolicy.maximumEvaluations),
  createdAt: timestamp,
  updatedAt: timestamp,
  nextCleanupAt: timestamp.nullable(),
});
export type ProfileState = z.infer<typeof profileStateSchema>;
export const profileViewSchema = z.strictObject({
  lifecycle: z.enum(["empty", "active", "deleting", "deleted"]),
  revision: z.number().int().min(0),
  activeVersionId: digest.nullable(),
  pendingCleanup: z.number().int().min(0).max(3),
  drafts: z.array(profileDraftSchema).max(3),
  versions: z.array(profileVersionSchema).max(5),
  evaluations: z
    .array(privateEvaluationSchema.extend({ stale: z.boolean() }))
    .max(100),
  benchmark: z.strictObject({
    syntheticCases: z.literal(50),
    humanReview: z.literal("pending"),
    releaseAcceptance: z.literal("not_established"),
  }),
});
export type ProfileView = z.infer<typeof profileViewSchema>;
export const assessmentSuggestionSchema = z.strictObject({
  fitScore: z.number().int().min(0).max(100),
  evidenceConfidence: z.number().min(0).max(1),
  reasons: z
    .array(z.enum(["title_skill_overlap", "no_title_skill_overlap"]))
    .max(2),
});
