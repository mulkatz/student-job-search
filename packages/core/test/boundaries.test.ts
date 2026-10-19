import assert from "node:assert/strict";
import test from "node:test";
import {
  assertSamePrivateScope,
  booleanEvidenceSchema,
  candidateIdSchema,
  ownerIdSchema,
  parseOfflineConfig,
  privateScopeSchema,
  sharedJobSchema,
} from "../src/index.js";
import { syntheticJob, syntheticScopes } from "./fixtures.js";

void test("offline configuration is explicit and rejects live or malformed inputs", () => {
  assert.deepEqual(parseOfflineConfig({ mode: "offline", logLevel: "info" }), {
    mode: "offline",
    logLevel: "info",
  });
  for (const input of [
    undefined,
    null,
    [],
    {},
    { mode: "live", logLevel: "info" },
    { mode: "offline", logLevel: 1 },
    { mode: "offline", logLevel: "verbose" },
    { mode: "offline", logLevel: "info", providerKey: "synthetic-placeholder" },
  ]) {
    assert.throws(() => parseOfflineConfig(input));
  }
});

void test("owner and candidate identities validate independently without coercion", () => {
  assert.equal(ownerIdSchema.safeParse("owner_synthetic_alpha").success, true);
  assert.equal(
    candidateIdSchema.safeParse("candidate_synthetic_alpha").success,
    true,
  );
  assert.equal(
    ownerIdSchema.safeParse("candidate_synthetic_alpha").success,
    false,
  );
  assert.equal(
    candidateIdSchema.safeParse("owner_synthetic_alpha").success,
    false,
  );
  for (const input of ["", " owner_example", "owner_../example", 12, null]) {
    assert.equal(ownerIdSchema.safeParse(input).success, false);
  }
  for (const input of [null, {}, { ownerId: syntheticScopes.first.ownerId }]) {
    assert.equal(privateScopeSchema.safeParse(input).success, false);
  }
});

void test("private records require both matching owner and candidate scopes", () => {
  assert.deepEqual(
    assertSamePrivateScope(syntheticScopes.first, syntheticScopes.first),
    syntheticScopes.first,
  );
  const mismatches = [
    syntheticScopes.second,
    { ...syntheticScopes.first, ownerId: syntheticScopes.second.ownerId },
    {
      ...syntheticScopes.first,
      candidateId: syntheticScopes.second.candidateId,
    },
  ];
  for (const scope of mismatches) {
    assert.throws(() => assertSamePrivateScope(syntheticScopes.first, scope));
  }
  for (const scope of [
    undefined,
    {},
    { ownerId: syntheticScopes.first.ownerId },
  ]) {
    assert.throws(() => assertSamePrivateScope(syntheticScopes.first, scope));
    assert.throws(() => assertSamePrivateScope(scope, syntheticScopes.first));
  }
});

void test("missing evidence stays distinct from supported and incompatible evidence", () => {
  assert.deepEqual(syntheticJob.englishAccepted, { status: "unknown" });
  assert.deepEqual(syntheticJob.remoteFromGermany, { status: "unknown" });
  for (const value of [true, false]) {
    assert.equal(
      booleanEvidenceSchema.safeParse({
        status: "confirmed",
        value,
        sourceUrl: syntheticJob.sourceUrl,
      }).success,
      true,
    );
  }
  for (const input of [
    false,
    { status: "unknown", value: false },
    { status: "confirmed", value: true },
    { status: "confirmed", value: "true", sourceUrl: syntheticJob.sourceUrl },
    { status: "confirmed", value: true, sourceUrl: "invalid" },
  ]) {
    assert.equal(booleanEvidenceSchema.safeParse(input).success, false);
  }
});

void test("shared jobs reject candidate ownership, annotations, and malformed source data", () => {
  assert.equal(sharedJobSchema.safeParse(syntheticJob).success, true);
  for (const extra of [
    { ownerId: syntheticScopes.first.ownerId },
    { candidateId: syntheticScopes.first.candidateId },
    { notes: "Synthetic private note" },
    { fitScore: 90 },
    { credentials: "synthetic-placeholder" },
  ]) {
    assert.equal(
      sharedJobSchema.safeParse({ ...syntheticJob, ...extra }).success,
      false,
    );
  }
  for (const change of [
    { title: "  " },
    { sourceUrl: "invalid" },
    { englishAccepted: undefined },
    { remoteFromGermany: null },
  ]) {
    assert.equal(
      sharedJobSchema.safeParse({ ...syntheticJob, ...change }).success,
      false,
    );
  }
});
