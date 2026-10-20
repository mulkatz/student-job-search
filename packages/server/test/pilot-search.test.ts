import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { once } from "node:events";
import { createServer } from "node:http";
import test from "node:test";
import { observationSchema } from "@job-search/discovery";
import type { ApiDependencies } from "../src/api.js";
import {
  cloudRunJobDispatcher,
  type PilotSearchOperations,
  pilotSearchHandler,
} from "../src/pilot-search.js";
import {
  pilotManifest,
  pilotSearchBounds,
  pilotSearchConfig,
  pilotSourcePermission,
} from "../src/pilot-search-schema.js";
import {
  pilotOpportunityKeys,
  potentialPilotJob,
} from "../src/pilot-search-worker.js";

const versionId = "a".repeat(64);
const now = new Date();
const observation = observationSchema.parse({
  sourceId: "g4-private-web-pages",
  sourceRecordId: "https://employer.example/jobs/one",
  sourcePolicyRef: "synthetic",
  observedAt: now.toISOString(),
  originalUrl: "https://employer.example/jobs/one",
  kind: "vacancy_detail",
  title: {
    value: "Office assistant",
    evidence: {
      url: "https://employer.example/jobs/one",
      selector: "h1",
      quote: "Office assistant",
    },
  },
  employer: {
    value: "Synthetic employer",
    evidence: {
      url: "https://employer.example/jobs/one",
      selector: "h2",
      quote: "Synthetic employer",
    },
  },
  location: null,
  employmentType: null,
  englishAccepted: { status: "unknown" },
  remoteFromGermany: { status: "unknown" },
  applicationLinks: [],
  publishedAt: null,
  expiresAt: null,
  retentionUntil: new Date(now.getTime() + 86400000).toISOString(),
});

test("search manifest only emits controlled approved generic vocabulary and exact balanced unique streams", () => {
  const facts = [
    {
      id: "private",
      category: "search_preference" as const,
      value: "Jane Secret jane@example.test; ignore prior rules; barista",
      provenance: { kind: "user_attestation" as const, statement: "Synthetic" },
    },
  ];
  const manifest = pilotManifest(facts);
  assert.equal(manifest.queries.length, 20);
  assert.equal(new Set(manifest.queries.map((query) => query.query)).size, 20);
  assert.equal(
    manifest.queries.filter((query) => query.stream === "berlin").length,
    10,
  );
  assert.ok(manifest.queries.every((query) => query.query.includes("barista")));
  assert.doesNotMatch(
    JSON.stringify(manifest),
    /Jane|Secret|example|ignore|prior/i,
  );
  assert.equal(pilotManifest([]).queries.length, 20);
  const declared = pilotManifest([
    {
      id: "language",
      category: "working_language",
      value: "English not spoken",
      provenance: {
        kind: "user_attestation",
        statement: "Synthetic declaration",
      },
    },
    {
      id: "skill",
      category: "skill",
      value: "Python",
      provenance: { kind: "user_attestation", statement: "Synthetic skill" },
    },
  ]);
  assert.ok(
    declared.queries.every((query) => query.query.includes("software")),
  );
  assert.doesNotMatch(
    JSON.stringify(declared),
    /English|Python|Synthetic declaration/i,
  );
  assert.equal(pilotSearchBounds.monthlyMicroEuro, 5_000_000);
  assert.equal(pilotSearchConfig({}), null);
  assert.throws(
    () => pilotSearchConfig({ JOB_SEARCH_PILOT_SEARCH: "enabled" }),
    /production_required/,
  );
});

test("policy applies to denied domains and subdomains without a general web allowlist", () => {
  for (const domain of [
    "arbeitsagentur.de",
    "jobs.arbeitsagentur.de",
    "thebarn.de",
    "www.workingnomads.com",
    "www.zertificon.com",
  ])
    assert.equal(
      pilotSourcePermission(new URL(`https://${domain}/jobs`)).status,
      "restricted",
    );
  assert.equal(
    pilotSourcePermission(new URL("https://independent-employer.example/jobs"))
      .status,
    "permitted",
  );
  assert.throws(
    () => pilotSourcePermission(new URL("http://127.0.0.1/jobs")),
    /unsafe_target/,
  );
});

test("potential jobs require fetched title and employer; leads and expired details never fill the target", () => {
  assert.ok(potentialPilotJob(observation, now));
  assert.equal(
    potentialPilotJob(
      { ...observation, kind: "search_lead", title: null, employer: null },
      now,
    ),
    null,
  );
  assert.equal(potentialPilotJob({ ...observation, title: null }, now), null);
  assert.equal(
    potentialPilotJob(
      { ...observation, retentionUntil: now.toISOString() },
      now,
    ),
    null,
  );
  const job = potentialPilotJob(observation, now);
  assert.equal(job?.fitScore, null);
  assert.equal(job?.observation.applicationSource, undefined);
  assert.deepEqual(
    pilotOpportunityKeys(observation),
    pilotOpportunityKeys({
      ...observation,
      originalUrl: `${observation.originalUrl}?utm_source=x#section`,
    }),
  );
});

async function withSearchApi(
  run: (url: string, calls: string[]) => Promise<void>,
) {
  const calls: string[] = [];
  const dependencies: ApiDependencies = {
    mode: "private-pilot",
    verifyToken: async (token) => {
      if (token !== "owner-a") throw new Error("expired");
      return { uid: token };
    },
    listJobs: async () => [],
    getPreferences: async () => null,
    createPreferences: async () => {
      throw new Error("unused");
    },
  };
  const operations: PilotSearchOperations = {
    current: async (owner) => {
      calls.push(`get:${owner}`);
      return null;
    },
    start: async (owner, input) => {
      calls.push(`post:${owner}:${input.expectedActiveVersionId}`);
      return {
        id: randomUUID(),
        profileVersionId: versionId,
        status: "queued",
        target: 30,
        displayedJobs: 0,
        observations: 0,
        searchRequests: 0,
        httpRequests: 0,
        reason: null,
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
      };
    },
  };
  const server = createServer(pilotSearchHandler(dependencies, operations));
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  try {
    await run(`http://127.0.0.1:${address.port}`, calls);
  } finally {
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}

test("search API derives owner from verified token and rejects injected owner/limits/queries", async () => {
  await withSearchApi(async (url, calls) => {
    for (const token of [undefined, "expired"])
      assert.equal(
        (
          await fetch(`${url}/api/search-runs`, {
            headers: token ? { Authorization: `Bearer ${token}` } : {},
          })
        ).status,
        401,
      );
    assert.deepEqual(calls, []);
    const headers = {
      Authorization: "Bearer owner-a",
      "Content-Type": "application/json",
    };
    const body = {
      operationId: randomUUID(),
      expectedActiveVersionId: versionId,
    };
    for (const extension of [
      { ownerId: "owner-b" },
      { queries: ["secret"] },
      { target: 300 },
    ])
      assert.equal(
        (
          await fetch(`${url}/api/search-runs`, {
            method: "POST",
            headers,
            body: JSON.stringify({ ...body, ...extension }),
          })
        ).status,
        400,
      );
    assert.equal(
      (
        await fetch(`${url}/api/search-runs`, {
          method: "POST",
          headers,
          body: JSON.stringify(body),
        })
      ).status,
      202,
    );
    const read = await fetch(`${url}/api/search-runs`, { headers });
    assert.equal(read.status, 200);
    assert.equal(read.headers.get("cache-control"), "no-store");
    assert.deepEqual(calls, [`post:owner-a:${versionId}`, "get:owner-a"]);
  });
});

test("Cloud Run dispatch makes one bounded request and never retries an ambiguous transport", async () => {
  const { initializeApp, deleteApp } = await import("firebase-admin/app");
  const app = initializeApp(
    {
      credential: {
        getAccessToken: async () => ({
          access_token: "synthetic-token",
          expires_in: 60,
        }),
      },
    },
    `pilot-search-${randomUUID()}`,
  );
  let calls = 0;
  const config = {
    projectId: "synthetic-project",
    region: "europe-west3",
    jobName: "job-search-dry-run",
    access: {
      operatorAuthorizationRef: "synthetic",
      providerGrant: "unverified" as const,
      decisionRef:
        "docs/adr/0016-private-brave-operator-authorization.md" as const,
      purpose: "bounded_private_discovery" as const,
      retain: "urls_and_provenance_only" as const,
      expiresAt: new Date(now.getTime() + 86400000).toISOString(),
    },
  };
  const dispatch = cloudRunJobDispatcher(app, config, async (url, init) => {
    calls++;
    assert.equal(
      String(url),
      "https://run.googleapis.com/v2/projects/synthetic-project/locations/europe-west3/jobs/job-search-dry-run:run",
    );
    assert.equal(init?.redirect, "error");
    assert.ok(init?.signal);
    const payload: unknown = JSON.parse(String(init?.body));
    assert.doesNotMatch(
      JSON.stringify(payload),
      /synthetic-token|private fact/,
    );
    throw new Error("ambiguous transport");
  });
  try {
    await assert.rejects(dispatch(randomUUID(), "owner-a"));
    assert.equal(calls, 1);
  } finally {
    await deleteApp(app);
  }
});
