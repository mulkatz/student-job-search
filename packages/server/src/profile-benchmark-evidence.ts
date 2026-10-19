import type { ProfileView } from "./profile-schema.js";

/** Exact reviewed synthetic evidence; the offline regression checks every binding. */
export const independentBenchmarkEvidence = {
  status: "accepted",
  reviewerKind: "independent_agent",
  synthetic: true,
  syntheticCases: 50,
  uniqueCanonicalUnits: 49,
  uniqueEligibleUnits: 20,
  fixtureHash:
    "59d0362521658a954fb8604489babe9d3880059fe36e83d8afd128cb0ce11b25",
  evaluatorVersion: "g5-deterministic-v2",
  acceptanceReceiptSha256:
    "f9f7a429944b4cb84f63b08467d6223f61cae99c9d61ee9a27cc94638cbd473a",
  eligibleShortlistPrecision: 1,
  processingSuccess: 1,
  humanReview: "not_performed",
  releaseAcceptance: "not_established",
} as const satisfies ProfileView["benchmark"];
