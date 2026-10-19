import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  discoveryJobSchema,
  jobIdentity,
  revisionIdentity,
} from "@job-search/discovery";
import { z } from "zod";
import { independentBenchmarkEvidence } from "../src/profile-benchmark-evidence.js";
import { evaluateProfileJob } from "../src/profile-matching.js";
import { contentHash } from "../src/profile-pdf.js";
import {
  currentEvaluatorVersion,
  profileVersionSchema,
  profileViewSchema,
} from "../src/profile-schema.js";

const artifacts = new URL(
  "../../../../experiments/g5/independent-benchmark-v2/",
  import.meta.url,
);
const digest = z.string().regex(/^[a-f0-9]{64}$/);
const decision = z.enum(["eligible", "blocked", "needs_review"]);
const timestamp = z.iso.datetime({ offset: true });
const fixtureSchema = z.strictObject({
  version: z.literal("2.1"),
  createdAt: timestamp,
  fixtureEvaluationTime: timestamp,
  reviewerKind: z.literal("independent_agent"),
  synthetic: z.literal(true),
  contractTypes: z.record(z.string(), z.string()),
  fixtureHash: digest,
  frozenAt: timestamp,
  supersedes: z.literal("cases.json"),
  cases: z
    .array(
      z.strictObject({
        id: z.string().regex(/^H\d{2}$/),
        stratum: z.string().min(1),
        synthetic: z.literal(true),
        rawPosting: z.strictObject({
          sourceUrl: z.url(),
          title: z.string(),
          employer: z.string(),
          text: z.string(),
          fictionalObservedAt: timestamp,
          fictionalRetentionUntil: timestamp,
          html: z.string(),
        }),
        profile: profileVersionSchema,
        job: discoveryJobSchema,
        duplicateOf: z.literal("H01").optional(),
      }),
    )
    .length(50),
});
const sha256 = (bytes: Uint8Array) =>
  createHash("sha256").update(bytes).digest("hex");
const file = (name: string) => readFile(new URL(name, artifacts));
const json = async (name: string): Promise<unknown> =>
  JSON.parse((await file(name)).toString("utf8"));

test("the exact independently reviewed synthetic holdout reproduces acceptance with production evaluation", async () => {
  const projection = z
    .object({
      files: z.record(z.string(), digest),
      originalFiles: z.record(z.string(), digest),
      canonicalJsonSha256: z.record(z.string(), digest),
      omittedAuditFiles: z.string().array(),
    })
    .parse(await json("projection-manifest.json"));
  assert.deepEqual(Object.keys(projection.files).sort(), [
    "adjudication.json",
    "cases-final.json",
    "freeze-manifest.json",
    "labels-final.json",
    "reviewer-acceptance-v1.json",
  ]);
  for (const [name, expected] of Object.entries(projection.files)) {
    assert.equal(sha256(await file(name)), expected, name);
    const value = await json(name);
    assert.equal(
      sha256(Buffer.from(JSON.stringify(value))),
      projection.canonicalJsonSha256[name],
    );
    assert.equal(
      sha256(Buffer.from(`${JSON.stringify(value, null, 2)}\n`)),
      projection.originalFiles[name],
    );
  }
  assert.equal(
    sha256(await file("reviewer-acceptance-v1.json")),
    independentBenchmarkEvidence.acceptanceReceiptSha256,
  );
  const receipt = z
    .object({
      fixtureHash: digest,
      reviewerKind: z.literal("independent_agent"),
      humanReview: z.literal(false),
      status: z.literal("exact_version_synthetic_benchmark_accepted"),
      bindings: z.record(z.string(), digest),
      evaluator: z.object({
        version: z.literal(currentEvaluatorVersion),
        sourceFile: z.literal("packages/server/src/profile-matching.ts"),
        sourceSha256: digest,
      }),
      metrics: z.object({
        rows: z.literal(50),
        canonicalJobUnits: z.literal(49),
        processed: z.literal(50),
        uniqueEligibleJobUnits: z.literal(20),
        eligibleShortlistPrecision: z.literal(1),
        processingSuccess: z.literal(1),
      }),
      thresholds: z.object({ met: z.literal(true) }),
    })
    .parse(await json("reviewer-acceptance-v1.json"));
  for (const [name, expected] of Object.entries(receipt.bindings)) {
    if (name in projection.files)
      assert.equal(projection.originalFiles[name], expected);
    else assert.ok(projection.omittedAuditFiles.includes(name));
  }
  assert.equal(
    sha256(
      await readFile(new URL("../../src/profile-matching.ts", import.meta.url)),
    ),
    receipt.evaluator.sourceSha256,
  );
  const fixtureInput = await json("cases-final.json");
  const rawCases = z
    .object({ cases: z.unknown().array() })
    .parse(fixtureInput).cases;
  const parsed = fixtureSchema.safeParse(fixtureInput);
  assert.ok(
    parsed.success,
    parsed.success ? "" : JSON.stringify(parsed.error.issues),
  );
  const fixture = parsed.data;
  // The reviewed hashes preserve original property order; schema parsing may reorder keys.
  assert.equal(fixture.fixtureHash, contentHash(rawCases));
  assert.equal(fixture.fixtureHash, receipt.fixtureHash);
  assert.equal(fixture.fixtureHash, independentBenchmarkEvidence.fixtureHash);
  const author = z
    .object({
      fixtureHash: digest,
      reviewerKind: z.literal("independent_agent"),
      humanReview: z.literal(false),
      labels: z
        .array(
          z.object({
            id: z.string(),
            eligibility: decision,
            exactContentHash: digest,
          }),
        )
        .length(50),
    })
    .parse(await json("labels-final.json"));
  const adjudication = z
    .object({
      fixtureHash: digest,
      authorLabelsReadBeforeFreeze: z.literal(false),
      implementationOutputsRead: z.literal(false),
      cases: z
        .array(
          z.object({
            id: z.string(),
            eligibility: decision,
            exactContentHash: digest,
          }),
        )
        .length(50),
    })
    .parse(await json("adjudication.json"));
  assert.equal(author.fixtureHash, fixture.fixtureHash);
  assert.equal(adjudication.fixtureHash, fixture.fixtureHash);
  assert.equal(new Set(author.labels.map((label) => label.id)).size, 50);
  assert.equal(new Set(adjudication.cases.map((label) => label.id)).size, 50);
  const now = Date.parse(fixture.fixtureEvaluationTime);
  const eligible = new Set<string>();
  let shortlisted = 0;
  let truePositives = 0;
  for (const [index, sample] of fixture.cases.entries()) {
    const expected = author.labels.find((label) => label.id === sample.id);
    const second = adjudication.cases.find((label) => label.id === sample.id);
    assert.ok(expected && second);
    const original = z
      .object({ profile: z.unknown(), job: z.unknown() })
      .parse(rawCases[index]);
    const exact = contentHash([original.profile, original.job]);
    assert.equal(expected.exactContentHash, exact);
    assert.equal(second.exactContentHash, exact);
    assert.equal(expected.eligibility, second.eligibility);
    assert.equal(sample.profile.profileHash, contentHash(sample.profile.facts));
    assert.equal(
      sample.job.jobId,
      jobIdentity(sample.job.sourceId, sample.job.sourceRecordId),
    );
    assert.equal(
      sample.job.currentRevisionId,
      revisionIdentity(sample.job.observation),
    );
    assert.equal(
      new URL(sample.rawPosting.sourceUrl).hostname,
      "independent-jobs.synthetic.example",
    );
    assert.equal(sample.profile.ownerId, "independent-synthetic-owner");
    const actual = await evaluateProfileJob(sample.profile, sample.job, now);
    assert.equal(actual.eligibility, expected.eligibility, sample.id);
    assert.equal(
      actual.evaluatorVersion,
      independentBenchmarkEvidence.evaluatorVersion,
    );
    assert.equal(actual.jobId, sample.job.jobId);
    assert.equal(actual.jobRevisionId, sample.job.currentRevisionId);
    assert.equal(actual.profileHash, sample.profile.profileHash);
    assert.equal(actual.profileVersionId, sample.profile.id);
    if (actual.eligibility === "eligible") {
      shortlisted++;
      if (expected.eligibility === "eligible") truePositives++;
      eligible.add(sample.job.jobId);
    }
  }
  assert.equal(
    new Set(fixture.cases.map((sample) => sample.job.jobId)).size,
    49,
  );
  assert.equal(shortlisted, 21);
  assert.equal(eligible.size, independentBenchmarkEvidence.uniqueEligibleUnits);
  assert.equal(
    truePositives / shortlisted,
    independentBenchmarkEvidence.eligibleShortlistPrecision,
  );
  assert.equal(
    fixture.cases.length / receipt.metrics.rows,
    independentBenchmarkEvidence.processingSuccess,
  );
  assert.deepEqual(
    profileViewSchema.shape.benchmark.parse(independentBenchmarkEvidence),
    independentBenchmarkEvidence,
  );
});
