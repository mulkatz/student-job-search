import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { type Manifest, manifestHash } from "@job-search/experiment";
import {
  authorizePaidAttemptRetry,
  type BraveAccess,
  type BraveAttemptSummary,
  type BraveSearchRequest,
  createBraveSearchAdapter,
  createCareerTraversalAdapter,
  FileDiscoveryRepository,
  recoverRun,
  revisionIdentity,
  runDiscovery,
} from "../src/index.js";

const current = new Date("2026-10-19T10:00:00Z");
const bounds = {
  maxStepsPerSource: 10,
  maxRequestsPerSource: 20,
  maxDurationMs: 60000,
};
const key = "synthetic-test-token";
const leadUrl = "https://employer.example.test/careers?lang=en#jobs";
function manifest(): Manifest {
  return {
    version: 1,
    queries: Array.from({ length: 20 }, (_, index) => ({
      id: `query_${index}`,
      stream: index < 10 ? "berlin" : "germany_remote",
      query: `synthetic frozen query ${index} jobs`,
    })),
  };
}
function access(): BraveAccess {
  return {
    operatorAuthorizationRef: "synthetic-operator-instruction",
    providerGrant: "unverified",
    decisionRef: "docs/adr/0016-private-brave-operator-authorization.md",
    purpose: "bounded_private_discovery",
    retain: "urls_and_provenance_only",
    expiresAt: "2026-10-20T10:00:00Z",
  };
}
function repository(t: { after: (fn: () => void) => void }) {
  const root = mkdtempSync(join(tmpdir(), "brave-test-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  return new FileDiscoveryRepository(root);
}
function response(results: unknown[] = [{ url: leadUrl }]) {
  return new Response(
    JSON.stringify({
      type: "search",
      query: { original: manifest().queries[0]?.query },
      web: { results },
    }),
    { headers: { "content-type": "application/json" } },
  );
}
function make(
  extra: Partial<Parameters<typeof createBraveSearchAdapter>[0]> = {},
) {
  return createBraveSearchAdapter({
    sourceId: "brave",
    access: access(),
    manifest: manifest(),
    pages: [{ queryId: "query_0", offset: 0 }],
    apiKey: key,
    liveOptIn: true,
    beforeRequest: async () => {},
    afterAttempt: async () => {},
    fetchImpl: async () => response(),
    ...extra,
  });
}

test("Brave uses exact frozen query and fixed header-only endpoint, while retaining URL provenance only", async (t) => {
  const repo = repository(t);
  const requests: BraveSearchRequest[] = [];
  const summaries: BraveAttemptSummary[] = [];
  const source = make({
    beforeRequest: async (request) => {
      requests.push(request);
    },
    afterAttempt: async (summary) => {
      summaries.push(summary);
    },
    fetchImpl: async (input, options) => {
      const url = new URL(String(input));
      assert.equal(
        `${url.origin}${url.pathname}`,
        "https://api.search.brave.com/res/v1/web/search",
      );
      assert.equal(url.searchParams.get("q"), manifest().queries[0]?.query);
      assert.equal(url.searchParams.get("count"), "10");
      assert.equal(url.searchParams.get("offset"), "0");
      assert.equal(url.searchParams.get("country"), "DE");
      assert.deepEqual([...url.searchParams.keys()].sort(), [
        "count",
        "country",
        "offset",
        "q",
        "result_filter",
      ]);
      assert.equal(String(input).includes(key), false);
      assert.equal(options?.redirect, "error");
      assert.equal(options?.credentials, "omit");
      assert.equal(
        new Headers(options?.headers).get("X-Subscription-Token"),
        key,
      );
      return response([
        {
          url: leadUrl,
          title: "RAW_PROVIDER_TITLE",
          description: "RAW_PROVIDER_SNIPPET",
          extra_snippets: ["RAW_EXTRA_SNIPPET"],
          schemas: [{ englishAccepted: true }],
        },
      ]);
    },
  });
  const run = await runDiscovery({
    repository: repo,
    adapters: [source],
    bounds,
    now: () => current,
  });
  assert.equal(run.status, "completed");
  assert.equal(run.sources[0]?.paidAttempt, undefined);
  assert.equal(requests.length, 1);
  assert.equal(summaries[0]?.outcome, "response_received");
  assert.equal(summaries[0]?.reason, "completed");
  assert.equal(summaries[0]?.manifestHash, manifestHash(manifest()));
  const observation = repo.read().jobs[0]?.observation;
  assert.equal(observation?.kind, "search_lead");
  assert.equal(observation?.originalUrl, leadUrl);
  assert.equal(observation?.title, null);
  assert.equal(observation?.employer, null);
  assert.equal(observation?.discoveryProvenance?.kind, "brave_search_result");
  if (observation?.discoveryProvenance?.kind === "brave_search_result")
    assert.equal(observation.discoveryProvenance.providerGrant, "unverified");
  const retained = JSON.stringify({
    state: repo.read(),
    summaries,
    requests,
    version: source.version,
  });
  for (const forbidden of [
    key,
    "RAW_PROVIDER_TITLE",
    "RAW_PROVIDER_SNIPPET",
    "RAW_EXTRA_SNIPPET",
    manifest().queries[0]?.query ?? "",
  ])
    assert.equal(retained.includes(forbidden), false);
});

test("Brave constructor strictly validates manifest/page/access configuration before dispatch", () => {
  assert.throws(
    () => make({ pages: [{ queryId: "unknown", offset: 0 }] }),
    /invalid_brave_pages/,
  );
  assert.throws(() => make({ pages: [{ queryId: "query_0", offset: 10 }] }));
  assert.throws(
    () =>
      make({
        pages: [
          { queryId: "query_0", offset: 0 },
          { queryId: "query_0", offset: 0 },
        ],
      }),
    /invalid_brave_pages/,
  );
  assert.throws(() =>
    make({
      manifest: { ...manifest(), queries: manifest().queries.slice(0, 19) },
    }),
  );
  const injectedPage = { queryId: "query_0", offset: 0, query: "changed" };
  assert.throws(() => make({ pages: [injectedPage] }));
  const injectedAccess = {
    ...access(),
    permissionRef: "pretend-provider-grant",
  };
  assert.throws(() => make({ access: injectedAccess }));
  const unknownConfig = {
    sourceId: "brave",
    endpoint: "https://other.example.test/steal",
  };
  assert.throws(() => make(unknownConfig), /invalid_brave_configuration/);
});

test("Brave rejects unsafe/malformed URLs and deduplicates exact query+URL identity without retaining snippets", async (t) => {
  const summaries: BraveAttemptSummary[] = [];
  const repo = repository(t);
  const source = make({
    afterAttempt: async (summary) => {
      summaries.push(summary);
    },
    fetchImpl: async () =>
      response([
        { url: leadUrl },
        { url: leadUrl },
        { url: "http://169.254.169.254/latest" },
        { url: "https://user:password@other.example.test/job" },
        { url: "javascript:alert(1)" },
        { url: "https://employer.example.test/job?id=2" },
        { title: "Missing URL" },
      ]),
  });
  await runDiscovery({
    repository: repo,
    adapters: [source],
    bounds,
    now: () => current,
  });
  assert.equal(repo.read().jobs.length, 2);
  assert.equal(summaries[0]?.rejectedRecords, 4);
  assert.equal(summaries[0]?.returnedRecords, 2);
  const nextRepo = repository(t);
  await runDiscovery({
    repository: nextRepo,
    adapters: [
      make({
        fetchImpl: async () =>
          response([
            { url: "https://employer.example.test/job?id=2" },
            { url: leadUrl },
          ]),
      }),
    ],
    bounds,
    now: () => new Date("2026-10-19T11:00:00Z"),
  });
  const first = repo
    .read()
    .jobs.find((job) => job.observation.originalUrl === leadUrl);
  const repeat = nextRepo
    .read()
    .jobs.find((job) => job.observation.originalUrl === leadUrl);
  assert.equal(first?.jobId, repeat?.jobId);
  assert.ok(first && repeat);
  assert.equal(
    revisionIdentity(first.observation),
    revisionIdentity(repeat.observation),
  );
});

test("paid HTTP failures, redirect responses and malformed payloads retain exact attempt for reconciliation", async (t) => {
  for (const failure of [
    () => new Response("untrusted error body", { status: 500 }),
    () =>
      new Response("", {
        status: 302,
        headers: { location: "https://other.example.test/steal" },
      }),
    () =>
      new Response("{", { headers: { "content-type": "application/json" } }),
  ]) {
    const repo = repository(t);
    const summaries: BraveAttemptSummary[] = [];
    let calls = 0;
    const source = make({
      fetchImpl: async () => {
        calls++;
        return failure();
      },
      afterAttempt: async (summary) => {
        summaries.push(summary);
      },
    });
    await runDiscovery({
      repository: repo,
      adapters: [source],
      bounds,
      now: () => current,
    });
    assert.equal(summaries[0]?.outcome, "response_received");
    assert.ok(repo.read().runs[0]?.sources[0]?.paidAttempt);
    assert.equal(repo.read().jobs.length, 0);
    await runDiscovery({
      repository: repo,
      adapters: [source],
      bounds,
      now: () => current,
    });
    assert.equal(calls, 1);
    assert.equal(summaries.length, 1);
    assert.equal(
      repo.read().runs[0]?.sources[0]?.error,
      "source_search_reconciliation_required",
    );
  }
});

test("429 persists cooldown and unresolved paid marker across restart, midnight and changed adapter contracts", async (t) => {
  const repo = repository(t);
  let calls = 0;
  const source = () =>
    make({
      fetchImpl: async () => {
        calls++;
        return new Response("", {
          status: 429,
          headers: { "retry-after": "invalid" },
        });
      },
    });
  const first = await runDiscovery({
    repository: repo,
    adapters: [source()],
    bounds,
    now: () => new Date("2026-10-19T21:59:50Z"),
  });
  const attemptId = first.sources[0]?.paidAttempt?.attemptId;
  assert.ok(attemptId);
  const second = await runDiscovery({
    repository: repo,
    adapters: [source()],
    bounds,
    now: () => new Date("2026-10-19T22:00:10Z"),
  });
  assert.equal(second.sources[0]?.attempts, 0);
  assert.equal(second.sources[0]?.paidAttempt?.attemptId, attemptId);
  const third = await runDiscovery({
    repository: repo,
    adapters: [source()],
    bounds,
    now: () => new Date("2026-10-19T22:01:10Z"),
  });
  assert.equal(
    third.sources[0]?.error,
    "source_search_reconciliation_required",
  );
  assert.equal(calls, 1);
  await assert.rejects(
    runDiscovery({
      repository: repo,
      adapters: [make({ pages: [{ queryId: "query_1", offset: 0 }] })],
      bounds,
      now: () => new Date("2026-10-20T22:01:10Z"),
    }),
    /paid_attempt_contract_changed/,
  );
});

test("ambiguous transport and accounting failures expose no provider/key error text and never blindly retry", async (t) => {
  for (const beforeRefused of [false, true]) {
    const repo = repository(t);
    const summaries: BraveAttemptSummary[] = [];
    let calls = 0;
    const source = make({
      beforeRequest: async () => {
        if (beforeRefused) throw new Error(key);
      },
      fetchImpl: async () => {
        calls++;
        throw new Error(key);
      },
      afterAttempt: async (summary) => {
        summaries.push(summary);
      },
    });
    await runDiscovery({
      repository: repo,
      adapters: [source],
      bounds,
      now: () => current,
    });
    assert.equal(
      summaries[0]?.outcome,
      beforeRefused ? "not_dispatched" : "ambiguous",
    );
    assert.equal(calls, beforeRefused ? 0 : 1);
    assert.equal(
      JSON.stringify({ state: repo.read(), summaries }).includes(key),
      false,
    );
    await runDiscovery({
      repository: repo,
      adapters: [source],
      bounds,
      now: () => current,
    });
    assert.equal(calls, beforeRefused ? 0 : 1);
  }
});

test("Brave size bounds cover declared and streamed bodies and preserve charged-attempt evidence", async (t) => {
  for (const declare of [true, false]) {
    const repo = repository(t);
    const summaries: BraveAttemptSummary[] = [];
    let cancelled = false;
    const source = make({
      afterAttempt: async (summary) => {
        summaries.push(summary);
      },
      fetchImpl: async () =>
        new Response(
          new ReadableStream<Uint8Array>({
            start(controller) {
              controller.enqueue(new Uint8Array(600_000));
              controller.enqueue(new Uint8Array(600_000));
            },
            cancel() {
              cancelled = true;
            },
          }),
          {
            headers: {
              "content-type": "application/json",
              ...(declare ? { "content-length": "1200000" } : {}),
            },
          },
        ),
    });
    await runDiscovery({
      repository: repo,
      adapters: [source],
      bounds,
      now: () => current,
    });
    assert.equal(summaries[0]?.reason, "response_limit");
    assert.equal(cancelled, true);
    assert.ok(repo.read().runs[0]?.sources[0]?.paidAttempt);
  }
});

test("deadline covers hanging response bodies and late accounting; neither can commit or dispatch late", async (t) => {
  for (const lateBefore of [false, true]) {
    const repo = repository(t);
    const summaries: BraveAttemptSummary[] = [];
    let release: (() => void) | undefined;
    const pending = new Promise<void>((resolve) => {
      release = resolve;
    });
    let calls = 0;
    const source = make({
      beforeRequest: async () => {
        if (lateBefore) await pending;
      },
      afterAttempt: async (summary) => {
        summaries.push(summary);
      },
      fetchImpl: async () => {
        calls++;
        return new Response(new ReadableStream<Uint8Array>({}), {
          headers: { "content-type": "application/json" },
        });
      },
    });
    await runDiscovery({
      repository: repo,
      adapters: [source],
      bounds: { ...bounds, maxDurationMs: 100 },
      now: () => current,
    });
    release?.();
    await new Promise<void>((resolve) => setImmediate(resolve));
    assert.equal(calls, lateBefore ? 0 : 1);
    assert.equal(
      summaries[0]?.outcome,
      lateBefore ? "not_dispatched" : "response_received",
    );
    assert.ok(repo.read().runs[0]?.sources[0]?.paidAttempt);
    assert.equal(repo.read().jobs.length, 0);
  }
});

test("live opt-in and unexpired explicit operator authorization are required", async (t) => {
  for (const extra of [
    { liveOptIn: false },
    { access: { ...access(), expiresAt: "2026-10-19T09:00:00Z" } },
  ]) {
    const repo = repository(t);
    let calls = 0;
    const source = make({
      ...extra,
      fetchImpl: async () => {
        calls++;
        return response();
      },
    });
    await runDiscovery({
      repository: repo,
      adapters: [source],
      bounds,
      now: () => current,
    });
    assert.equal(calls, 0);
    assert.equal(repo.read().runs[0]?.sources[0]?.paidAttempt, undefined);
  }
});

test("same-run Brave -> lazy career traversal discovers external vacancy and initializes frontier once", async (t) => {
  const repo = repository(t);
  let initializations = 0;
  const fetched: string[] = [];
  const search = make();
  const career = createCareerTraversalAdapter({
    sourceId: "public",
    sourcePolicyRef: "synthetic-public-policy",
    seeds: () => {
      initializations++;
      return repo
        .listJobs(current)
        .filter((job) => job.sourceId === "brave")
        .map((job) => job.observation);
    },
    seedVersion: "manifest-v1",
    seedSelectionRef: "retained-brave-results",
    limits: { maxDepth: 1 },
    fetchOptions: {
      liveOptIn: true,
      sourcePolicy: async () => ({
        status: "permitted",
        evidenceRef: "synthetic-source-policy",
      }),
      beforeRequest: async () => {},
      minOriginIntervalMs: 1,
      resolve: async () => [{ address: "93.184.216.34", family: 4 }],
      transport: async ({ url }) => {
        fetched.push(url.href);
        return {
          status: 200,
          headers: { "content-type": "text/html" },
          body: Buffer.from(
            url.hostname === "employer.example.test"
              ? '<a href="https://ats.other.test/job?id=1">Student job</a>'
              : '<script type="application/ld+json">{"@type":"JobPosting","title":"Synthetic role","hiringOrganization":{"name":"Synthetic employer"}}</script>',
          ),
        };
      },
    },
  });
  const run = await runDiscovery({
    repository: repo,
    adapters: [search, career],
    bounds,
    now: () => current,
  });
  assert.equal(run.status, "completed");
  assert.equal(initializations, 1);
  assert.equal(run.sources[1]?.checkpointInitialized, true);
  assert.deepEqual(fetched, [
    "https://employer.example.test/careers?lang=en",
    "https://ats.other.test/job?id=1",
  ]);
  assert.equal(
    repo.read().jobs.filter((job) => job.observation.kind === "vacancy_detail")
      .length,
    1,
  );
  assert.equal(
    repo.read().jobs.at(-1)?.observation.retentionUntil,
    "2026-10-20T10:00:00.000Z",
  );
  await runDiscovery({
    repository: repo,
    adapters: [search, career],
    bounds,
    now: () => current,
  });
  assert.equal(initializations, 1);
});

test("expired or removed lazy frontier cannot invoke seed selection again on restart or next day", async (t) => {
  const repo = repository(t);
  let initializations = 0;
  let calls = 0;
  const career = createCareerTraversalAdapter({
    sourceId: "public",
    sourcePolicyRef: "synthetic-public-policy",
    seeds: () => {
      initializations++;
      return [
        {
          url: leadUrl,
          seedRef: "reviewed-root",
          sourcePolicyRef: "synthetic-public-policy",
          observedAt: current.toISOString(),
          retentionUntil: "2026-10-19T10:01:00Z",
        },
      ];
    },
    seedVersion: "frozen-v1",
    seedSelectionRef: "reviewed-root-selection",
    fetchOptions: {
      liveOptIn: true,
      sourcePolicy: async () => ({
        status: "permitted",
        evidenceRef: "synthetic-public-policy",
      }),
      beforeRequest: async () => {
        throw new Error("synthetic-stop");
      },
      minOriginIntervalMs: 1,
      resolve: async () => [{ address: "93.184.216.34", family: 4 }],
      transport: async () => {
        calls++;
        throw new Error("must_not_dispatch");
      },
    },
  });
  await runDiscovery({
    repository: repo,
    adapters: [career],
    bounds,
    now: () => current,
  });
  assert.equal(initializations, 1);
  repo.transact((state) => {
    const progress = state.runs[0]?.sources[0];
    assert.ok(progress);
    delete progress.checkpoint;
  });
  await runDiscovery({
    repository: repo,
    adapters: [career],
    bounds,
    now: () => current,
  });
  await runDiscovery({
    repository: repo,
    adapters: [career],
    bounds,
    now: () => new Date("2026-10-20T10:00:00Z"),
  });
  assert.equal(initializations, 1);
  assert.equal(calls, 0);
  assert.equal(repo.read().runs[1]?.sources[0]?.checkpointInitialized, true);
});

test("nullable/absent web in a valid search envelope is empty; wrong query or error payload is rejected", async (t) => {
  for (const payload of [
    {
      type: "search",
      query: { original: manifest().queries[0]?.query },
      web: null,
    },
    { type: "search", query: { original: manifest().queries[0]?.query } },
  ]) {
    const repo = repository(t);
    const run = await runDiscovery({
      repository: repo,
      adapters: [
        make({
          fetchImpl: async () =>
            new Response(JSON.stringify(payload), {
              headers: { "content-type": "application/json" },
            }),
        }),
      ],
      bounds,
      now: () => current,
    });
    assert.equal(run.status, "completed");
    assert.equal(repo.read().jobs.length, 0);
    assert.equal(run.sources[0]?.paidAttempt, undefined);
  }
  for (const payload of [
    {},
    { type: "ErrorResponse", error: "unsafe" },
    {
      type: "search",
      query: { original: "mismatched query" },
      web: { results: [{ url: leadUrl }] },
    },
  ]) {
    const repo = repository(t);
    const summaries: BraveAttemptSummary[] = [];
    const run = await runDiscovery({
      repository: repo,
      adapters: [
        make({
          fetchImpl: async () =>
            new Response(JSON.stringify(payload), {
              headers: { "content-type": "application/json" },
            }),
          afterAttempt: async (summary) => {
            summaries.push(summary);
          },
        }),
      ],
      bounds,
      now: () => current,
    });
    assert.equal(run.status, "partial");
    assert.equal(repo.read().jobs.length, 0);
    assert.equal(summaries[0]?.reason, "invalid_payload");
    assert.ok(run.sources[0]?.paidAttempt);
  }
});

test("provider-echoed credentials in URL results are rejected before retention", async (t) => {
  const repo = repository(t);
  await runDiscovery({
    repository: repo,
    adapters: [
      make({
        fetchImpl: async () =>
          response([
            { url: `https://employer.example.test/job?echo=${key}` },
            {
              url: `https://employer.example.test/job?echo=${[...key].map((char) => `%${char.charCodeAt(0).toString(16)}`).join("")}`,
            },
            { url: leadUrl },
          ]),
      }),
    ],
    bounds,
    now: () => current,
  });
  assert.equal(repo.read().jobs.length, 1);
  assert.equal(repo.read().jobs[0]?.observation.originalUrl, leadUrl);
  assert.equal(JSON.stringify(repo.read()).includes(key), false);
});

test("known pages transmit each selected frozen query/offset exactly and do not add pagination", async (t) => {
  const repo = repository(t);
  const calls: string[] = [];
  const source = make({
    pages: [
      { queryId: "query_0", offset: 0 },
      { queryId: "query_10", offset: 2 },
    ],
    fetchImpl: async (input) => {
      const url = new URL(String(input));
      calls.push(
        `${url.searchParams.get("q")}|${url.searchParams.get("offset")}`,
      );
      return new Response(
        JSON.stringify({
          type: "search",
          query: { original: url.searchParams.get("q") },
          web: { results: [] },
        }),
        { headers: { "content-type": "application/json" } },
      );
    },
  });
  const run = await runDiscovery({
    repository: repo,
    adapters: [source],
    bounds,
    now: () => current,
  });
  assert.equal(run.status, "completed");
  assert.deepEqual(calls, [
    `${manifest().queries[0]?.query}|0`,
    `${manifest().queries[10]?.query}|2`,
  ]);
  assert.equal(run.sources[0]?.requestReservations.length, 2);
});

test("afterAttempt or atomic ingestion failure cannot clear paid guard or advance cursor", async (t) => {
  for (const commitFailure of [false, true]) {
    const repo = repository(t);
    let calls = 0;
    const source = make({
      fetchImpl: async () => {
        calls++;
        return response();
      },
      afterAttempt: async () => {
        if (!commitFailure) throw new Error(key);
      },
    });
    const worker = commitFailure
      ? {
          ...source,
          async step(
            cursor: Parameters<typeof source.step>[0],
            context: Parameters<typeof source.step>[1],
          ) {
            const result = await source.step(cursor, context);
            const observation = result.observations[0];
            assert.ok(observation);
            assert.ok(
              observation.discoveryProvenance?.kind === "brave_search_result",
            );
            return {
              ...result,
              observations: [
                observation,
                {
                  ...observation,
                  observedAt: current.toISOString(),
                  discoveryProvenance: {
                    ...observation.discoveryProvenance,
                    capturedAt: current.toISOString(),
                  },
                },
              ],
            };
          },
        }
      : source;
    const run = await runDiscovery({
      repository: repo,
      adapters: [worker],
      bounds,
      now: () => new Date(current.getTime() + 1000),
    });
    assert.equal(run.status, "partial");
    assert.equal(repo.read().jobs.length, 0);
    assert.equal(run.sources[0]?.cursor, null);
    assert.ok(run.sources[0]?.paidAttempt);
    await runDiscovery({
      repository: repo,
      adapters: [worker],
      bounds,
      now: () => new Date(current.getTime() + 1000),
    });
    assert.equal(calls, 1);
  }
});

test("manual paid retry authorization requires latest exact token, retains accounting and records evidence", async (t) => {
  const repo = repository(t);
  let calls = 0;
  const source = make({
    fetchImpl: async () => {
      calls++;
      if (calls === 1) throw new Error("synthetic-ambiguous");
      return response();
    },
  });
  const run = await runDiscovery({
    repository: repo,
    adapters: [source],
    bounds,
    now: () => current,
  });
  const attempt = run.sources[0]?.paidAttempt;
  assert.ok(attempt);
  assert.throws(
    () =>
      authorizePaidAttemptRetry(
        repo,
        {
          runId: run.runId,
          sourceId: "brave",
          attemptId: crypto.randomUUID(),
          evidenceRef: "synthetic-reconciled-ledger",
        },
        current,
      ),
    /paid_retry_attempt_mismatch/,
  );
  authorizePaidAttemptRetry(
    repo,
    {
      runId: run.runId,
      sourceId: "brave",
      attemptId: attempt.attemptId,
      evidenceRef: "synthetic-reconciled-ledger",
    },
    current,
  );
  const authorized = repo.read().runs[0]?.sources[0];
  assert.equal(authorized?.paidAttempt, undefined);
  assert.equal(authorized?.requestReservations.length, 1);
  assert.equal(authorized?.attempts, 1);
  assert.equal(
    authorized?.paidRetryAuthorizations?.[0]?.attemptId,
    attempt.attemptId,
  );
  const resumed = await runDiscovery({
    repository: repo,
    adapters: [source],
    bounds,
    now: () => new Date(current.getTime() + 2000),
  });
  assert.equal(resumed.status, "completed");
  assert.equal(calls, 2);
  assert.equal(resumed.sources[0]?.requestReservations.length, 2);
});

test("fenced paid worker cannot commit late results after recovery and pending attempt prevents a second charge", async (t) => {
  const repo = repository(t);
  let entered: (() => void) | undefined;
  let release: (() => void) | undefined;
  const waiting = new Promise<void>((resolve) => {
    entered = resolve;
  });
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  let calls = 0;
  const source = make({
    fetchImpl: async () => {
      calls++;
      return response();
    },
    afterAttempt: async () => {
      entered?.();
      await gate;
    },
  });
  const first = runDiscovery({
    repository: repo,
    adapters: [source],
    bounds,
    now: () => current,
  });
  await waiting;
  const run = repo.read().runs[0];
  assert.ok(run?.fence);
  assert.throws(
    () =>
      authorizePaidAttemptRetry(
        repo,
        {
          runId: run.runId,
          sourceId: "brave",
          attemptId: run.sources[0]?.paidAttempt?.attemptId ?? "",
          evidenceRef: "synthetic-evidence",
        },
        current,
      ),
    /paid_retry_active_run/,
  );
  recoverRun(repo, run.runId, run.fence, current);
  await runDiscovery({
    repository: repo,
    adapters: [source],
    bounds,
    now: () => current,
  });
  release?.();
  await assert.rejects(first, /run_fence_lost/);
  assert.equal(calls, 1);
  assert.equal(repo.read().jobs.length, 0);
  assert.ok(repo.read().runs[0]?.sources[0]?.paidAttempt);
});

test("public adapter configuration rejects invalid policy reference before any request", () => {
  assert.throws(() =>
    createCareerTraversalAdapter({
      sourceId: "public",
      sourcePolicyRef: " ",
      seeds: [],
      fetchOptions: {
        liveOptIn: false,
        sourcePolicy: async () => ({ status: "unresolved" }),
        beforeRequest: async () => {},
      },
    }),
  );
});
