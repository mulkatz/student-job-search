import {
  applicationSourceSchema,
  discoveryJobSchema,
} from "@job-search/discovery/schemas";
import { z } from "zod";

export const applicationPolicy = {
  maximumApplications: 20,
  maximumVersions: 40,
  maximumAttempts: 100,
  maximumReviews: 80,
  retentionMs: 7 * 86400000,
} as const;
export const applicationRendererVersion = "g6-approved-facts-v1";
export const applicationDigestSchema = z.string().regex(/^[a-f0-9]{64}$/);
const digest = applicationDigestSchema;
const timestamp = z.iso.datetime({ offset: true });
export const applicationIdSchema = digest;
export const manualApplicationStatusSchema = z.enum([
  "not_applied",
  "applied",
  "ignored",
]);
export const applicationContentSchema = z.discriminatedUnion("kind", [
  z.strictObject({
    kind: z.literal("email"),
    subject: z.string().min(1).max(1000),
    body: z.string().min(1).max(12000),
  }),
  z.strictObject({
    kind: z.literal("questionnaire"),
    fields: z
      .array(
        z.strictObject({
          internalId: z.string().regex(/^[a-zA-Z0-9_-]{1,80}$/),
          prompt: z.string().min(1).max(1000),
          status: z.enum([
            "answered",
            "needs_input",
            "applicant_action_required",
          ]),
          answer: z.string().min(1).max(6000).nullable(),
          factIds: z.array(z.string().regex(/^[a-zA-Z0-9_-]{1,80}$/)).max(20),
        }),
      )
      .min(1)
      .max(20),
  }),
]);
export type ApplicationContent = z.infer<typeof applicationContentSchema>;
export const applicationPackageSchema = z.strictObject({
  id: digest,
  operationId: z.string().uuid(),
  origin: z.enum(["generated", "applicant_edit"]),
  basePackageId: digest.nullable(),
  jobSnapshot: discoveryJobSchema,
  contentHash: digest,
  content: applicationContentSchema,
  source: applicationSourceSchema,
  jobId: z.string().regex(/^job_[a-f0-9]{32}$/),
  jobRevisionId: z.string().regex(/^rev_[a-f0-9]{64}$/),
  jobTitle: z.string().min(1).max(2000),
  employer: z.string().min(1).max(2000),
  originalUrl: z.url(),
  profileVersionId: digest,
  profileHash: digest,
  evaluationId: digest,
  evaluatorVersion: z.string().max(160),
  sourceSpecHash: digest,
  rendererVersion: z.literal(applicationRendererVersion),
  factIds: z.array(z.string().regex(/^[a-zA-Z0-9_-]{1,80}$/)).max(20),
  createdAt: timestamp,
  expiresAt: timestamp,
});
export type ApplicationPackage = z.infer<typeof applicationPackageSchema>;
export const applicationReviewSchema = z.strictObject({
  operationId: z.string().uuid(),
  packageId: digest,
  contentHash: digest,
  reviewedAt: timestamp,
});
export const applicationAttemptSchema = z.strictObject({
  operationId: z.string().uuid(),
  kind: z.enum(["generate", "edit", "review", "status"]),
  requestHash: digest,
  packageId: digest.nullable(),
  createdAt: timestamp,
  expiresAt: timestamp,
});
export const applicationRecordSchema = z.strictObject({
  id: digest,
  jobId: z.string().regex(/^job_[a-f0-9]{32}$/),
  revision: z.number().int().nonnegative(),
  currentPackageId: digest.nullable(),
  manualStatus: manualApplicationStatusSchema,
  createdAt: timestamp,
  expiresAt: timestamp,
  attempts: z
    .array(applicationAttemptSchema)
    .max(applicationPolicy.maximumAttempts),
  packages: z
    .array(applicationPackageSchema)
    .max(applicationPolicy.maximumVersions),
  reviews: z
    .array(applicationReviewSchema)
    .max(applicationPolicy.maximumReviews),
});
export type ApplicationRecord = z.infer<typeof applicationRecordSchema>;
export const applicationReadinessSchema = z.strictObject({
  status: z.enum([
    "ready",
    "needs_review",
    "needs_input",
    "applicant_action_required",
    "stale",
    "edited_unverified",
  ]),
  reasons: z.array(z.string().max(100)).max(20),
  copyableFieldIds: z.array(z.string().max(80)).max(20),
});
export const applicationPackageViewSchema = applicationPackageSchema.extend({
  review: applicationReviewSchema.nullable(),
  readiness: applicationReadinessSchema,
});
export const applicationViewSchema = applicationRecordSchema
  .omit({ packages: true, reviews: true })
  .extend({
    packages: z
      .array(applicationPackageViewSchema)
      .max(applicationPolicy.maximumVersions),
  });
export type ApplicationView = z.infer<typeof applicationViewSchema>;
export const applicationsResponseSchema = z.strictObject({
  applications: z
    .array(applicationViewSchema)
    .max(applicationPolicy.maximumApplications),
});
export const applicationGenerateSchema = z.strictObject({
  jobId: z.string().regex(/^job_[a-f0-9]{32}$/),
  expectedJobRevisionId: z.string().regex(/^rev_[a-f0-9]{64}$/),
  expectedActiveVersionId: digest,
  expectedCurrentPackageId: digest.nullable(),
  operationId: z.string().uuid(),
});
export const applicationEditSchema = z.strictObject({
  applicationId: digest,
  basePackageId: digest,
  expectedRevision: z.number().int().nonnegative(),
  operationId: z.string().uuid(),
  content: applicationContentSchema,
});
export const applicationReviewRequestSchema = z.strictObject({
  applicationId: digest,
  packageId: digest,
  expectedContentHash: digest,
  operationId: z.string().uuid(),
  confirmReviewed: z.literal(true),
});
export const applicationStatusSchema = z.union([
  z.strictObject({
    applicationId: digest,
    expectedRevision: z.number().int().nonnegative(),
    operationId: z.string().uuid(),
    status: manualApplicationStatusSchema,
  }),
  z.strictObject({
    jobId: z.string().regex(/^job_[a-f0-9]{32}$/),
    expectedRevision: z.literal(0),
    operationId: z.string().uuid(),
    status: manualApplicationStatusSchema,
  }),
]);
export const applicationCopySchema = z.strictObject({
  applicationId: digest,
  packageId: digest,
  expectedContentHash: digest,
  fieldId: z.string().min(1).max(80),
});
