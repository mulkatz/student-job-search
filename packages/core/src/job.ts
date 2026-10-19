import { z } from "zod";

// A syntactically valid source URL is not a permission or safe-fetch decision.
export const booleanEvidenceSchema = z.discriminatedUnion("status", [
  z.strictObject({ status: z.literal("unknown") }),
  z.strictObject({
    status: z.literal("confirmed"),
    value: z.boolean(),
    sourceUrl: z.url(),
  }),
]);

// Shared source facts deliberately exclude private candidate assessments.
export const sharedJobSchema = z.strictObject({
  jobId: z.string().regex(/^job_[a-z0-9_]{1,64}$/),
  title: z.string().trim().min(1).max(300),
  employer: z.string().trim().min(1).max(300),
  sourceUrl: z.url(),
  englishAccepted: booleanEvidenceSchema,
  remoteFromGermany: booleanEvidenceSchema,
});

export type SharedJob = z.infer<typeof sharedJobSchema>;
