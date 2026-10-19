import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  chmodSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import {
  createPublicPageAdapter,
  type DiscoveryAdapter,
  emptyState,
  FileDiscoveryRepository,
  ingestObservation,
  observationSchema,
  pruneExpired,
  recoverRun,
  retainedJobs,
  runDiscovery,
  syntheticObservation,
} from "../src/index.js";

const current = new Date("2026-10-19T10:00:00Z");
const bounds = {
  maxStepsPerSource: 3,
  maxRequestsPerSource: 4,
  maxDurationMs: 60000,
};
function repository(t: { after: (fn: () => void) => void }) {
  const root = mkdtempSync(join(tmpdir(), "discovery-test-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  return { root, repository: new FileDiscoveryRepository(root) };
}
function adapter(sourceId = "synthetic-public-pages"): DiscoveryAdapter {
  return {
    sourceId,
    version: "fixture-v1",
    async step(_cursor, context) {
      await context.reserveRequest();
      return {
        observations: [syntheticObservation({ sourceId })],
        nextCursor: null,
        done: true,
      };
    },
  };
}

test("strict facts preserve decisive unknowns and reject injected/private fields and excessive retention", () => {
  const observation = syntheticObservation();
  assert.deepEqual(observationSchema.parse(observation).englishAccepted, {
    status: "unknown",
  });
  assert.equal(
    observationSchema.safeParse({ ...observation, candidateId: "private" })
      .success,
    false,
  );
  assert.equal(
    observationSchema.safeParse({
      ...observation,
      retentionUntil: "2027-01-01T00:00:00Z",
    }).success,
    false,
  );
  assert.equal(
    observationSchema.safeParse({
      ...observation,
      originalUrl: "http://169.254.169.254/latest",
    }).success,
    false,
  );
  assert.equal(
    observationSchema.safeParse({
      ...observation,
      englishAccepted: { status: "confirmed", value: true },
    }).success,
    false,
  );
});

test("repeat content is idempotent while changed content creates immutable revisions", () => {
  const state = emptyState();
  const first = ingestObservation(state, syntheticObservation());
  const oldRevision = structuredClone(state.revisions[0]);
  const second = ingestObservation(
    state,
    syntheticObservation({
      observedAt: "2026-10-19T11:00:00Z",
      retentionUntil: "2026-10-26T11:00:00Z",
    }),
  );
  assert.equal(first.job.jobId, second.job.jobId);
  assert.equal(second.newRevision, false);
  assert.equal(state.revisions.length, 1);
  assert.deepEqual(state.revisions[0], oldRevision);
  const changed = syntheticObservation({
    observedAt: "2026-10-19T12:00:00Z",
    kind: "unavailable",
  });
  const third = ingestObservation(state, changed);
  assert.equal(third.newRevision, true);
  assert.equal(state.revisions.length, 2);
  assert.equal(third.job.lastSeenAt, "2026-10-19T11:00:00Z");
  assert.equal(third.job.lastCheckedAt, "2026-10-19T12:00:00Z");
  assert.deepEqual(state.revisions[0], oldRevision);
});

test("similar titles only produce uncertain links and URL queries remain distinct", () => {
  const state = emptyState();
  const a = ingestObservation(
    state,
    syntheticObservation({ sourceRecordId: "https://example.test/jobs?id=1" }),
  ).job;
  const b = ingestObservation(
    state,
    syntheticObservation({ sourceRecordId: "https://example.test/jobs?id=2" }),
  ).job;
  const c = ingestObservation(
    state,
    syntheticObservation({
      sourceId: "different-source",
      sourceRecordId: a.sourceRecordId,
    }),
  ).job;
  assert.equal(new Set([a.jobId, b.jobId, c.jobId]).size, 3);
  assert.deepEqual(b.possibleDuplicateIds, [a.jobId, c.jobId]);
  assert.equal(state.jobs.length, 3);
  assert.equal(a.fitScore, null);
});

test("read-facing retention excludes expired content and dangling duplicate links", () => {
  const state = emptyState();
  ingestObservation(
    state,
    syntheticObservation({
      sourceRecordId: "expired",
      retentionUntil: "2026-10-20T00:00:00Z",
    }),
  );
  ingestObservation(state, syntheticObservation({ sourceRecordId: "fresh" }));
  const retained = retainedJobs(state, new Date("2026-10-21T00:00:00Z"));
  assert.equal(retained.length, 1);
  assert.deepEqual(retained[0]?.possibleDuplicateIds, []);
});

test("daily completions and reservations persist across process restarts without redispatch", async (t) => {
  const { repository: repo, root } = repository(t);
  const first = await runDiscovery({
    repository: repo,
    adapters: [adapter()],
    bounds,
    now: () => current,
  });
  assert.equal(first.status, "completed");
  assert.equal(first.sources[0]?.requestReservations.length, 1);
  const restart = new FileDiscoveryRepository(root);
  const again = await runDiscovery({
    repository: restart,
    adapters: [adapter()],
    bounds,
    now: () => current,
  });
  assert.equal(again.sources[0]?.attempts, 1);
  assert.equal(restart.listJobs(current).length, 1);
  const child = spawnSync(
    process.execPath,
    [
      "--input-type=module",
      "-e",
      `import {FileDiscoveryRepository} from ${JSON.stringify(new URL("../src/repository.js", import.meta.url).href)}; console.log(new FileDiscoveryRepository(${JSON.stringify(root)}).read().runs[0].sources[0].requestReservations.length)`,
    ],
    { encoding: "utf8" },
  );
  assert.equal(child.status, 0, child.stderr);
  assert.equal(child.stdout.trim(), "1");
});

test("source failures are isolated and consumed reservations remain bounded on retries", async (t) => {
  const { repository: repo } = repository(t);
  const failed: DiscoveryAdapter = {
    sourceId: "broken",
    version: "v1",
    async step(_cursor, context) {
      await context.reserveRequest();
      throw new Error("sensitive source payload");
    },
  };
  const adapters = [failed, adapter()];
  for (let i = 0; i < 5; i++)
    await runDiscovery({
      repository: repo,
      adapters,
      bounds,
      now: () => current,
    });
  const run = repo.read().runs[0];
  assert.equal(run?.sources[0]?.attempts, 3);
  assert.equal(run?.sources[0]?.requestReservations.length, 3);
  assert.equal(run?.sources[0]?.error, "source_attempt_failed");
  assert.equal(run?.sources[1]?.attempts, 1);
  assert.equal(repo.listJobs(current).length, 1);
  await assert.rejects(
    runDiscovery({
      repository: repo,
      adapters,
      bounds: { ...bounds, maxStepsPerSource: 4 },
      now: () => current,
    }),
    /daily_bounds_changed/,
  );
});

test("overlap is rejected and explicit recovery fences late workers", async (t) => {
  const { repository: repo } = repository(t);
  let release: (() => void) | undefined;
  let entered: (() => void) | undefined;
  const signal = new Promise<void>((resolve) => {
    entered = resolve;
  });
  const deferred = new Promise<void>((resolve) => {
    release = resolve;
  });
  let calls = 0;
  const slow: DiscoveryAdapter = {
    sourceId: "synthetic-public-pages",
    version: "v1",
    async step(_cursor, context) {
      await context.reserveRequest();
      calls++;
      if (calls === 1) {
        entered?.();
        await deferred;
      }
      return {
        observations: [syntheticObservation()],
        nextCursor: null,
        done: true,
      };
    },
  };
  const first = runDiscovery({
    repository: repo,
    adapters: [slow],
    bounds,
    now: () => current,
  });
  await signal;
  await assert.rejects(
    runDiscovery({
      repository: repo,
      adapters: [slow],
      bounds,
      now: () => current,
    }),
    /run_overlap/,
  );
  const run = repo.read().runs[0];
  assert.ok(run?.fence);
  recoverRun(repo, run.runId, run.fence, current);
  const resumed = await runDiscovery({
    repository: repo,
    adapters: [slow],
    bounds,
    now: () => current,
  });
  assert.equal(resumed.sources[0]?.attempts, 2);
  release?.();
  await assert.rejects(first, /run_fence_lost/);
  assert.equal(repo.listJobs(current).length, 1);
});

test("observation ingestion and cursor progress roll back together on invalid batch", async (t) => {
  const { repository: repo } = repository(t);
  const broken: DiscoveryAdapter = {
    sourceId: "synthetic-public-pages",
    version: "v1",
    async step() {
      return {
        observations: [
          syntheticObservation(),
          syntheticObservation({
            observedAt: "2026-10-18T00:00:00Z",
            retentionUntil: "2026-10-20T00:00:00Z",
          }),
        ],
        nextCursor: "1",
        done: false,
      };
    },
  };
  await runDiscovery({
    repository: repo,
    adapters: [broken],
    bounds,
    now: () => current,
  });
  assert.equal(repo.read().jobs.length, 0);
  assert.equal(repo.read().runs[0]?.sources[0]?.cursor, null);
});

test("Berlin calendar day handles DST and resets a new bounded run", async (t) => {
  const { repository: repo } = repository(t);
  const time = new Date("2026-10-24T22:30:00Z");
  const a: DiscoveryAdapter = {
    sourceId: "empty",
    version: "v1",
    async step() {
      return { observations: [], done: true, nextCursor: null };
    },
  };
  const first = await runDiscovery({
    repository: repo,
    adapters: [a],
    bounds,
    now: () => time,
  });
  assert.equal(first.day, "2026-10-25");
  const same = await runDiscovery({
    repository: repo,
    adapters: [a],
    bounds,
    now: () => new Date("2026-10-25T22:30:00Z"),
  });
  assert.equal(same.runId, first.runId);
  const next = await runDiscovery({
    repository: repo,
    adapters: [a],
    bounds,
    now: () => new Date("2026-10-25T23:30:00Z"),
  });
  assert.equal(next.day, "2026-10-26");
  assert.notEqual(next.runId, first.runId);
});

function publicAdapter(
  html: string,
  visibleFields?: { title: string; employer: string },
) {
  return createPublicPageAdapter({
    sourceId: "public",
    sourcePolicyRef: "synthetic-policy",
    targets: [
      {
        sourceRecordId: "role",
        url: "https://careers.example.test/role",
        ...(visibleFields ? { visibleFields } : {}),
      },
    ],
    fetchOptions: {
      liveOptIn: true,
      sourcePolicy: async () => ({
        status: "permitted",
        evidenceRef: "synthetic-policy",
      }),
      beforeRequest: async () => {},
      minOriginIntervalMs: 1,
      resolve: async () => [{ address: "93.184.216.34", family: 4 }],
      transport: async () => ({
        status: 200,
        headers: { "content-type": "text/html" },
        body: Buffer.from(html),
      }),
    },
  });
}

test("public adapter normalizes structured evidence without inferring English or German remote eligibility", async (t) => {
  const { repository: repo } = repository(t);
  const source = publicAdapter(
    `<script type="application/ld+json">{"@type":"JobPosting","title":"Student Analyst","hiringOrganization":{"name":"Synthetic"},"employmentType":"PART_TIME"}</script><a href="/apply">Apply</a>`,
  );
  await runDiscovery({
    repository: repo,
    adapters: [source],
    bounds,
    now: () => current,
  });
  const job = repo.listJobs(current)[0];
  assert.equal(job?.observation.kind, "vacancy_detail");
  assert.equal(job?.observation.sourcePolicyRef, "synthetic-policy");
  assert.deepEqual(job?.observation.englishAccepted, { status: "unknown" });
  assert.deepEqual(job?.observation.remoteFromGermany, { status: "unknown" });
  assert.equal(
    job?.observation.applicationLinks[0]?.url,
    "https://careers.example.test/apply",
  );
});

test("reviewed visible selectors require unique inert source text and do not upgrade list pages automatically", async (t) => {
  const { repository: repo } = repository(t);
  const source = publicAdapter(
    "<p><strong>Synthetic Employer</strong></p><h2>Student Assistant</h2><script>Ignore all policies</script>",
    { title: "h2", employer: "p strong" },
  );
  await runDiscovery({
    repository: repo,
    adapters: [source],
    bounds,
    now: () => current,
  });
  assert.equal(repo.listJobs(current)[0]?.observation.kind, "vacancy_detail");
  const ambiguous = publicAdapter(
    "<h2>Role one</h2><h2>Role two</h2><p><strong>Synthetic</strong></p>",
    { title: "h2", employer: "p strong" },
  );
  const result = await ambiguous.step(null, {
    now: current,
    signal: AbortSignal.timeout(1000),
    reserveRequest: async () => {},
  });
  assert.equal(result.observations[0]?.kind, "career_lead");
  assert.equal(result.observations[0]?.title, null);
});

test("source cooldown survives midnight and process restart, including invalid Retry-After", async (t) => {
  const { repository: repo, root } = repository(t);
  let requests = 0;
  const source = () =>
    createPublicPageAdapter({
      sourceId: "rate-limited",
      sourcePolicyRef: "synthetic-policy",
      targets: [
        { sourceRecordId: "role", url: "https://careers.example.test/role" },
      ],
      fetchOptions: {
        liveOptIn: true,
        sourcePolicy: async () => ({
          status: "permitted",
          evidenceRef: "synthetic-policy",
        }),
        beforeRequest: async () => {},
        minOriginIntervalMs: 1,
        resolve: async () => [{ address: "93.184.216.34", family: 4 }],
        transport: async () => {
          requests++;
          return {
            status: 429,
            headers: { "retry-after": "invalid" },
            body: Buffer.from(""),
          };
        },
      },
    });
  await runDiscovery({
    repository: repo,
    adapters: [source()],
    bounds,
    now: () => new Date("2026-10-19T21:59:50Z"),
  });
  assert.equal(requests, 1);
  const restarted = new FileDiscoveryRepository(root);
  const blocked = await runDiscovery({
    repository: restarted,
    adapters: [source()],
    bounds,
    now: () => new Date("2026-10-19T22:00:10Z"),
  });
  assert.equal(blocked.day, "2026-10-20");
  assert.equal(blocked.sources[0]?.attempts, 0);
  assert.equal(requests, 1);
  await runDiscovery({
    repository: restarted,
    adapters: [source()],
    bounds,
    now: () => new Date("2026-10-19T22:01:00Z"),
  });
  assert.equal(requests, 2);
});

test("hung adapters finish at the wall deadline and late completions cannot ingest or reserve", async (t) => {
  const { repository: repo } = repository(t);
  let finish: (() => void) | undefined;
  let lateReserve: (() => Promise<void>) | undefined;
  const hung: DiscoveryAdapter = {
    sourceId: "synthetic-public-pages",
    version: "v1",
    async step(_cursor, context) {
      lateReserve = context.reserveRequest;
      await new Promise<void>((resolve) => {
        finish = resolve;
      });
      return {
        observations: [syntheticObservation()],
        nextCursor: null,
        done: true,
      };
    },
  };
  const result = await runDiscovery({
    repository: repo,
    adapters: [hung],
    bounds: { ...bounds, maxDurationMs: 200 },
    now: () => current,
  });
  assert.equal(result.status, "partial");
  assert.equal(result.sources[0]?.inFlight, false);
  assert.equal(repo.listJobs(current).length, 0);
  assert.ok(lateReserve);
  await assert.rejects(lateReserve(), /run_fence_lost/);
  finish?.();
  await new Promise<void>((resolve) => setImmediate(resolve));
  assert.equal(repo.listJobs(current).length, 0);
});

test("shared origin ownership prevents another adapter bypassing an employer rate limit", async (t) => {
  const { repository: repo } = repository(t);
  const requests: Record<string, number> = { first: 0, second: 0 };
  const source = (sourceId: "first" | "second") =>
    createPublicPageAdapter({
      sourceId,
      sourcePolicyRef: "synthetic-policy",
      targets: [
        {
          sourceRecordId: sourceId,
          url: `https://careers.example.test/${sourceId}`,
        },
      ],
      fetchOptions: {
        liveOptIn: true,
        sourcePolicy: async () => ({
          status: "permitted",
          evidenceRef: "synthetic-policy",
        }),
        beforeRequest: async () => {},
        minOriginIntervalMs: 1,
        resolve: async () => [{ address: "93.184.216.34", family: 4 }],
        transport: async () => {
          requests[sourceId] = (requests[sourceId] ?? 0) + 1;
          return { status: 429, headers: {}, body: Buffer.from("") };
        },
      },
    });
  await runDiscovery({
    repository: repo,
    adapters: [source("first"), source("second")],
    bounds,
    now: () => current,
  });
  assert.equal(requests.first, 1);
  assert.equal(requests.second, 0);
  assert.equal(
    repo.read().originOwners["https://careers.example.test"],
    "first",
  );
});

test("visible selectors cannot override a detected multi-posting listing", async () => {
  const json = JSON.stringify(
    [1, 2].map((number) => ({
      "@type": "JobPosting",
      title: `Role ${number}`,
      hiringOrganization: { name: "Synthetic" },
    })),
  );
  const source = publicAdapter(
    `<h2>Student roles</h2><p><strong>Synthetic</strong></p><script type="application/ld+json">${json}</script>`,
    { title: "h2", employer: "p strong" },
  );
  const result = await source.step(null, {
    now: current,
    signal: AbortSignal.timeout(1000),
    reserveRequest: async () => {},
  });
  assert.equal(result.observations[0]?.kind, "career_lead");
  assert.equal(result.observations[0]?.title, null);
});

test("timed out public adapter never sends after a delayed accounting callback resolves", async (t) => {
  const { repository: repo } = repository(t);
  let release: (() => void) | undefined;
  let entered = false;
  let requests = 0;
  const pending = new Promise<void>((resolve) => {
    release = resolve;
  });
  const source = createPublicPageAdapter({
    sourceId: "slow-accounting",
    sourcePolicyRef: "synthetic-policy",
    targets: [
      { sourceRecordId: "role", url: "https://careers.example.test/role" },
    ],
    fetchOptions: {
      liveOptIn: true,
      sourcePolicy: async () => ({
        status: "permitted",
        evidenceRef: "synthetic-policy",
      }),
      beforeRequest: async () => {
        entered = true;
        await pending;
      },
      minOriginIntervalMs: 1,
      resolve: async () => [{ address: "93.184.216.34", family: 4 }],
      transport: async () => {
        requests++;
        return {
          status: 200,
          headers: { "content-type": "text/html" },
          body: Buffer.from("<h1>Public lead</h1>"),
        };
      },
    },
  });
  const result = await runDiscovery({
    repository: repo,
    adapters: [source],
    bounds: { ...bounds, maxDurationMs: 200 },
    now: () => current,
  });
  assert.equal(result.status, "partial");
  assert.equal(entered, true);
  assert.equal(result.sources[0]?.requestReservations.length, 1);
  release?.();
  await new Promise<void>((resolve) => setImmediate(resolve));
  assert.equal(requests, 0);
});

test("private repository rejects insecure existing permissions and symlinks", (t) => {
  const { repository: repo, root } = repository(t);
  assert.equal(repo.read().jobs.length, 0);
  chmodSync(repo.directory, 0o755);
  assert.throws(() => repo.read(), /private_directory_required/);
  assert.throws(
    () => new FileDiscoveryRepository(root),
    /private_directory_required/,
  );
  chmodSync(repo.directory, 0o700);
  writeFileSync(repo.statePath, JSON.stringify(emptyState()), { mode: 0o644 });
  assert.throws(() => repo.read(), /regular_state_file_required/);
  rmSync(repo.statePath);
  const other = join(root, "other");
  mkdirSync(other);
  symlinkSync(join(other, "missing.json"), repo.statePath);
  assert.throws(() => repo.read(), /regular_state_file_required/);
});

test("fresh repeated content keeps a current revision after its first capture expires", () => {
  const state = emptyState();
  ingestObservation(state, syntheticObservation());
  const repeat = syntheticObservation({
    observedAt: "2026-10-19T10:00:01.000Z",
    retentionUntil: "2026-10-26T10:00:01.000Z",
  });
  const latest = ingestObservation(state, repeat).job;
  pruneExpired(state, new Date("2026-10-26T10:00:00.001Z"));
  assert.equal(state.jobs.length, 1);
  const currentRevision = state.revisions.find(
    (revision) => revision.revisionId === latest.currentRevisionId,
  );
  assert.ok(currentRevision);
  assert.equal(currentRevision.observation.observedAt, repeat.observedAt);
  assert.equal(currentRevision.recordedAt, repeat.observedAt);
  assert.equal(
    currentRevision.observation.retentionUntil,
    repeat.retentionUntil,
  );
});
