import assert from "node:assert/strict";
import test from "node:test";
import {
  scoreSyntheticProfileBenchmark,
  syntheticProfileBenchmark,
  validateHumanBenchmarkReceipt,
} from "../src/profile-benchmark.js";
import { approvedFixture, fixtureNow } from "./profile-fixtures.js";

test("the original 50 source-template labels remain separate from conservative v2 regression behavior", async () => {
  const cases = syntheticProfileBenchmark(approvedFixture(), fixtureNow);
  const result = await scoreSyntheticProfileBenchmark(cases, fixtureNow);
  assert.equal(cases.length, 50);
  assert.equal(new Set(cases.map((sample) => sample.id)).size, 50);
  assert.deepEqual(result.strata.sort(), [
    "authorization",
    "duplicate",
    "employment",
    "expiry",
    "germany_remote",
    "hours",
    "language",
    "malicious_content",
    "missing_profile",
    "supported",
  ]);
  // Preserve the original labels. They predate complete language/remaining-condition evidence.
  assert.ok(result.exactOracleMatches < 50);
  assert.ok(result.cases.every((sample) => sample.actual !== "eligible"));
  assert.ok(
    result.cases
      .filter((sample) => sample.actual === "blocked")
      .every((sample) => sample.expected === "blocked"),
  );
  assert.equal(result.eligibleShortlistPrecision, null);
  assert.equal(result.processingSuccess, 1);
  assert.equal(result.humanReview, "pending");
  assert.equal(result.releaseAcceptance, "not_established");
  assert.throws(() =>
    validateHumanBenchmarkReceipt(
      {
        version: 1,
        fixtureHash: result.fixtureHash,
        reviewerKind: "model",
        reviewedAt: new Date(fixtureNow).toISOString(),
        labels: [],
      },
      result,
    ),
  );
  assert.throws(
    () =>
      validateHumanBenchmarkReceipt(
        {
          version: 1,
          fixtureHash: result.fixtureHash,
          reviewerKind: "human",
          reviewedAt: new Date(fixtureNow).toISOString(),
          labels: result.cases.map((sample) => ({
            id: sample.id,
            exactContentHash: "0".repeat(64),
            eligibility: sample.expected,
          })),
        },
        result,
      ),
    /exact fixture contents/,
  );
});
