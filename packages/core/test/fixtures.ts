import { privateScopeSchema, sharedJobSchema } from "../src/index.js";

// Invented test identities, not approved profiles or production accounts.
export const syntheticScopes = {
  first: privateScopeSchema.parse({
    ownerId: "owner_synthetic_alpha",
    candidateId: "candidate_synthetic_alpha",
  }),
  second: privateScopeSchema.parse({
    ownerId: "owner_synthetic_beta",
    candidateId: "candidate_synthetic_beta",
  }),
};

export const syntheticJob = sharedJobSchema.parse({
  jobId: "job_synthetic_library",
  title: "Student library assistant",
  employer: "Synthetic Example Library",
  sourceUrl: "https://employer.example.invalid/jobs/library",
  englishAccepted: { status: "unknown" },
  remoteFromGermany: { status: "unknown" },
});
