import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";
import { releaseCheck } from "../src/release-check.js";
import {
  evaluateReleaseReadiness,
  type ReleaseManifest,
  releaseCriterionIds,
  releaseCriterionPolicy,
  releaseManifestSchema,
} from "../src/release-readiness.js";
import { fixtureNow } from "./profile-fixtures.js";

function complete(): ReleaseManifest {
  return {
    format: "job-search-v1-readiness-v1",
    assessedAt: new Date(fixtureNow).toISOString(),
    criteria: releaseCriterionIds.map((id) => ({
      id,
      state:
        releaseCriterionPolicy[id] === "live"
          ? "verified_live"
          : "verified_local",
      evidence: [
        {
          ref: "docs/PLAN.md",
          recordedAt: new Date(fixtureNow - 1000).toISOString(),
          method:
            releaseCriterionPolicy[id] === "live"
              ? "authorized_live_observation"
              : "automated_test",
          limitation:
            "Synthetic evaluator fixture only; this declares no actual release evidence.",
        },
      ],
      limitation: "Synthetic complete case for evaluator behavior only.",
    })),
  };
}

test("release evaluator requires all17 exact criteria and their fixed scope; synthetic completeness only exercises policy", () => {
  const manifest = complete();
  releaseManifestSchema.parse(manifest);
  const result = evaluateReleaseReadiness(manifest, fixtureNow);
  assert.equal(result.ready, true);
  assert.deepEqual(result.blockers, []);
  assert.match(result.manifestHash, /^[a-f0-9]{64}$/);
  for (const id of releaseCriterionIds.filter(
    (id) => releaseCriterionPolicy[id] === "live",
  )) {
    const changed = complete();
    const criterion = changed.criteria.find((value) => value.id === id);
    assert.ok(criterion);
    criterion.state = "verified_local";
    criterion.evidence[0] = {
      ref: "docs/PLAN.md",
      recordedAt: new Date(fixtureNow).toISOString(),
      method: "automated_test",
      limitation: "Local evidence cannot fulfill this criterion.",
    };
    const blocked = evaluateReleaseReadiness(changed, fixtureNow);
    assert.equal(blocked.ready, false);
    assert.ok(
      blocked.blockers.some(
        (value) => value.id === id && value.reason === "required_live_evidence",
      ),
    );
  }
});

test("missing, duplicate, unknown and malformed criterion entries fail closed without reflecting manifest contents", () => {
  const valid = complete();
  const invalids: unknown[] = [
    null,
    {},
    { ...valid, criteria: valid.criteria.slice(1) },
    { ...valid, criteria: [...valid.criteria.slice(1), valid.criteria[1]] },
    {
      ...valid,
      criteria: [
        { ...valid.criteria[0], id: "unknown_SENSITIVE" },
        ...valid.criteria.slice(1),
      ],
    },
    { ...valid, requiredScope: "local" },
    {
      ...valid,
      criteria: valid.criteria.map((value) => ({ ...value, scope: "local" })),
    },
  ];
  for (const input of invalids) {
    const result = evaluateReleaseReadiness(input, fixtureNow);
    assert.equal(result.ready, false);
    assert.deepEqual(result.blockers, [
      { id: "manifest", reason: "invalid_manifest" },
    ]);
    assert.ok(!JSON.stringify(result).includes("SENSITIVE"));
  }
});

test("unknown, unmet, missing evidence and future claims cannot pass or be repaired by an existing artifact path", () => {
  for (const state of ["unknown", "unmet"] as const) {
    const manifest = complete();
    const criterion = manifest.criteria[0];
    assert.ok(criterion);
    criterion.state = state;
    assert.ok(
      evaluateReleaseReadiness(manifest, fixtureNow).blockers.some(
        (blocker) => blocker.reason === state,
      ),
    );
  }
  const empty = complete();
  const criterion = empty.criteria[5];
  assert.ok(criterion);
  criterion.evidence = [];
  assert.ok(
    evaluateReleaseReadiness(empty, fixtureNow).blockers.some(
      (blocker) => blocker.reason === "evidence_missing",
    ),
  );
  for (const future of ["manifest", "evidence"]) {
    const manifest = complete();
    if (future === "manifest")
      manifest.assessedAt = new Date(fixtureNow + 1).toISOString();
    else {
      const evidence = manifest.criteria[5]?.evidence[0];
      assert.ok(evidence);
      evidence.recordedAt = new Date(fixtureNow + 1).toISOString();
    }
    assert.ok(
      evaluateReleaseReadiness(manifest, fixtureNow).blockers.some(
        (blocker) => blocker.reason === "future_claim",
      ),
    );
  }
  const fakeLive = complete();
  const local = fakeLive.criteria[5];
  assert.ok(local);
  local.state = "verified_live";
  assert.ok(
    evaluateReleaseReadiness(fakeLive, fixtureNow).blockers.some(
      (blocker) => blocker.reason === "required_live_evidence",
    ),
  );
});

test("release command checks bounded valid JSON, reports exact artifact hash, and current manifest remains blocked", async () => {
  const directory = await mkdtemp(join(tmpdir(), "job-search-release-"));
  try {
    const file = pathToFileURL(join(directory, "readiness.json"));
    const bytes = JSON.stringify(complete());
    await writeFile(file, bytes);
    const evaluated = await releaseCheck(file, fixtureNow);
    assert.equal(evaluated.ready, true);
    assert.equal(
      evaluated.manifestHash,
      createHash("sha256").update(bytes).digest("hex"),
    );
    await writeFile(file, "SENSITIVE_INVALID_JSON");
    const malformed = await releaseCheck(file, fixtureNow);
    assert.equal(malformed.ready, false);
    assert.ok(!JSON.stringify(malformed).includes("SENSITIVE"));
    await writeFile(file, "x".repeat(128 * 1024 + 1));
    assert.equal((await releaseCheck(file, fixtureNow)).ready, false);
    assert.equal(
      (
        await releaseCheck(
          pathToFileURL(join(directory, "missing.json")),
          fixtureNow,
        )
      ).ready,
      false,
    );
    const actual = new URL(
      "../../../../docs/V1_READINESS.json",
      import.meta.url,
    );
    const raw: unknown = JSON.parse(await readFile(actual, "utf8"));
    releaseManifestSchema.parse(raw);
    const current = evaluateReleaseReadiness(raw);
    assert.equal(current.ready, false);
    assert.deepEqual(
      current.blockers.map((blocker) => blocker.id),
      [
        "c01_permitted_sources",
        "c02_web_discovery",
        "c03_source_states",
        "c04_daily_schedule",
        "c13_failure_recovery",
        "c16_owner_isolation",
        "c17_data_operations",
      ],
    );
    assert.equal((await releaseCheck(actual)).ready, false);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
