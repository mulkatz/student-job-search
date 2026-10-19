import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import type { Request } from "../src/schema.js";
import { ExperimentStore } from "../src/store.js";

const manifest = {
  version: 1,
  queries: Array.from({ length: 20 }, (_, index) => ({
    id: `q${index}`,
    stream: index < 10 ? "berlin" : "germany_remote",
    query: `Synthetic accounting query ${index}`,
  })),
};
const now = new Date("2026-10-19T08:00:00.000Z");
const receipt = {
  inputTokens: 100,
  candidateTokens: 200,
  thoughtTokens: 400,
  evidenceRef: ".local/g3/synthetic/usage.json",
};
const modelRequest = (id: string): Request => ({
  id,
  branch: "model",
  kind: "llm",
  upperCostMicroEuro: 100,
  upperInputTokens: 10_000,
  upperOutputTokens: 65_536,
  upperRecords: 0,
});
const httpRequest = (id: string): Request => ({
  id,
  branch: "extraction",
  kind: "http",
  upperCostMicroEuro: 0,
  upperInputTokens: 0,
  upperOutputTokens: 0,
  upperRecords: 1,
});
function setup() {
  const root = mkdtempSync(join(tmpdir(), "job-search-model-usage-"));
  const store = new ExperimentStore(root, manifest);
  store.initialize(
    {
      version: 1,
      allocationsMicroEuro: {
        discovery: 0,
        extraction: 0,
        model: 1_000_000,
        gmail: 0,
      },
    },
    now,
  );
  return {
    root,
    store,
    cleanup: () => rmSync(root, { recursive: true, force: true }),
  };
}

test("complete settled usage releases unused full-model bounds without changing original requests or attempt counts", () => {
  const fixture = setup();
  try {
    for (let index = 0; index < 3; index++) {
      const request = modelRequest(`model_${index}`);
      fixture.store.reserve(request, now);
      assert.throws(
        () => fixture.store.reserve(modelRequest("concurrent"), now),
        /cap/,
      );
      fixture.store.beginLiveAttempt(request.id, { liveOptIn: true }, now);
      fixture.store.settle(
        request.id,
        {
          outcome: index === 1 ? "failed" : "succeeded",
          actualCostMicroEuro: 1,
          actualModelUsage: receipt,
        },
        now,
      );
      assert.deepEqual(fixture.store.read().attempts[index]?.request, request);
    }
    const status = new ExperimentStore(fixture.root, manifest).status(now);
    assert.equal(status.usage.upperOutputTokens, 3 * 65_536);
    assert.equal(status.usage.upperInputTokens, 30_000);
    assert.equal(status.usage.effectiveOutputTokens, 1_800);
    assert.equal(status.usage.effectiveInputTokens, 300);
    assert.equal(status.usage.attempts.llm, 3);
    assert.equal(status.usage.costMicroEuro.model, 3);
    assert.equal(status.tokenOverrun, false);
    assert.equal(status.observation.startedAt, null);
    assert.throws(
      () =>
        fixture.store.settle(
          "model_0",
          {
            outcome: "succeeded",
            actualCostMicroEuro: 1,
            actualModelUsage: receipt,
          },
          now,
        ),
      /terminal/,
    );
  } finally {
    fixture.cleanup();
  }
});

test("outstanding, ambiguous and legacy definitive attempts retain their complete reserved token bounds", () => {
  for (const outcome of [
    "reserved",
    "dispatched",
    "ambiguous",
    "succeeded",
    "failed",
  ] as const) {
    const fixture = setup();
    try {
      fixture.store.reserve(modelRequest("retained"), now);
      if (outcome !== "reserved")
        fixture.store.beginLiveAttempt("retained", { liveOptIn: true }, now);
      if (outcome === "ambiguous")
        fixture.store.settle("retained", { outcome }, now);
      if (outcome === "succeeded" || outcome === "failed")
        fixture.store.settle(
          "retained",
          { outcome, actualCostMicroEuro: 0 },
          now,
        );
      const restarted = new ExperimentStore(fixture.root, manifest);
      assert.equal(restarted.status(now).usage.effectiveOutputTokens, 65_536);
      assert.equal(restarted.status(now).usage.effectiveInputTokens, 10_000);
      assert.throws(
        () => restarted.reserve(modelRequest("blocked"), now),
        /cap/,
      );
    } finally {
      fixture.cleanup();
    }
  }
});

test("released headroom still enforces exact cumulative input and combined output caps", () => {
  const fixture = setup();
  try {
    fixture.store.reserve(
      {
        ...modelRequest("first"),
        upperInputTokens: 500_000,
        upperOutputTokens: 100_000,
      },
      now,
    );
    fixture.store.beginLiveAttempt("first", { liveOptIn: true }, now);
    fixture.store.settle(
      "first",
      {
        outcome: "succeeded",
        actualCostMicroEuro: 1,
        actualModelUsage: {
          ...receipt,
          inputTokens: 400_000,
          candidateTokens: 40_000,
          thoughtTokens: 20_000,
        },
      },
      now,
    );
    fixture.store.reserve(
      {
        ...modelRequest("remaining"),
        upperInputTokens: 100_000,
        upperOutputTokens: 40_000,
      },
      now,
    );
    assert.equal(fixture.store.status(now).usage.effectiveInputTokens, 500_000);
    assert.equal(
      fixture.store.status(now).usage.effectiveOutputTokens,
      100_000,
    );
    for (const [upperInputTokens, upperOutputTokens] of [
      [1, 0],
      [0, 1],
    ]) {
      assert.throws(
        () =>
          fixture.store.reserve(
            {
              ...modelRequest("overflow"),
              upperInputTokens,
              upperOutputTokens,
            },
            now,
          ),
        /cap/,
      );
    }
    assert.equal(fixture.store.status(now).usage.attempts.llm, 2);
    fixture.store.beginLiveAttempt("remaining", { liveOptIn: true }, now);
  } finally {
    fixture.cleanup();
  }
});

test("partial, malformed or nonprivate usage receipts never release reservations or change persisted state", () => {
  const fixture = setup();
  try {
    fixture.store.reserve(modelRequest("model"), now);
    fixture.store.beginLiveAttempt("model", { liveOptIn: true }, now);
    const before = readFileSync(fixture.store.statePath, "utf8");
    for (const actualModelUsage of [
      null,
      {},
      { inputTokens: 1, candidateTokens: 2, evidenceRef: receipt.evidenceRef },
      { ...receipt, inputTokens: -1 },
      { ...receipt, thoughtTokens: 0.5 },
      {
        ...receipt,
        candidateTokens: Number.MAX_SAFE_INTEGER,
        thoughtTokens: 1,
      },
      { ...receipt, evidenceRef: "https://example.invalid/usage" },
      { ...receipt, evidenceRef: ".local/../outside.json" },
      { ...receipt, evidenceRef: ".local//usage.json" },
      { ...receipt, evidenceRef: ".local/" },
      { ...receipt, extra: true },
    ]) {
      assert.throws(() =>
        fixture.store.settle(
          "model",
          { outcome: "succeeded", actualCostMicroEuro: 0, actualModelUsage },
          now,
        ),
      );
      assert.equal(readFileSync(fixture.store.statePath, "utf8"), before);
    }
    assert.throws(() =>
      fixture.store.settle(
        "model",
        { outcome: "ambiguous", actualModelUsage: receipt },
        now,
      ),
    );
    const state = fixture.store.read();
    const attempt = state.attempts[0];
    assert.ok(attempt);
    writeFileSync(
      fixture.store.statePath,
      JSON.stringify({
        ...state,
        attempts: [{ ...attempt, actualModelUsage: receipt }],
      }),
    );
    assert.throws(() => fixture.store.read()); // A stored in-flight receipt is invalid too.
    writeFileSync(fixture.store.statePath, before);
  } finally {
    fixture.cleanup();
  }
});

test("receipts require a dispatched LLM attempt and cannot accompany an undispatched cancellation", () => {
  const fixture = setup();
  try {
    fixture.store.reserve(modelRequest("cancelled"), now);
    assert.throws(() =>
      fixture.store.settle(
        "cancelled",
        {
          outcome: "failed",
          actualCostMicroEuro: 0,
          actualModelUsage: receipt,
        },
        now,
      ),
    );
    fixture.store.settle(
      "cancelled",
      { outcome: "failed", actualCostMicroEuro: 0 },
      now,
    );
    assert.equal(fixture.store.status(now).usage.effectiveOutputTokens, 65_536);
    fixture.store.reserve(httpRequest("http"), now);
    fixture.store.beginLiveAttempt("http", { liveOptIn: true }, now);
    assert.throws(() =>
      fixture.store.settle(
        "http",
        {
          outcome: "succeeded",
          actualCostMicroEuro: 0,
          actualModelUsage: receipt,
        },
        now,
      ),
    );
    assert.equal(fixture.store.read().attempts[1]?.outcome, "dispatched");
  } finally {
    fixture.cleanup();
  }
});

test("observed per-request or cumulative token overruns persist across restart and block reserve and dispatch", () => {
  for (const [requestChanges, actualModelUsage] of [
    [{ upperInputTokens: 99 }, receipt],
    [{ upperInputTokens: 500_000 }, { ...receipt, inputTokens: 500_001 }],
    [{}, { ...receipt, candidateTokens: 60_000, thoughtTokens: 40_001 }],
  ]) {
    const fixture = setup();
    try {
      const request = { ...modelRequest("overrun"), ...requestChanges };
      fixture.store.reserve(request, now);
      fixture.store.reserve(httpRequest("previously_reserved"), now);
      fixture.store.beginLiveAttempt("overrun", { liveOptIn: true }, now);
      fixture.store.settle(
        "overrun",
        { outcome: "succeeded", actualCostMicroEuro: 1, actualModelUsage },
        now,
      );
      const restarted = new ExperimentStore(fixture.root, manifest);
      assert.equal(restarted.status(now).tokenOverrun, true);
      assert.equal(restarted.status(now).budgetOverrun, false);
      assert.deepEqual(restarted.read().attempts[0]?.request, request);
      assert.deepEqual(
        restarted.read().attempts[0]?.actualModelUsage,
        actualModelUsage,
      );
      assert.throws(
        () => restarted.reserve(httpRequest("blocked"), now),
        /token overrun/,
      );
      assert.throws(
        () =>
          restarted.beginLiveAttempt(
            "previously_reserved",
            { liveOptIn: true },
            now,
          ),
        /token overrun/,
      );
      restarted.settle(
        "previously_reserved",
        { outcome: "failed", actualCostMicroEuro: 0 },
        now,
      );
      assert.equal(restarted.status(now).tokenOverrun, true);
    } finally {
      fixture.cleanup();
    }
  }
});

test("a version-one ledger with twenty-two settled HTTP attempts needs no migration or model receipt", () => {
  const fixture = setup();
  try {
    for (let index = 0; index < 22; index++) {
      const id = `http_${index}`;
      fixture.store.reserve(httpRequest(id), now);
      fixture.store.beginLiveAttempt(id, { liveOptIn: true }, now);
      fixture.store.settle(
        id,
        { outcome: "succeeded", actualCostMicroEuro: 0 },
        now,
      );
    }
    const before = readFileSync(fixture.store.statePath, "utf8");
    const status = new ExperimentStore(fixture.root, manifest).status(now);
    assert.equal(status.usage.attempts.http, 22);
    assert.equal(status.usage.effectiveInputTokens, 0);
    assert.equal(status.usage.effectiveOutputTokens, 0);
    assert.equal(status.tokenOverrun, false);
    assert.equal(readFileSync(fixture.store.statePath, "utf8"), before);
  } finally {
    fixture.cleanup();
  }
});
