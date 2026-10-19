# Local discovery contract

This package implements one operator-configured public-page stream. It does not
install a scheduler or CLI, enable web search, prove useful coverage, or complete
G4/V1. `createPublicPageAdapter` uses the existing public-fetch target, DNS,
redirect, source-policy and access-challenge boundary. HTML is parsed inertly;
no browser rendering, forms, application submission or scripts are executed.

## Run and read

After building the workspaces, an authorized local operator can use:

```ts
import {
  FileDiscoveryRepository,
  createPublicPageAdapter,
  runDiscovery,
} from "@job-search/discovery";

const repository = new FileDiscoveryRepository(process.cwd());
const adapter = createPublicPageAdapter({
  sourceId: "reviewed-employer",
  sourcePolicyRef: "private-reviewed-policy-reference",
  targets: [{
    sourceRecordId: "stable-source-record-id",
    url: "https://careers.example/role",
    // Optional, source-reviewed detail selectors. Each must match exactly once.
    visibleFields: { title: "article h1", employer: "article .employer" },
  }],
  retentionDays: 7,
  fetchOptions: {
    liveOptIn: true,
    sourcePolicy: reviewedPolicyForEveryTargetAndRedirect,
    beforeRequest: reserveExistingCumulativeAllowanceBeforeDispatch,
  },
});
const run = await runDiscovery({
  repository,
  adapters: [adapter],
  bounds: {
    maxStepsPerSource: 10,
    maxRequestsPerSource: 20,
    maxDurationMs: 60_000,
  },
});
const jobs = repository.listJobs(new Date());
```

The two named policy/accounting callbacks must be supplied by the private
operator. A local opt-in does not grant source rights or a new HTTP allowance.
Every target and redirect reserves durably in G4 before the caller's accounting
callback runs; a failed callback prevents dispatch. Reservations remain consumed
when a dispatch fails or its result is uncertain. No request sends by default in
the tests; injected synthetic transport is used.

One source owns each origin permanently in local state. A redirect origin is
claimed before dispatch too. A second source targeting an already-owned origin
fails before sending: put that origin's paths in the existing source adapter.
There is no automatic ownership transfer. This conservative contract prevents
another adapter from bypassing origin pacing or a source's persisted cooldown.
Rate-limit cooldowns survive process restarts and Berlin calendar boundaries;
missing/invalid `Retry-After` imposes at least sixty seconds.

The returned run contains per-source cursor, consumed step attempts and HTTP
reservations, status, bounded error code, and retry time. Completion is retained
for that Europe/Berlin day, including DST; invoking it again does not redispatch
completed sources. Failed sources can continue within the original daily bounds.
Changing the source version/target list or daily request/step bounds that day
fails instead of silently reinterpreting a cursor or raising a quota. A real
wall deadline bounds awaited adapters. Abort signals and fencing prevent late
work from reserving or committing observations after timeout/recovery.

## Recovery and retention

`FileDiscoveryRepository` stores atomic, fsynced state in `.local/g4/state.json`
with mode `0600`, creating private directories with mode `0700`. It rejects
symlink state/directories and serializes writes using an exclusive `writer.lock`.
A normal source error releases the writer lock. A crash during an uncertain write
retains it: inspect filesystem state and stop the old worker before any manual
lock reconciliation. Never automatically delete a writer lock.

A persisted active run also prevents overlaps. Once the operator confirms that
its previous worker is stopped, recover the exact run and fencing token:

```ts
import { recoverRun, pruneExpired } from "@job-search/discovery";
const active = repository.read().runs.find((run) => run.status === "running");
if (active?.fence) {
  recoverRun(repository, active.runId, active.fence, new Date());
}
// Reuse runDiscovery with the unchanged adapters and bounds to resume.
repository.transact((state) => pruneExpired(state, new Date()));
```

Recovery keeps consumed reservations/attempts and the last committed cursor.
Observation ingestion and cursor advancement commit together. The old worker's
fence cannot mutate the resumed run. Raw `read()` is an internal operator API;
use `listJobs(now)`/`retainedJobs` for read-facing projections, which exclude
expired facts and dangling duplicate links even before cleanup.

Observations retain minimal evidenced facts for at most seven days. Runs prune
expired jobs/revisions before new work; no cleanup schedule is installed. The
caller must also expire raw captures, Firestore projections and any exports.
The bounded local store permits 10,000 jobs, 30,000 retained revisions and 366 run
records; reaching capacity fails closed. Historical run archival/rotation needs
an explicit bounded operator task before the one-year run limit is reached.
Local permissions and schema validation do not establish production privacy or
source rights. Shared observations contain no candidate data; authentication and
Firestore ownership enforcement are implemented by the server workspace.

Source identity is the exact `(sourceId, sourceRecordId)` tuple. Redirects and
similar titles never merge records. Content hashes exclude observation/retention
timestamps; unchanged content updates checking times without adding revisions.
Retained revision records are never edited. When an old capture's revision record
expires but the same current content has a fresh observation, pruning removes the
expired record and recreates its stable content ID using only that fresh
observation. Expired capture timestamps/provenance are not carried forward, and
every retained current job still resolves to a retained revision.
Similar evidenced title/employer pairs only add uncertain duplicate links.
`publishedAt`/`expiresAt` stay unknown unless normalized by a source adapter;
`lastCheckedAt` is the last ingested observation, while `lastSeenAt` only advances
for a non-unavailable observation. A failed fetch is a source failure, not proof
that a vacancy disappeared. Eligibility remains unknown without explicit evidence;
fit scores are always unavailable until G5.
