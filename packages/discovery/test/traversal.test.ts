import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import type { PublicFetcherOptions } from "@job-search/experiment";
import {
  createCareerTraversalAdapter,
  createSearchLeadSnapshotAdapter,
  type DiscoveryAdapter,
  emptyState,
  FileDiscoveryRepository,
  ingestObservation,
  observationSchema,
  pruneExpired,
  recoverRun,
  revisionIdentity,
  runDiscovery,
  type SearchLeadSnapshot,
  stateSchema,
  syntheticObservation,
  traversalCheckpointSchema,
} from "../src/index.js";

const current = new Date("2026-10-19T10:00:00Z");
const expires = "2026-10-20T10:00:00.000Z";
const rootUrl = "https://employer.example.test/careers";
const bounds = {
  maxStepsPerSource: 10,
  maxRequestsPerSource: 20,
  maxDurationMs: 60000,
};
function repository(t: { after: (fn: () => void) => void }) {
  const root = mkdtempSync(join(tmpdir(), "traversal-test-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  return new FileDiscoveryRepository(root);
}
function snapshot(): SearchLeadSnapshot {
  return {
    snapshotId: "synthetic-snapshot",
    capturedAt: current.toISOString(),
    retentionUntil: expires,
    results: [
      {
        sourceRecordId: "result-1",
        queryRef: "query_student_jobs_germany_v1",
        resultRef: "query-1/result-1",
        url: rootUrl,
      },
    ],
  };
}
function search(input = snapshot()) {
  return createSearchLeadSnapshotAdapter({
    sourceId: "search",
    snapshot: input,
    permission: () => ({
      status: "permitted",
      evidenceRef: "synthetic-storage-use-grant",
      expiresAt: expires,
    }),
  });
}
async function seed() {
  const result = await search().step(null, {
    now: current,
    signal: new AbortController().signal,
    reserveRequest: async () => {
      throw new Error("search_must_not_dispatch");
    },
  });
  const observation = result.observations[0];
  assert.ok(observation);
  return observation;
}
type Route = {
  status?: number;
  html?: string;
  headers?: Record<string, string>;
  address?: string;
};
function fetchOptions(
  routes: Record<string, Route>,
  calls: string[] = [],
  overrides: Partial<PublicFetcherOptions> = {},
): PublicFetcherOptions {
  return {
    liveOptIn: true,
    sourcePolicy: async () => ({
      status: "permitted",
      evidenceRef: "synthetic-public-use",
    }),
    beforeRequest: async () => {},
    minOriginIntervalMs: 1,
    resolve: async (hostname) => [
      {
        address: routes[`dns:${hostname}`]?.address ?? "93.184.216.34",
        family: 4,
      },
    ],
    transport: async ({ url }) => {
      calls.push(url.href);
      const route = routes[url.href];
      if (!route) throw new Error("unexpected_synthetic_route");
      return {
        status: route.status ?? 200,
        headers: { "content-type": "text/html", ...route.headers },
        body: Buffer.from(route.html ?? ""),
      };
    },
    ...overrides,
  };
}
const posting = `<script type="application/ld+json">{"@type":"JobPosting","title":"Synthetic Student","hiringOrganization":{"name":"Synthetic Employer"}}</script>`;
async function traversal(
  options: PublicFetcherOptions,
  extra: Partial<Parameters<typeof createCareerTraversalAdapter>[0]> = {},
) {
  return createCareerTraversalAdapter({
    sourceId: "public",
    sourcePolicyRef: "synthetic-public-policy",
    seeds: [await seed()],
    fetchOptions: options,
    ...extra,
  });
}

test("frozen search intake needs independent applicable permission, ignores no facts, and preserves query reference", async () => {
  const result = await seed();
  assert.equal(result.kind, "search_lead");
  assert.equal(result.title, null);
  assert.equal(result.employer, null);
  assert.equal(result.discoveryProvenance?.kind, "search_result");
  if (result.discoveryProvenance?.kind === "search_result")
    assert.equal(
      result.discoveryProvenance.queryRef,
      "query_student_jobs_germany_v1",
    );
  const denied = createSearchLeadSnapshotAdapter({
    sourceId: "search",
    snapshot: snapshot(),
    permission: () => ({ status: "unresolved" }),
  });
  await assert.rejects(
    denied.step(null, {
      now: current,
      signal: new AbortController().signal,
      reserveRequest: async () => {},
    }),
    /search_storage_permission_required/,
  );
  const shortened = createSearchLeadSnapshotAdapter({
    sourceId: "search",
    snapshot: snapshot(),
    permission: () => ({
      status: "permitted",
      evidenceRef: "short-grant",
      expiresAt: "2026-10-19T10:01:00Z",
    }),
  });
  const short = await shortened.step(null, {
    now: current,
    signal: new AbortController().signal,
    reserveRequest: async () => {},
  });
  assert.equal(
    short.observations[0]?.retentionUntil,
    "2026-10-19T10:01:00.000Z",
  );
  await assert.rejects(
    shortened.step(null, {
      now: new Date("2026-10-19T10:01:00Z"),
      signal: new AbortController().signal,
      reserveRequest: async () => {},
    }),
    /search_snapshot_expired/,
  );
  const untrustedSnapshot = { ...snapshot(), extra: "invented" };
  assert.throws(
    () =>
      createSearchLeadSnapshotAdapter({
        sourceId: "search",
        snapshot: untrustedSnapshot,
        permission: () => ({ status: "unresolved" }),
      }),
    /unrecognized/i,
  );
});

test("search -> career page -> newly linked external ATS vacancy retains distinct identities and anchor provenance", async (t) => {
  const repo = repository(t);
  await runDiscovery({
    repository: repo,
    adapters: [search()],
    bounds,
    now: () => current,
  });
  const calls: string[] = [];
  const source = await traversal(
    fetchOptions(
      {
        [rootUrl]: { html: '<a href="/jobs">Our jobs</a>' },
        "https://employer.example.test/jobs": {
          html: '<a href="https://ats.other.test/position?id=1&lang=en#details">Student position</a>',
        },
        "https://ats.other.test/position?id=1&lang=en": { html: posting },
      },
      calls,
    ),
  );
  // The day contract remains stable, so intake and fetch streams normally share one adapter list.
  const repo2 = repository(t);
  await runDiscovery({
    repository: repo2,
    adapters: [search(), source],
    bounds,
    now: () => current,
  });
  assert.deepEqual(calls, [
    rootUrl,
    "https://employer.example.test/jobs",
    "https://ats.other.test/position?id=1&lang=en",
  ]);
  assert.equal(repo2.read().jobs.length, 4);
  const lead = repo2.read().jobs.find((job) => job.sourceId === "search");
  const fetched = repo2
    .read()
    .jobs.find(
      (job) =>
        job.sourceId === "public" && job.observation.originalUrl === rootUrl,
    );
  assert.notEqual(lead?.jobId, fetched?.jobId);
  const vacancy = repo2
    .read()
    .jobs.find((job) => job.observation.kind === "vacancy_detail");
  assert.equal(
    vacancy?.observation.originalUrl,
    "https://ats.other.test/position?id=1&lang=en#details",
  );
  assert.equal(vacancy?.observation.discoveryProvenance?.kind, "parent_anchor");
  assert.equal(vacancy?.observation.retentionUntil, expires);
  assert.equal(repo2.read().originOwners["https://ats.other.test"], "public");
  assert.equal(vacancy?.fitScore, null);
});

test("traversal cycles ignore fragments, preserve queries and reject unsafe targets before dispatch", async (t) => {
  const repo = repository(t);
  const calls: string[] = [];
  const source = await traversal(
    fetchOptions(
      {
        [rootUrl]: {
          html: '<a href="#jobs">Jobs again</a><a href="/job?id=1#one">Job 1</a><a href="/job?id=1#two">Job same</a><a href="/job?id=2">Job 2</a><a href="http://169.254.169.254/job">Job metadata</a><a href="https://user:password@bad.example/job">Job auth</a><a href="https://private.example.test/job">Job private DNS</a>',
        },
        "https://employer.example.test/job?id=1": { html: posting },
        "https://employer.example.test/job?id=2": { html: posting },
        "dns:private.example.test": { address: "10.0.0.1" },
      },
      calls,
    ),
  );
  const run = await runDiscovery({
    repository: repo,
    adapters: [source],
    bounds,
    now: () => current,
  });
  assert.deepEqual(calls, [
    rootUrl,
    "https://employer.example.test/job?id=1",
    "https://employer.example.test/job?id=2",
  ]);
  assert.equal(run.sources[0]?.checkpoint?.rejectedLinks, 2);
  assert.equal(
    repo
      .read()
      .jobs.find(
        (job) =>
          job.observation.originalUrl === "https://private.example.test/job",
      )?.observation.kind,
    "unavailable",
  );
  assert.ok(
    repo.read().jobs.some((job) => job.sourceRecordId.endsWith("?id=1#one")),
  );
  assert.ok(
    repo.read().jobs.some((job) => job.sourceRecordId.endsWith("?id=2")),
  );
});

test("depth, page-link, pending and visited bounds report excess without unbounded traversal", async (t) => {
  const repo = repository(t);
  const calls: string[] = [];
  const source = await traversal(
    fetchOptions(
      {
        [rootUrl]: {
          html: Array.from(
            { length: 25 },
            (_, i) => `<a href="/job/${i}">Job ${i}</a>`,
          ).join(""),
        },
        "https://employer.example.test/job/0": {
          html: '<a href="/job/deeper">Deeper job</a>',
        },
        "https://employer.example.test/job/1": { html: posting },
      },
      calls,
    ),
    {
      limits: {
        maxPending: 2,
        maxLinksPerPage: 20,
        maxVisited: 3,
        maxDepth: 1,
      },
    },
  );
  const run = await runDiscovery({
    repository: repo,
    adapters: [source],
    bounds,
    now: () => current,
  });
  assert.equal(calls.length, 3);
  assert.equal(run.sources[0]?.checkpoint?.excessLinks, 24);
  assert.equal(run.sources[0]?.checkpoint?.visited.length, 3);
  assert.equal(run.sources[0]?.checkpoint?.pending.length, 0);
  const onePage = await traversal(
    fetchOptions({ [rootUrl]: { html: '<a href="/job/0">Job</a>' } }),
    { limits: { maxDepth: 0 } },
  );
  const second = await runDiscovery({
    repository: repository(t),
    adapters: [onePage],
    bounds,
    now: () => current,
  });
  assert.equal(second.sources[0]?.attempts, 1);
});

test("403, authentication/CAPTCHA and missing-page failures stay page-local so siblings progress", async (t) => {
  const repo = repository(t);
  const calls: string[] = [];
  const source = await traversal(
    fetchOptions(
      {
        [rootUrl]: {
          html: '<a href="/job/403">Job</a><a href="/job/captcha">Job</a><a href="/job/404">Job</a><a href="/job/good">Job</a>',
        },
        "https://employer.example.test/job/403": { status: 403 },
        "https://employer.example.test/job/captcha": {
          html: '<h1>Verify you are human</h1><div class="g-recaptcha"></div>',
        },
        "https://employer.example.test/job/404": { status: 404 },
        "https://employer.example.test/job/good": { html: posting },
      },
      calls,
    ),
  );
  const run = await runDiscovery({
    repository: repo,
    adapters: [source],
    bounds,
    now: () => current,
  });
  assert.equal(run.status, "completed");
  assert.equal(calls.length, 5);
  assert.equal(
    repo.read().jobs.filter((job) => job.observation.kind === "unavailable")
      .length,
    3,
  );
  assert.equal(
    repo.read().jobs.filter((job) => job.observation.kind === "vacancy_detail")
      .length,
    1,
  );
});

test("429 retains target and frontier across restart and Berlin midnight while cooldown stops dispatch", async (t) => {
  const repo = repository(t);
  const initial = new Date("2026-10-19T21:59:50Z");
  const seedObservation = await seed();
  const calls: string[] = [];
  let limited = true;
  const options = fetchOptions(
    {
      [rootUrl]: {
        html: '<a href="/job/limited">Job</a><a href="/job/sibling">Job</a>',
      },
      "https://employer.example.test/job/sibling": { html: posting },
    },
    calls,
    {
      transport: async ({ url }) => {
        calls.push(url.href);
        return {
          status: url.pathname === "/job/limited" && limited ? 429 : 200,
          headers: { "content-type": "text/html", "retry-after": "invalid" },
          body: Buffer.from(
            url.pathname === "/careers"
              ? '<a href="/job/limited">Job</a><a href="/job/sibling">Job</a>'
              : posting,
          ),
        };
      },
    },
  );
  const make = () =>
    createCareerTraversalAdapter({
      sourceId: "public",
      sourcePolicyRef: "synthetic-public-policy",
      seeds: [seedObservation],
      fetchOptions: options,
    });
  const first = await runDiscovery({
    repository: repo,
    adapters: [make()],
    bounds,
    now: () => initial,
  });
  assert.equal(
    first.sources[0]?.checkpoint?.pending[0]?.url,
    "https://employer.example.test/job/limited",
  );
  assert.equal(calls.length, 2);
  const restarted = new FileDiscoveryRepository(join(repo.directory, "../.."));
  const second = await runDiscovery({
    repository: restarted,
    adapters: [make()],
    bounds,
    now: () => new Date("2026-10-19T22:00:10Z"),
  });
  assert.equal(second.sources[0]?.attempts, 0);
  assert.equal(calls.length, 2);
  limited = false;
  await runDiscovery({
    repository: restarted,
    adapters: [make()],
    bounds,
    now: () => new Date("2026-10-19T22:01:00Z"),
  });
  assert.deepEqual(calls.slice(2), [
    "https://employer.example.test/job/limited",
    "https://employer.example.test/job/sibling",
  ]);
  assert.equal(restarted.read().jobs.length, 3);
});

test("expired queued evidence is physically removed from every historical run and never dispatched", async (t) => {
  const repo = repository(t);
  const calls: string[] = [];
  const source = await traversal(
    fetchOptions(
      { [rootUrl]: { html: '<a href="/job/later">Job</a>' } },
      calls,
    ),
  );
  await runDiscovery({
    repository: repo,
    adapters: [source],
    bounds: { ...bounds, maxStepsPerSource: 1 },
    now: () => current,
  });
  assert.equal(repo.read().runs[0]?.sources[0]?.checkpoint?.pending.length, 1);
  const later = new Date("2026-10-20T10:00:01Z");
  await runDiscovery({
    repository: repo,
    adapters: [source],
    bounds: { ...bounds, maxStepsPerSource: 1 },
    now: () => later,
  });
  const state = repo.read();
  assert.equal(calls.length, 1);
  assert.ok(
    state.runs.every((run) =>
      run.sources.every((progress) => progress.checkpoint === undefined),
    ),
  );
  assert.equal(JSON.stringify(state).includes("/job/later"), false);
  assert.equal(state.jobs.length, 0);
});

test("source-specific retention shortens descendants and malformed/future provenance is rejected", async (t) => {
  const repo = repository(t);
  const source = await traversal(
    fetchOptions({ [rootUrl]: { html: '<a href="/job/later">Job</a>' } }),
    { retentionUntil: () => "2026-10-19T10:01:00Z" },
  );
  const run = await runDiscovery({
    repository: repo,
    adapters: [source],
    bounds: { ...bounds, maxStepsPerSource: 1 },
    now: () => current,
  });
  assert.equal(
    run.sources[0]?.checkpoint?.pending[0]?.expiresAt,
    "2026-10-19T10:01:00.000Z",
  );
  assert.equal(
    repo.read().jobs[0]?.observation.retentionUntil,
    "2026-10-19T10:01:00.000Z",
  );
  const lead = await seed();
  assert.equal(
    observationSchema.safeParse({ ...lead, observedAt: "2026-10-19T09:00:00Z" })
      .success,
    false,
  );
  const checkpoint = structuredClone(source.initialCheckpoint);
  assert.ok(checkpoint);
  const pending = checkpoint.pending[0];
  assert.ok(pending);
  checkpoint.pending[0] = { ...pending, expiresAt: "2026-10-21T00:00:00Z" };
  assert.equal(traversalCheckpointSchema.safeParse(checkpoint).success, false);
});

test("accounting/ownership refusal halts without fake page observation or lost frontier", async (t) => {
  const repo = repository(t);
  const calls: string[] = [];
  const source = await traversal(
    fetchOptions({ [rootUrl]: { html: posting } }, calls, {
      beforeRequest: async () => {
        throw new Error("accounting_refused");
      },
    }),
  );
  const run = await runDiscovery({
    repository: repo,
    adapters: [source],
    bounds,
    now: () => current,
  });
  assert.equal(run.sources[0]?.status, "failed");
  assert.equal(run.sources[0]?.checkpoint?.pending[0]?.url, rootUrl);
  assert.equal(run.sources[0]?.requestReservations.length, 1);
  assert.equal(repo.read().jobs.length, 0);
  assert.equal(calls.length, 0);
  const repo2 = repository(t);
  repo2.transact((state) => {
    state.originOwners["https://employer.example.test"] = "another-source";
  });
  const other = await traversal(
    fetchOptions({ [rootUrl]: { html: posting } }, calls),
  );
  const denied = await runDiscovery({
    repository: repo2,
    adapters: [other],
    bounds,
    now: () => current,
  });
  assert.equal(denied.sources[0]?.checkpoint?.pending.length, 1);
  assert.equal(repo2.read().jobs.length, 0);
  assert.equal(calls.length, 0);
});

test("frontier and observation rollback together when ingestion fails", async (t) => {
  const repo = repository(t);
  const source = await traversal(
    fetchOptions({ [rootUrl]: { html: posting } }),
  );
  const broken: DiscoveryAdapter = {
    ...source,
    async step(cursor, context) {
      const result = await source.step(cursor, context);
      const observation = result.observations[0];
      assert.ok(observation);
      return {
        ...result,
        observations: [
          observation,
          { ...observation, observedAt: "2026-10-19T09:00:00Z" },
        ],
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
  assert.equal(
    repo.read().runs[0]?.sources[0]?.checkpoint?.pending[0]?.url,
    rootUrl,
  );
});

test("fenced recovery rejects a late traversal frontier and observation completion", async (t) => {
  const repo = repository(t);
  let release: (() => void) | undefined;
  let entered: (() => void) | undefined;
  const enteredPromise = new Promise<void>((resolve) => {
    entered = resolve;
  });
  const stalled = new Promise<void>((resolve) => {
    release = resolve;
  });
  const source = await traversal(
    fetchOptions({ [rootUrl]: { html: posting } }),
  );
  let count = 0;
  const worker: DiscoveryAdapter = {
    ...source,
    async step(cursor, context) {
      count++;
      if (count === 1) {
        entered?.();
        await stalled;
      }
      return source.step(cursor, context);
    },
  };
  const first = runDiscovery({
    repository: repo,
    adapters: [worker],
    bounds,
    now: () => current,
  });
  await enteredPromise;
  const run = repo.read().runs[0];
  assert.ok(run?.fence);
  recoverRun(repo, run.runId, run.fence, current);
  await runDiscovery({
    repository: repo,
    adapters: [worker],
    bounds,
    now: () => current,
  });
  release?.();
  await assert.rejects(first, /run_fence_lost/);
  assert.equal(repo.read().jobs.length, 1);
  assert.equal(repo.read().runs[0]?.sources[0]?.checkpoint?.pending.length, 0);
});

test("old observations/state and static adapters remain compatible without hash defaults", async (t) => {
  const observation = syntheticObservation();
  assert.deepEqual(observationSchema.parse(observation), observation);
  const state = emptyState();
  const original = ingestObservation(state, observation);
  assert.equal(
    stateSchema.parse(state).jobs[0]?.currentRevisionId,
    revisionIdentity(observation),
  );
  assert.equal(
    Object.hasOwn(
      stateSchema.parse(state).jobs[0]?.observation ?? {},
      "discoveryProvenance",
    ),
    false,
  );
  const repo = repository(t);
  const old: DiscoveryAdapter = {
    sourceId: "synthetic-public-pages",
    version: "legacy",
    async step() {
      return { observations: [observation], done: true, nextCursor: null };
    },
  };
  await runDiscovery({
    repository: repo,
    adapters: [old],
    bounds,
    now: () => current,
  });
  assert.equal(
    repo.read().jobs[0]?.currentRevisionId,
    original.job.currentRevisionId,
  );
  assert.equal(
    Object.hasOwn(repo.read().runs[0]?.sources[0] ?? {}, "checkpoint"),
    false,
  );
  pruneExpired(state, current);
  assert.equal(state.jobs.length, 1);
});

test("reviewed operator roots need no search provider, preserve source identity and obey per-hop retention", async (t) => {
  const repo = repository(t);
  const calls: string[] = [];
  const source = createCareerTraversalAdapter({
    sourceId: "operator-public",
    sourcePolicyRef: "reviewed-root-policy",
    seeds: [
      {
        url: `${rootUrl}#original`,
        seedRef: "root-review-1",
        sourcePolicyRef: "reviewed-root-policy",
        observedAt: current.toISOString(),
        retentionUntil: expires,
      },
    ],
    fetchOptions: fetchOptions(
      {
        [rootUrl]: {
          status: 302,
          headers: { location: "https://redirect.example.test/jobs" },
        },
        "https://redirect.example.test/jobs": {
          status: 302,
          headers: { location: "https://ats.other.test/job" },
        },
        "https://ats.other.test/job": { html: posting },
      },
      calls,
    ),
    retentionUntil: (url) =>
      url.hostname === "redirect.example.test"
        ? "2026-10-19T10:01:00Z"
        : expires,
  });
  await runDiscovery({
    repository: repo,
    adapters: [source],
    bounds,
    now: () => current,
  });
  assert.equal(calls.length, 3);
  const observation = repo.read().jobs[0]?.observation;
  assert.equal(observation?.originalUrl, `${rootUrl}#original`);
  assert.equal(observation?.discoveryProvenance?.kind, "operator_seed");
  assert.equal(observation?.retentionUntil, "2026-10-19T10:01:00.000Z");
  assert.equal(observation?.kind, "vacancy_detail");
});

test("fresh parent/search capture timestamps do not create content revisions, while changed anchor evidence does", async () => {
  const first = await seed();
  const provenance = first.discoveryProvenance;
  assert.ok(provenance?.kind === "search_result");
  const repeat = observationSchema.parse({
    ...first,
    observedAt: "2026-10-19T11:00:00Z",
    retentionUntil: "2026-10-20T11:00:00Z",
    discoveryProvenance: {
      ...provenance,
      snapshotId: "next-capture",
      capturedAt: "2026-10-19T11:00:00Z",
      retentionUntil: "2026-10-20T11:00:00Z",
    },
  });
  assert.equal(revisionIdentity(first), revisionIdentity(repeat));
  const parent = observationSchema.parse({
    ...syntheticObservation(),
    discoveryProvenance: {
      kind: "parent_anchor",
      parentSourceId: "public",
      parentSourceRecordId: rootUrl,
      parentObservedAt: current.toISOString(),
      retentionUntil: expires,
      evidence: { url: rootUrl, selector: "a[href]", quote: "Student role" },
    },
    retentionUntil: expires,
  });
  const parentRepeat = observationSchema.parse({
    ...parent,
    observedAt: "2026-10-19T11:00:00Z",
    retentionUntil: "2026-10-20T11:00:00Z",
    discoveryProvenance: {
      ...parent.discoveryProvenance,
      parentObservedAt: "2026-10-19T11:00:00Z",
      retentionUntil: "2026-10-20T11:00:00Z",
    },
  });
  assert.equal(revisionIdentity(parent), revisionIdentity(parentRepeat));
  assert.ok(parentRepeat.discoveryProvenance?.kind === "parent_anchor");
  const changed = observationSchema.parse({
    ...parentRepeat,
    discoveryProvenance: {
      ...parentRepeat.discoveryProvenance,
      evidence: {
        ...parentRepeat.discoveryProvenance.evidence,
        quote: "A different role",
      },
    },
  });
  assert.notEqual(revisionIdentity(parentRepeat), revisionIdentity(changed));
  const state = emptyState();
  ingestObservation(state, first);
  ingestObservation(state, repeat);
  assert.equal(state.jobs.length, 1);
  assert.equal(state.revisions.length, 1);
});

test("durable origin spacing survives reconstruction and starts after delayed accounting confirmation", async (t) => {
  const repo = repository(t);
  let time = new Date(current);
  const calls: string[] = [];
  const lead = await seed();
  let delayAccounting = true;
  const options = fetchOptions(
    {
      [rootUrl]: { html: '<a href="/job/next">Job</a>' },
      "https://employer.example.test/job/next": { html: posting },
    },
    calls,
    {
      minOriginIntervalMs: 1000,
      beforeRequest: async () => {
        if (delayAccounting) {
          time = new Date(current.getTime() + 5000);
          delayAccounting = false;
        }
      },
    },
  );
  const make = () =>
    createCareerTraversalAdapter({
      sourceId: "public",
      sourcePolicyRef: "synthetic-public-policy",
      seeds: [lead],
      fetchOptions: options,
    });
  const source = make();
  let steps = 0;
  const firstWorker: DiscoveryAdapter = {
    ...source,
    async step(cursor, context) {
      if (++steps > 1) throw new Error("synthetic_worker_stopped");
      return source.step(cursor, context);
    },
  };
  await runDiscovery({
    repository: repo,
    adapters: [firstWorker],
    bounds,
    now: () => time,
  });
  const allowed =
    repo.read().originNextAllowedAt?.["https://employer.example.test"];
  assert.ok(allowed);
  assert.ok(Date.parse(allowed) >= current.getTime() + 6000);
  assert.equal(calls.length, 1);
  const paused = await runDiscovery({
    repository: repo,
    adapters: [make()],
    bounds,
    now: () => time,
  });
  assert.equal(calls.length, 1);
  assert.equal(
    paused.sources[0]?.checkpoint?.pending[0]?.url,
    "https://employer.example.test/job/next",
  );
  assert.equal(paused.sources[0]?.retryAt, allowed);
  time = new Date(Date.parse(allowed) + 1);
  await runDiscovery({
    repository: repo,
    adapters: [make()],
    bounds,
    now: () => time,
  });
  assert.equal(calls.length, 2);
  assert.equal(repo.read().jobs.length, 2);
});

test("default origin interval allows a healthy multi-page traversal in one bounded run", async (t) => {
  const repo = repository(t);
  const calls: string[] = [];
  const source = await traversal(
    fetchOptions(
      {
        [rootUrl]: { html: '<a href="/job/next">Job</a>' },
        "https://employer.example.test/job/next": { html: posting },
      },
      calls,
      { minOriginIntervalMs: 1000 },
    ),
  );
  const run = await runDiscovery({
    repository: repo,
    adapters: [source],
    bounds,
    now: () => current,
  });
  assert.equal(run.status, "completed");
  assert.equal(calls.length, 2);
});

test("late accounting never sends or confirms after traversal timeout", async (t) => {
  const repo = repository(t);
  const calls: string[] = [];
  let release: (() => void) | undefined;
  const blocked = new Promise<void>((resolve) => {
    release = resolve;
  });
  const source = await traversal(
    fetchOptions({ [rootUrl]: { html: posting } }, calls, {
      beforeRequest: async () => {
        await blocked;
      },
    }),
  );
  const run = await runDiscovery({
    repository: repo,
    adapters: [source],
    bounds: { ...bounds, maxDurationMs: 100 },
    now: () => current,
  });
  assert.equal(run.sources[0]?.checkpoint?.pending[0]?.url, rootUrl);
  release?.();
  await new Promise<void>((resolve) => setImmediate(resolve));
  assert.equal(calls.length, 0);
  assert.equal(repo.read().jobs.length, 0);
});

test("missing checkpoint fails closed with an explicit source diagnostic", async (t) => {
  const repo = repository(t);
  const calls: string[] = [];
  const source = await traversal(
    fetchOptions({ [rootUrl]: { html: posting } }, calls),
  );
  const worker: DiscoveryAdapter = {
    sourceId: source.sourceId,
    version: source.version,
    step: source.step,
  };
  const run = await runDiscovery({
    repository: repo,
    adapters: [worker],
    bounds,
    now: () => current,
  });
  assert.equal(run.status, "partial");
  assert.equal(run.sources[0]?.error, "source_checkpoint_unavailable");
  assert.equal(calls.length, 0);
});

test("twenty-link and sixty-four-entry frontier limits retain explicit truncation diagnostics", async (t) => {
  const calls: string[] = [];
  const routes: Record<string, Route> = {
    [rootUrl]: {
      html: Array.from(
        { length: 25 },
        (_, i) => `<a href="/jobs/${i}">Jobs</a>`,
      ).join(""),
    },
  };
  for (let i = 0; i < 4; i++)
    routes[`https://employer.example.test/jobs/${i}`] = {
      html: Array.from(
        { length: 20 },
        (_, j) => `<a href="/job/${i}/${j}">Job</a>`,
      ).join(""),
    };
  const source = await traversal(fetchOptions(routes, calls));
  const run = await runDiscovery({
    repository: repository(t),
    adapters: [source],
    bounds: { ...bounds, maxStepsPerSource: 5 },
    now: () => current,
  });
  const checkpoint = run.sources[0]?.checkpoint;
  assert.equal(calls.length, 5);
  assert.equal(checkpoint?.pending.length, 64);
  assert.ok(checkpoint.excessLinks > 5);
  assert.ok(checkpoint.limitsReached?.includes("links"));
  assert.ok(checkpoint.limitsReached?.includes("pending"));
  assert.ok(checkpoint.pending.every((entry) => entry.depth <= 2));
});

test("mixed-retention pruning cannot turn an expired unfinished frontier into successful completion", async (t) => {
  const repo = repository(t);
  const calls: string[] = [];
  const source = createCareerTraversalAdapter({
    sourceId: "public",
    sourcePolicyRef: "synthetic-public-policy",
    seeds: [
      {
        url: rootUrl,
        seedRef: "long-root",
        sourcePolicyRef: "synthetic-public-policy",
        observedAt: current.toISOString(),
        retentionUntil: "2026-10-21T10:00:00Z",
      },
      {
        url: "https://other.example.test/jobs",
        seedRef: "short-root",
        sourcePolicyRef: "synthetic-public-policy",
        observedAt: current.toISOString(),
        retentionUntil: "2026-10-19T10:01:00Z",
      },
    ],
    fetchOptions: fetchOptions(
      {
        [rootUrl]: { html: posting },
        "https://other.example.test/jobs": {
          html: '<a href="/job/short">Job</a>',
        },
      },
      calls,
    ),
  });
  await runDiscovery({
    repository: repo,
    adapters: [source],
    bounds: { ...bounds, maxStepsPerSource: 2 },
    now: () => current,
  });
  const next = await runDiscovery({
    repository: repo,
    adapters: [source],
    bounds: { ...bounds, maxStepsPerSource: 2 },
    now: () => new Date("2026-10-20T10:00:00Z"),
  });
  assert.equal(calls.length, 2);
  assert.equal(next.status, "partial");
  assert.equal(next.sources[0]?.error, "source_checkpoint_expired");
  assert.equal(next.sources[0]?.checkpoint?.expiredTargets, 1);
  assert.equal(JSON.stringify(repo.read()).includes("/job/short"), false);
});

test("vacancy anchors in main content outrank earlier job-domain navigation within the link budget", async (t) => {
  const repo = repository(t);
  const calls: string[] = [];
  const root = "https://jobs.board.example.test/";
  const source = createCareerTraversalAdapter({
    sourceId: "public",
    sourcePolicyRef: "synthetic-public-policy",
    seeds: [
      {
        url: root,
        seedRef: "reviewed-board",
        sourcePolicyRef: "synthetic-public-policy",
        observedAt: current.toISOString(),
        retentionUntil: expires,
      },
    ],
    limits: { maxLinksPerPage: 2, maxDepth: 1 },
    fetchOptions: fetchOptions(
      {
        [root]: {
          html: `
      <header><a href="/">Job Board</a><nav>
        <a href="/">Home</a><a href="/about-us">About Job Board</a>
        <a href="/publish-job">Publish a job</a><a href="/employer/signup">Employer signup</a>
        <a href="/careers">Careers</a><a href="/jobs/featured">Featured jobs</a>
      </nav></header>
      <main>
        <article class="job-card"><a href="/jobs/barista-123">Barista</a></article>
        <article class="job-card"><a href="/open?job_id=456&lang=en">Student Assistant</a></article>
        <a href="/privacy?job_id=tracking">Privacy</a>
      </main><footer><a href="/legal">Job Board legal</a></footer>`,
        },
        "https://jobs.board.example.test/jobs/barista-123": { html: posting },
        "https://jobs.board.example.test/open?job_id=456&lang=en": {
          html: posting,
        },
      },
      calls,
    ),
  });
  const run = await runDiscovery({
    repository: repo,
    adapters: [source],
    bounds,
    now: () => current,
  });
  assert.deepEqual(calls, [
    root,
    "https://jobs.board.example.test/jobs/barista-123",
    "https://jobs.board.example.test/open?job_id=456&lang=en",
  ]);
  assert.equal(
    repo.read().jobs.filter((job) => job.observation.kind === "vacancy_detail")
      .length,
    2,
  );
  assert.ok(run.sources[0]?.checkpoint?.limitsReached?.includes("links"));
  assert.ok(source.version.startsWith("career-traversal-v2-"));
});

test("job host names alone do not make about, publishing or employer service links career candidates", async (t) => {
  const repo = repository(t);
  const calls: string[] = [];
  const root = "https://jobs.board.example.test/";
  const source = createCareerTraversalAdapter({
    sourceId: "public",
    sourcePolicyRef: "synthetic-public-policy",
    seeds: [
      {
        url: root,
        seedRef: "reviewed-board",
        sourcePolicyRef: "synthetic-public-policy",
        observedAt: current.toISOString(),
        retentionUntil: expires,
      },
    ],
    fetchOptions: fetchOptions(
      {
        [root]: {
          html: `<main>
      <a href="/about-us">About Job Board</a><a href="/post-a-job">Post a job</a>
      <a href="/employers/register">Employer signup for jobs</a><a href="/impressum">Job Board legal</a>
      <a href="/contact">Contact</a><a href="/news">News</a>
    </main>`,
        },
      },
      calls,
    ),
  });
  const run = await runDiscovery({
    repository: repo,
    adapters: [source],
    bounds,
    now: () => current,
  });
  assert.equal(run.status, "completed");
  assert.deepEqual(calls, [root]);
  assert.equal(run.sources[0]?.checkpoint?.pending.length, 0);
});

test("nested career links remain available as navigation fallback and external query vacancies stay intact", async (t) => {
  const repo = repository(t);
  const calls: string[] = [];
  const source = await traversal(
    fetchOptions(
      {
        [rootUrl]: { html: '<nav><a href="/about/careers">Careers</a></nav>' },
        "https://employer.example.test/about/careers": {
          html: '<main><article class="job-card"><a href="https://new-ats.example.test/open?id=42&lang=en#description">Kitchen staff</a></article></main>',
        },
        "https://new-ats.example.test/open?id=42&lang=en": { html: posting },
      },
      calls,
    ),
    { limits: { maxLinksPerPage: 1 } },
  );
  await runDiscovery({
    repository: repo,
    adapters: [source],
    bounds,
    now: () => current,
  });
  assert.deepEqual(calls, [
    rootUrl,
    "https://employer.example.test/about/careers",
    "https://new-ats.example.test/open?id=42&lang=en",
  ]);
  assert.equal(
    repo.read().jobs.at(-1)?.observation.originalUrl,
    "https://new-ats.example.test/open?id=42&lang=en#description",
  );
});

test("equally ranked main vacancy links retain document order rather than reorder IDs or query values", async (t) => {
  const repo = repository(t);
  const calls: string[] = [];
  const source = await traversal(
    fetchOptions(
      {
        [rootUrl]: {
          html: '<main><a href="/job?id=z">Student job</a><a href="/job?id=a">Student job</a><a href="/job?id=m">Student job</a></main>',
        },
        "https://employer.example.test/job?id=z": { html: posting },
        "https://employer.example.test/job?id=a": { html: posting },
      },
      calls,
    ),
    { limits: { maxLinksPerPage: 2 } },
  );
  await runDiscovery({
    repository: repo,
    adapters: [source],
    bounds,
    now: () => current,
  });
  assert.deepEqual(calls, [
    rootUrl,
    "https://employer.example.test/job?id=z",
    "https://employer.example.test/job?id=a",
  ]);
});
