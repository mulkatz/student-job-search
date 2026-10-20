import { createHash } from "node:crypto";
import { z } from "zod";

/** Ordered one-to-one with CONCEPT.md acceptance criteria; manifest authors cannot lower scope. */
export const releaseCriterionPolicy = Object.freeze({
  c01_permitted_sources: "live",
  c02_web_discovery: "live",
  c03_source_states: "live",
  c04_daily_schedule: "live",
  c05_idempotent_runs: "local",
  c06_profile_approval: "local",
  c07_evidence_eligibility: "local",
  c08_labeled_fixture: "local",
  c09_fixture_quality: "local",
  c10_grounded_packages: "local",
  c11_review_copy_dialog: "local",
  c12_manual_only_actions: "local",
  c13_failure_recovery: "live",
  c14_manual_status: "local",
  c15_job_table: "local",
  c16_owner_isolation: "live",
  c17_data_operations: "live",
} as const);
export const releaseCriterionIdSchema = z.enum([
  "c01_permitted_sources",
  "c02_web_discovery",
  "c03_source_states",
  "c04_daily_schedule",
  "c05_idempotent_runs",
  "c06_profile_approval",
  "c07_evidence_eligibility",
  "c08_labeled_fixture",
  "c09_fixture_quality",
  "c10_grounded_packages",
  "c11_review_copy_dialog",
  "c12_manual_only_actions",
  "c13_failure_recovery",
  "c14_manual_status",
  "c15_job_table",
  "c16_owner_isolation",
  "c17_data_operations",
]);
export const releaseCriterionIds = releaseCriterionIdSchema.options;
const timestamp = z.iso.datetime({ offset: true });
const evidenceRef = z
  .string()
  .min(1)
  .max(240)
  .regex(
    /^(?:docs\/|CONCEPT\.md$|packages\/|experiments\/|apps\/|\.local\/)[A-Za-z0-9_./-]*$/,
  )
  .refine(
    (value) => !value.split("/").includes(".."),
    "Evidence references stay within the repository",
  );
export const releaseManifestSchema = z.strictObject({
  format: z.literal("job-search-v1-readiness-v1"),
  assessedAt: timestamp,
  criteria: z
    .array(
      z.strictObject({
        id: releaseCriterionIdSchema,
        state: z.enum(["verified_local", "verified_live", "unmet", "unknown"]),
        evidence: z
          .array(
            z.strictObject({
              ref: evidenceRef,
              recordedAt: timestamp,
              method: z.enum([
                "automated_test",
                "independent_agent_review",
                "human_review",
                "authorized_live_observation",
                "operator_record",
              ]),
              limitation: z.string().trim().min(1).max(1000),
            }),
          )
          .max(10),
        limitation: z.string().trim().min(1).max(1000),
      }),
    )
    .length(17)
    .refine(
      (value) => new Set(value.map((item) => item.id)).size === 17,
      "Every criterion occurs exactly once",
    ),
});
export type ReleaseManifest = z.infer<typeof releaseManifestSchema>;
export interface ReleaseBlocker {
  id: keyof typeof releaseCriterionPolicy | "manifest";
  reason:
    | "invalid_manifest"
    | "future_claim"
    | "evidence_missing"
    | "required_live_evidence"
    | "unmet"
    | "unknown";
}
/** Checks declared completeness only. Evidence references and hashes do not certify authenticity or quality. */
export function evaluateReleaseReadiness(
  input: unknown,
  now = Date.now(),
): { ready: boolean; manifestHash: string; blockers: ReleaseBlocker[] } {
  let serialized: string;
  try {
    serialized = JSON.stringify(input) ?? "undefined";
  } catch {
    serialized = "unserializable";
  }
  const manifestHash = createHash("sha256").update(serialized).digest("hex");
  const result = releaseManifestSchema.safeParse(input);
  if (!result.success)
    return {
      ready: false,
      manifestHash,
      blockers: [{ id: "manifest", reason: "invalid_manifest" }],
    };
  const manifest = result.data;
  const blockers: ReleaseBlocker[] = [];
  if (Date.parse(manifest.assessedAt) > now)
    blockers.push({ id: "manifest", reason: "future_claim" });
  for (const criterion of manifest.criteria) {
    if (
      criterion.evidence.some(
        (evidence) =>
          Date.parse(evidence.recordedAt) > Date.parse(manifest.assessedAt) ||
          Date.parse(evidence.recordedAt) > now,
      )
    )
      blockers.push({ id: criterion.id, reason: "future_claim" });
    if (criterion.state === "unmet" || criterion.state === "unknown")
      blockers.push({ id: criterion.id, reason: criterion.state });
    else if (!criterion.evidence.length)
      blockers.push({ id: criterion.id, reason: "evidence_missing" });
    else if (
      (releaseCriterionPolicy[criterion.id] === "live" &&
        criterion.state !== "verified_live") ||
      (criterion.state === "verified_live" &&
        !criterion.evidence.some(
          (evidence) => evidence.method === "authorized_live_observation",
        ))
    )
      blockers.push({ id: criterion.id, reason: "required_live_evidence" });
  }
  return { ready: blockers.length === 0, manifestHash, blockers };
}
