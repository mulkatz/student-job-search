import { emptyState, ingestObservation } from "./model.js";
import type { DiscoveryJob, NormalizedObservation } from "./schema.js";

export function syntheticObservation(
  overrides: Partial<NormalizedObservation> = {},
): NormalizedObservation {
  const url = "https://careers.synthetic.example/jobs/student-analytics";
  const fact = (value: string, selector: string) => ({
    value,
    evidence: { url, quote: value, selector },
  });
  return {
    sourceId: "synthetic-public-pages",
    sourceRecordId: "student-analytics",
    sourcePolicyRef: "synthetic-fixture-only",
    observedAt: "2026-10-19T10:00:00.000Z",
    kind: "vacancy_detail",
    originalUrl: url,
    finalUrl: url,
    title: fact("Working Student — Analytics", "JobPosting.title"),
    employer: fact(
      "Synthetic Example Labs",
      "JobPosting.hiringOrganization.name",
    ),
    location: fact("Berlin, Germany", "JobPosting.jobLocation.address"),
    employmentType: fact("PART_TIME", "JobPosting.employmentType"),
    englishAccepted: { status: "unknown" },
    remoteFromGermany: { status: "unknown" },
    applicationLinks: [
      {
        url: `${url}/apply`,
        evidence: { url, quote: "Apply", selector: "a.apply" },
      },
    ],
    publishedAt: null,
    expiresAt: null,
    retentionUntil: "2026-10-26T10:00:00.000Z",
    ...overrides,
  };
}
export function syntheticDiscoveryJob(): DiscoveryJob {
  return ingestObservation(emptyState(), syntheticObservation()).job;
}
