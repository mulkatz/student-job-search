import assert from "node:assert/strict";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import type { Request } from "../src/index.js";
import {
  berlinDate,
  configSchema,
  ExperimentStore,
  manifestSchema,
  requestSchema,
} from "../src/index.js";

const manifest = {
  version: 1,
  queries: Array.from({ length: 20 }, (_, index) => ({
    id: `q${index}`,
    stream: index < 10 ? "berlin" : "germany_remote",
    query: `Synthetic non-personal query ${index}`,
  })),
};
const config = {
  version: 1,
  allocationsMicroEuro: {
    discovery: 1_000_000,
    extraction: 1_000_000,
    model: 1_000_000,
    gmail: 1_000_000,
  },
};
const start = new Date("2026-10-19T08:00:00.000Z");
const at = (offset: number) => new Date(start.getTime() + offset * 86_400_000);
const request = (id: string, change: Partial<Request> = {}): Request => ({
  id,
  branch: "discovery",
  kind: "search",
  queryId: "q0",
  upperCostMicroEuro: 1,
  upperInputTokens: 0,
  upperOutputTokens: 0,
  upperRecords: 0,
  ...change,
});
function setup() {
  const root = mkdtempSync(join(tmpdir(), "job-search-g3-"));
  mkdirSync(join(root, ".local", "g3"), { recursive: true, mode: 0o755 });
  const store = new ExperimentStore(root, manifest);
  store.initialize(config, start);
  return {
    root,
    store,
    cleanup: () => rmSync(root, { recursive: true, force: true }),
  };
}

test("manifest/config boundaries reject missing fields, unknown keys, duplicate/unbalanced queries and excess budget", () => {
  assert.equal(manifestSchema.safeParse(manifest).success, true);
  for (const input of [
    null,
    {},
    { ...manifest, version: 2 },
    {
      ...manifest,
      queries: manifest.queries.map((query, index) =>
        index === 0 ? { ...query, query: "   " } : query,
      ),
    },
    { ...manifest, queries: manifest.queries.slice(1) },
    {
      ...manifest,
      queries: manifest.queries.map((query) => ({ ...query, id: "duplicate" })),
    },
    {
      ...manifest,
      queries: manifest.queries.map((query) => ({
        ...query,
        stream: "berlin",
      })),
    },
  ]) {
    assert.equal(manifestSchema.safeParse(input).success, false);
  }
  for (const input of [
    {},
    { ...config, token: "synthetic-placeholder" },
    {
      version: 1,
      allocationsMicroEuro: {
        ...config.allocationsMicroEuro,
        model: 5_000_001,
      },
    },
    {
      version: 1,
      allocationsMicroEuro: { ...config.allocationsMicroEuro, model: -1 },
    },
  ]) {
    assert.equal(configSchema.safeParse(input).success, false);
  }
  assert.equal(
    requestSchema.safeParse(request("bad", { kind: "llm" })).success,
    false,
  );
});

test("exclusive initialization, atomic persistence, restart and read-only status preserve cumulative accounting", () => {
  const fixture = setup();
  try {
    assert.equal(statSync(fixture.store.directory).mode & 0o777, 0o700);
    assert.equal(statSync(fixture.store.statePath).mode & 0o777, 0o600);
    const before = readFileSync(fixture.store.statePath, "utf8");
    assert.equal(fixture.store.status(start).observation.window, "not-started");
    assert.equal(readFileSync(fixture.store.statePath, "utf8"), before);
    assert.throws(() => fixture.store.initialize(config, start));
    assert.equal(existsSync(fixture.store.lockPath), false);
    fixture.store.reserve(
      request("first", { upperCostMicroEuro: 100, upperRecords: 10 }),
      start,
    );
    const restarted = new ExperimentStore(fixture.root, manifest);
    assert.equal(restarted.status(start).usage.attempts.search, 1);
    assert.equal(restarted.status(start).usage.costMicroEuro.discovery, 100);
    assert.equal(restarted.status(start).observation.startedAt, null);
    assert.throws(() => restarted.reserve(request("first"), start));
    restarted.settle(
      "first",
      { outcome: "failed", actualCostMicroEuro: 0 },
      start,
    );
    assert.equal(restarted.status(start).usage.attempts.search, 1);
    assert.equal(restarted.status(start).usage.upperRecords, 10);
    assert.equal(restarted.status(start).usage.costMicroEuro.discovery, 0);
  } finally {
    fixture.cleanup();
  }
});

test("one-writer/crash lock stops writes until explicit reconciliation and remains visible to status", () => {
  const fixture = setup();
  try {
    writeFileSync(fixture.store.lockPath, "Synthetic interrupted writer", {
      flag: "wx",
    });
    const before = readFileSync(fixture.store.statePath, "utf8");
    assert.throws(
      () => fixture.store.reserve(request("blocked"), start),
      /reconcile/,
    );
    assert.equal(
      fixture.store.status(start).writerReconciliationRequired,
      true,
    );
    assert.equal(readFileSync(fixture.store.statePath, "utf8"), before);
    assert.equal(existsSync(fixture.store.lockPath), true);
  } finally {
    fixture.cleanup();
  }
});

test("frozen manifest and malformed stored state fail closed after restart", () => {
  const fixture = setup();
  try {
    const changed = {
      ...manifest,
      queries: manifest.queries.map((query, index) =>
        index === 0 ? { ...query, query: "Changed synthetic query" } : query,
      ),
    };
    assert.throws(
      () => new ExperimentStore(fixture.root, changed).read(),
      /manifest changed/,
    );
    const original = fixture.store.read();
    for (const invalid of [
      { ...original, unexpected: true },
      { ...original, startedAt: start.toISOString() },
      { ...original, attempts: [{}] },
    ]) {
      writeFileSync(fixture.store.statePath, JSON.stringify(invalid));
      assert.throws(() => fixture.store.read());
    }
  } finally {
    fixture.cleanup();
  }
});

test("daily and whole-experiment request caps count reservations and retries across restarts", () => {
  for (const [kind, daily, total, branch] of [
    ["search", 40, 100, "discovery"],
    ["llm", 30, 100, "model"],
    ["structured", 100, 100, "discovery"],
  ] as const) {
    const fixture = setup();
    try {
      for (let index = 0; index < total; index++) {
        const day = Math.floor(index / daily);
        const operation = request(`attempt_${index}`, { kind, branch });
        if (kind !== "search") delete operation.queryId;
        if (kind === "structured") operation.boardId = "synthetic-board";
        fixture.store.reserve(operation, at(day));
        if (index === daily - 1 && daily < total) {
          assert.throws(
            () =>
              fixture.store.reserve(
                { ...operation, id: "daily_overflow" },
                at(day),
              ),
            /Daily/,
          );
        }
      }
      const extra = request("whole_overflow", { kind, branch });
      if (kind !== "search") delete extra.queryId;
      if (kind === "structured") extra.boardId = "synthetic-board";
      assert.throws(
        () => new ExperimentStore(fixture.root, manifest).reserve(extra, at(6)),
        /cap/,
      );
      assert.equal(fixture.store.read().attempts.length, total);
    } finally {
      fixture.cleanup();
    }
  }
});

test("HTTP has no daily cap while all attempts retain the cumulative 200 cap across restarts", () => {
  const fixture = setup();
  const httpRequest = (id: string) =>
    request(id, {
      kind: "http",
      branch: "extraction",
      queryId: undefined,
    });
  try {
    fixture.store.reserve(httpRequest("http_failed"), start);
    fixture.store.beginLiveAttempt("http_failed", { liveOptIn: true }, start);
    fixture.store.settle(
      "http_failed",
      { outcome: "failed", actualCostMicroEuro: 0 },
      start,
    );
    fixture.store.reserve(httpRequest("http_retry_1"), start);
    fixture.store.beginLiveAttempt("http_retry_1", { liveOptIn: true }, start);
    let store = fixture.store;
    for (let index = 2; index < 200; index++) {
      if (index === 40) {
        store = new ExperimentStore(fixture.root, manifest);
        assert.equal(store.status(start).usage.attempts.http, 40);
      }
      store.reserve(httpRequest(`http_${index}`), start);
    }
    const restarted = new ExperimentStore(fixture.root, manifest);
    const state = restarted.read();
    assert.equal(state.attempts.length, 200);
    assert.equal(state.attempts[0]?.outcome, "failed");
    assert.equal(state.attempts[1]?.outcome, "dispatched");
    assert.equal(state.attempts[199]?.outcome, "reserved");
    assert.deepEqual(
      [...new Set(state.attempts.map((attempt) => attempt.reservedAt))],
      [start.toISOString()],
    );
    assert.equal(restarted.status(start).usage.attempts.http, 200);
    assert.equal(restarted.status(start).usage.costMicroEuro.extraction, 199);
    assert.equal(restarted.status(start).observation.startedAt, null);
    assert.throws(
      () => restarted.reserve(httpRequest("http_201"), start),
      /Whole-experiment http cap reached/,
    );
    assert.equal(restarted.read().attempts.length, 200);
  } finally {
    fixture.cleanup();
  }
});

test("token, record, initial-board and isolated branch budget caps reject excess before dispatch", () => {
  const fixture = setup();
  try {
    fixture.store.reserve(request("records", { upperRecords: 400 }), start);
    assert.throws(
      () =>
        fixture.store.reserve(
          request("record_overflow", { upperRecords: 1 }),
          start,
        ),
      /cap/,
    );
    const llm = request("tokens", {
      kind: "llm",
      branch: "model",
      upperInputTokens: 500_000,
      upperOutputTokens: 100_000,
    });
    delete llm.queryId;
    fixture.store.reserve(llm, start);
    assert.throws(
      () =>
        fixture.store.reserve(
          {
            ...llm,
            id: "input_overflow",
            upperInputTokens: 1,
            upperOutputTokens: 0,
          },
          start,
        ),
      /cap/,
    );
    assert.throws(
      () =>
        fixture.store.reserve(
          {
            ...llm,
            id: "output_overflow",
            upperInputTokens: 0,
            upperOutputTokens: 1,
          },
          start,
        ),
      /cap/,
    );
    for (let index = 0; index < 5; index++) {
      const board = request(`board_${index}`, {
        kind: "structured",
        boardId: `synthetic_${index}`,
      });
      delete board.queryId;
      fixture.store.reserve(board, start);
    }
    assert.throws(
      () =>
        fixture.store.reserve(
          {
            ...request("extra_board"),
            queryId: undefined,
            kind: "structured",
            boardId: "synthetic_sixth",
          },
          start,
        ),
      /cap/,
    );
    assert.throws(
      () =>
        fixture.store.reserve(
          request("budget", { upperCostMicroEuro: 1_000_000 }),
          start,
        ),
      /Budget/,
    );
  } finally {
    fixture.cleanup();
  }
});

test("ambiguous attempts keep reservations and budget overruns are recorded rather than discarded", () => {
  const fixture = setup();
  try {
    fixture.store.reserve(
      request("ambiguous", { upperCostMicroEuro: 900_000 }),
      start,
    );
    fixture.store.beginLiveAttempt("ambiguous", { liveOptIn: true }, start);
    fixture.store.settle("ambiguous", { outcome: "ambiguous" }, start);
    assert.equal(
      fixture.store.status(start).usage.costMicroEuro.discovery,
      900_000,
    );
    assert.throws(
      () =>
        fixture.store.settle(
          "ambiguous",
          { outcome: "failed", actualCostMicroEuro: 0 },
          start,
        ),
      /reconciliation/,
    );
    fixture.store.reserve(
      request("overrun", { upperCostMicroEuro: 100_000 }),
      start,
    );
    fixture.store.beginLiveAttempt("overrun", { liveOptIn: true }, start);
    fixture.store.settle(
      "overrun",
      { outcome: "succeeded", actualCostMicroEuro: 200_000 },
      start,
    );
    const restarted = new ExperimentStore(fixture.root, manifest);
    assert.equal(restarted.status(start).budgetOverrun, true);
    assert.equal(
      restarted.status(start).usage.costMicroEuro.discovery,
      1_100_000,
    );
    assert.throws(
      () => restarted.reserve(request("blocked_after_overrun"), start),
      /Budget/,
    );
  } finally {
    fixture.cleanup();
  }
});

test("live dispatch requires explicit opt-in, starts the Berlin clock, and rejects stale reservations and an eighth day", () => {
  const fixture = setup();
  try {
    fixture.store.reserve(request("first"), start);
    for (const optIn of [
      undefined,
      {},
      { liveOptIn: false },
      { liveOptIn: "true" },
    ]) {
      assert.throws(() =>
        fixture.store.beginLiveAttempt("first", optIn, start),
      );
    }
    assert.equal(fixture.store.status(start).observation.startedAt, null);
    fixture.store.beginLiveAttempt("first", { liveOptIn: true }, start);
    assert.throws(() =>
      fixture.store.beginLiveAttempt("first", { liveOptIn: true }, start),
    );
    const observation = fixture.store.status(start).observation;
    assert.equal(observation.endBerlinDate, "2026-10-25");
    assert.equal(observation.nextDueBerlinDate, "2026-10-20");
    assert.equal(observation.window, "incomplete");
    assert.equal(observation.benchmark, "not-evaluated");
    fixture.store.reserve(request("stale"), start);
    assert.throws(
      () => fixture.store.beginLiveAttempt("stale", { liveOptIn: true }, at(1)),
      /calendar days/,
    );
    assert.throws(
      () => fixture.store.reserve(request("day_eight"), at(7)),
      /window ended/,
    );
    assert.equal(fixture.store.status(at(7)).observation.window, "elapsed");
    assert.equal(
      fixture.store.status(at(7)).observation.discoveryAttemptDays.length,
      1,
    );
    assert.equal(
      fixture.store.status(at(7)).observation.missedBerlinDates.length,
      6,
    );
    assert.equal(berlinDate("2026-10-24T22:30:00.000Z"), "2026-10-25");
    assert.equal(berlinDate("2026-10-25T22:30:00.000Z"), "2026-10-25");
    assert.equal(berlinDate("2026-10-25T23:30:00.000Z"), "2026-10-26");
    assert.throws(
      () => fixture.store.reserve(request("past"), at(-1)),
      /backwards/,
    );
  } finally {
    fixture.cleanup();
  }
});

test("Gmail allows one confirmed success and blocks outstanding or ambiguous creates across restarts", () => {
  for (const outcome of ["succeeded", "ambiguous"] as const) {
    const fixture = setup();
    try {
      const gmail = request("draft", { kind: "gmail", branch: "gmail" });
      delete gmail.queryId;
      fixture.store.reserve(gmail, start);
      assert.throws(
        () => fixture.store.reserve({ ...gmail, id: "concurrent" }, start),
        /Gmail/,
      );
      fixture.store.beginLiveAttempt("draft", { liveOptIn: true }, start);
      fixture.store.settle(
        "draft",
        outcome === "ambiguous"
          ? { outcome }
          : { outcome, actualCostMicroEuro: 0 },
        start,
      );
      assert.throws(
        () =>
          new ExperimentStore(fixture.root, manifest).reserve(
            { ...gmail, id: "duplicate" },
            start,
          ),
        /Gmail/,
      );
      assert.equal(fixture.store.status(start).observation.startedAt, null);
    } finally {
      fixture.cleanup();
    }
  }
});

const snapshotAuthorization = {
  authorizationRef: "synthetic-user-duration-waiver",
  decisionRef: "docs/adr/0017-bounded-g3-snapshot-without-duration-gate.md",
};

test("explicit snapshot authorization preserves all ledger history and removes only the duration gate", () => {
  const fixture = setup();
  try {
    fixture.store.reserve(request("first"), start);
    fixture.store.beginLiveAttempt("first", { liveOptIn: true }, start);
    fixture.store.settle(
      "first",
      { outcome: "succeeded", actualCostMicroEuro: 1 },
      start,
    );
    fixture.store.reserve(request("preserved_reservation"), start);
    const original = fixture.store.read();
    assert.equal(Object.hasOwn(original, "observationPolicy"), false);
    assert.throws(
      () => fixture.store.reserve(request("legacy_eighth_day"), at(7)),
      /window ended/,
    );
    const adopted = fixture.store.adoptBoundedSnapshotPolicy(
      snapshotAuthorization,
      at(7),
    );
    assert.deepEqual(adopted.attempts, original.attempts);
    assert.deepEqual(adopted.config, original.config);
    assert.equal(adopted.startedAt, original.startedAt);
    assert.equal(adopted.createdAt, original.createdAt);
    assert.equal(adopted.manifestHash, original.manifestHash);
    const restarted = new ExperimentStore(fixture.root, manifest);
    assert.deepEqual(restarted.read().observationPolicy, {
      mode: "bounded_snapshot",
      ...snapshotAuthorization,
      authorizedAt: at(7).toISOString(),
    });
    restarted.reserve(request("snapshot_later_day"), at(8));
    restarted.beginLiveAttempt(
      "snapshot_later_day",
      { liveOptIn: true },
      at(8),
    );
    assert.throws(
      () =>
        restarted.beginLiveAttempt(
          "preserved_reservation",
          { liveOptIn: true },
          at(8),
        ),
      /calendar days/,
    );
    const status = restarted.status(at(8)).observation;
    assert.equal(status.mode, "bounded_snapshot");
    assert.equal(status.startedAt, start.toISOString());
    assert.equal(status.endBerlinDate, null);
    assert.equal(status.requiredCalendarDays, 0);
    assert.equal(status.nextDueBerlinDate, null);
    assert.deepEqual(status.missedBerlinDates, []);
    assert.equal(status.window, "bounded-snapshot");
    assert.equal(status.benchmark, "not-evaluated");
    assert.equal(status.longitudinalBenchmark, "waived_by_operator");
    assert.deepEqual(status.discoveryAttemptDays, ["2026-10-19", "2026-10-27"]);
    assert.equal(restarted.status(at(8)).usage.attempts.search, 3);
  } finally {
    fixture.cleanup();
  }
});

test("snapshot policy is strict, one-way and idempotent without replacing its authorization receipt", () => {
  const fixture = setup();
  try {
    for (const input of [
      {},
      { ...snapshotAuthorization, mode: "bounded_snapshot" },
      { ...snapshotAuthorization, capWaiver: true },
      { ...snapshotAuthorization, decisionRef: "other-decision" },
    ])
      assert.throws(() =>
        fixture.store.adoptBoundedSnapshotPolicy(input, start),
      );
    const adopted = fixture.store.adoptBoundedSnapshotPolicy(
      snapshotAuthorization,
      start,
    );
    fixture.store.adoptBoundedSnapshotPolicy(snapshotAuthorization, at(1));
    assert.deepEqual(
      fixture.store.read().observationPolicy,
      adopted.observationPolicy,
    );
    assert.throws(
      () =>
        fixture.store.adoptBoundedSnapshotPolicy(
          {
            ...snapshotAuthorization,
            authorizationRef: "different-authorization",
          },
          at(1),
        ),
      /already recorded/,
    );
    assert.throws(
      () =>
        fixture.store.adoptBoundedSnapshotPolicy(snapshotAuthorization, start),
      /backwards/,
    );
    assert.equal(fixture.store.status(at(1)).observation.startedAt, null);
    assert.equal(
      fixture.store.status(at(1)).observation.benchmark,
      "not-evaluated",
    );
  } finally {
    fixture.cleanup();
  }
});

test("snapshot mode retains daily search/model limits, cumulative model caps and free preflight accounting", () => {
  const fixture = setup();
  try {
    fixture.store.adoptBoundedSnapshotPolicy(snapshotAuthorization, start);
    for (let i = 0; i < 40; i++)
      fixture.store.reserve(request(`search_${i}`), start);
    assert.throws(
      () => fixture.store.reserve(request("search_daily_overflow"), start),
      /Daily search cap/,
    );
    const modelRequest = (id: string): Request => ({
      id,
      branch: "model",
      kind: "llm",
      upperCostMicroEuro: 0,
      upperInputTokens: 0,
      upperOutputTokens: 0,
      upperRecords: 0,
    });
    for (let i = 0; i < 30; i++)
      fixture.store.reserve(modelRequest(`free_counttokens_${i}`), start);
    assert.throws(
      () =>
        fixture.store.reserve(
          modelRequest("free_counttokens_daily_overflow"),
          start,
        ),
      /Daily llm cap/,
    );
    for (let day = 1; day < 4; day++) {
      const limit = day === 3 ? 10 : 30;
      for (let i = 0; i < limit; i++)
        fixture.store.reserve(modelRequest(`model_${day}_${i}`), at(day));
    }
    assert.equal(fixture.store.status(at(3)).usage.attempts.llm, 100);
    assert.throws(
      () =>
        fixture.store.reserve(modelRequest("model_cumulative_overflow"), at(3)),
      /Whole-experiment llm cap/,
    );
  } finally {
    fixture.cleanup();
  }
});

test("snapshot policy validation cannot retroactively authorize old out-of-window attempts", () => {
  const fixture = setup();
  try {
    fixture.store.reserve(request("first"), start);
    fixture.store.beginLiveAttempt("first", { liveOptIn: true }, start);
    fixture.store.adoptBoundedSnapshotPolicy(snapshotAuthorization, at(8));
    const state = fixture.store.read();
    state.attempts.push({
      request: request("forged_pre_authorization_attempt"),
      reservedAt: at(7).toISOString(),
      outcome: "reserved",
    });
    writeFileSync(fixture.store.statePath, JSON.stringify(state), {
      mode: 0o600,
    });
    assert.throws(() => fixture.store.read(), /outside the observation window/);
    state.attempts.pop();
    assert.ok(state.observationPolicy);
    state.observationPolicy.authorizedAt = at(9).toISOString();
    writeFileSync(fixture.store.statePath, JSON.stringify(state), {
      mode: 0o600,
    });
    assert.throws(() => fixture.store.read(), /authorization date/);
  } finally {
    fixture.cleanup();
  }
});

const modelPolicyAuthorization = {
  dailyLimit: 70,
  authorizationRef: "synthetic-user-g3-model-throughput",
  decisionRef: "docs/adr/0020-g3-model-daily-throughput.md",
};
const freePreflight = (id: string): Request => ({
  id,
  branch: "model",
  kind: "llm",
  upperCostMicroEuro: 0,
  upperInputTokens: 0,
  upperOutputTokens: 0,
  upperRecords: 0,
});

test("explicit model policy raises only daily G3 requests to seventy and preserves preflights/history/cumulative cap", () => {
  const fixture = setup();
  try {
    for (let i = 0; i < 30; i++)
      fixture.store.reserve(freePreflight(`free_preflight_${i}`), start);
    const before = fixture.store.read();
    assert.equal(Object.hasOwn(before, "modelRequestPolicy"), false);
    assert.throws(
      () =>
        fixture.store.reserve(freePreflight("legacy_daily_overflow"), start),
      /Daily llm cap/,
    );
    const authorizedAt = new Date(start.getTime() + 1000);
    const adopted = fixture.store.adoptModelRequestPolicy(
      modelPolicyAuthorization,
      authorizedAt,
    );
    assert.deepEqual(adopted.attempts, before.attempts);
    assert.deepEqual(adopted.config, before.config);
    assert.equal(adopted.startedAt, before.startedAt);
    assert.equal(adopted.manifestHash, before.manifestHash);
    for (let i = 30; i < 70; i++)
      fixture.store.reserve(freePreflight(`free_preflight_${i}`), authorizedAt);
    assert.throws(
      () =>
        fixture.store.reserve(
          freePreflight("authorized_daily_overflow"),
          authorizedAt,
        ),
      /Daily llm cap/,
    );
    const restarted = new ExperimentStore(fixture.root, manifest);
    assert.equal(
      restarted.status(authorizedAt).modelRequestPolicy?.dailyLimit,
      70,
    );
    assert.equal(restarted.status(authorizedAt).usage.attempts.llm, 70);
    for (let i = 70; i < 100; i++)
      restarted.reserve(freePreflight(`free_preflight_${i}`), at(1));
    assert.throws(
      () => restarted.reserve(freePreflight("cumulative_overflow"), at(1)),
      /Whole-experiment llm cap/,
    );
    assert.throws(
      () =>
        restarted.beginLiveAttempt(
          "free_preflight_0",
          { liveOptIn: true },
          at(1),
        ),
      /calendar days/,
    );
  } finally {
    fixture.cleanup();
  }
});

test("model throughput policy is strict/idempotent and does not waive search/token/cost limits", () => {
  const fixture = setup();
  try {
    for (const input of [
      { ...modelPolicyAuthorization, dailyLimit: 71 },
      { ...modelPolicyAuthorization, scope: "all_tasks" },
      { ...modelPolicyAuthorization, cumulativeLimit: 1000 },
      { ...modelPolicyAuthorization, decisionRef: "other" },
    ])
      assert.throws(() => fixture.store.adoptModelRequestPolicy(input, start));
    fixture.store.adoptModelRequestPolicy(modelPolicyAuthorization, start);
    const receipt = fixture.store.read().modelRequestPolicy;
    fixture.store.adoptModelRequestPolicy(modelPolicyAuthorization, at(1));
    assert.deepEqual(fixture.store.read().modelRequestPolicy, receipt);
    assert.throws(
      () =>
        fixture.store.adoptModelRequestPolicy(
          { ...modelPolicyAuthorization, authorizationRef: "conflicting" },
          at(1),
        ),
      /already recorded/,
    );
    for (let i = 0; i < 40; i++)
      fixture.store.reserve(request(`search_${i}`), at(1));
    assert.throws(
      () => fixture.store.reserve(request("search_daily_overflow"), at(1)),
      /Daily search cap/,
    );
    assert.throws(
      () =>
        fixture.store.reserve(
          { ...freePreflight("token_overflow"), upperInputTokens: 500001 },
          at(1),
        ),
      /Token/,
    );
    assert.throws(
      () =>
        fixture.store.reserve(
          { ...freePreflight("budget_overflow"), upperCostMicroEuro: 1000001 },
          at(1),
        ),
      /Budget/,
    );
  } finally {
    fixture.cleanup();
  }
});

test("model throughput authorization cannot retroactively legitimize old thirty-request violations", () => {
  const fixture = setup();
  try {
    for (let i = 0; i < 30; i++)
      fixture.store.reserve(freePreflight(`pre_authorization_${i}`), start);
    fixture.store.adoptModelRequestPolicy(
      modelPolicyAuthorization,
      new Date(start.getTime() + 1000),
    );
    const state = fixture.store.read();
    state.attempts.push({
      request: freePreflight("forged_pre_authorization_overflow"),
      reservedAt: start.toISOString(),
      outcome: "reserved",
    });
    writeFileSync(fixture.store.statePath, JSON.stringify(state), {
      mode: 0o600,
    });
    assert.throws(
      () => fixture.store.read(),
      /before model policy authorization/,
    );
    state.attempts.pop();
    assert.ok(state.modelRequestPolicy);
    state.modelRequestPolicy.authorizedAt = at(1).toISOString();
    writeFileSync(fixture.store.statePath, JSON.stringify(state), {
      mode: 0o600,
    });
    assert.throws(
      () => fixture.store.read(),
      /model request policy authorization date/,
    );
  } finally {
    fixture.cleanup();
  }
});
