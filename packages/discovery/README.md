# Local discovery contract

This package implements static public-page reads, bounded career-link traversal,
permitted frozen search-result intake, and explicit operator-authorized private
Brave search. It does not install a scheduler or CLI, prove useful coverage, or
complete G4/V1. `createPublicPageAdapter` uses the existing public-fetch target, DNS,
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
missing/invalid `Retry-After` imposes at least sixty seconds. Origin spacing also
persists across adapter reconstruction. Request reservation consumes allowance
before the external accounting hook; a fenced dispatch confirmation updates the
spacing deadline after that hook resolves. An adapter reconstructed before the
deadline stops with a retry time and retains its target. In-process pacing waits
within the run deadline. Aborted or stale hooks cannot confirm or dispatch.

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
Observation ingestion, cursor advancement and traversal frontier changes commit
together. The old worker's
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
similar titles never merge records. Content hashes exclude observation/retention timestamps, including known discovery
lineage timestamps and search capture batch IDs. Meaningful query/result references,
permission references, parent identities and anchor evidence remain in the hash.
Unchanged content updates checking times without adding revisions. Observations
without discovery provenance keep their legacy hash and parse shape.
Retained revision records are never edited. When an old capture's revision record
expires but the same current content has a fresh observation, pruning removes the
expired record and recreates its stable content ID using only that fresh
observation. Expired capture timestamps/provenance are not carried forward, and
every retained current job still resolves to a retained revision.
Similar evidenced title/employer pairs only add uncertain duplicate links.
`publishedAt`/`expiresAt` stay unknown unless normalized by a source adapter;
`lastCheckedAt` is the last ingested observation, while `lastSeenAt` only advances
for a non-unavailable observation. A static-stream failed fetch is a source failure; traversal page failures emit
unavailable observations. Neither proves that a vacancy disappeared. Eligibility remains unknown without explicit evidence;
fit scores are always unavailable until G5.


## Frozen search intake and dynamic traversal

Search storage/use permission remains an external prerequisite. No provider,
including Brave, is implicitly permitted. Supply a frozen, minimized snapshot and
an independent trusted callback that checks the applicable grant for each result:

```ts
import {
  createSearchLeadSnapshotAdapter,
  createCareerTraversalAdapter,
} from "@job-search/discovery";

const search = createSearchLeadSnapshotAdapter({
  sourceId: "permitted-search",
  snapshot: {
    snapshotId: "frozen-snapshot-1",
    capturedAt: captureTime,
    retentionUntil: sourceCaptureExpiry,
    results: [{
      sourceRecordId: "stable-provider-result-id",
      queryRef: "query_student_jobs_v1",
      resultRef: "provider-query-1-result-1",
      url: "https://employer.example/careers",
    }],
  },
  permission: (result, snapshot) => reviewedStorageAndUsePermission(result, snapshot),
  // Callback returns {status: "permitted", evidenceRef, expiresAt},
  // or {status: "unresolved" | "restricted"}. Only permitted, unexpired use proceeds.
});
```

The strict snapshot accepts URL/result/query references, capture time and expiry.
It rejects titles, snippets, raw queries and arbitrary extra fields. Query references
resolve separately in private operator configuration; they do not retain potentially
candidate-derived query strings in shared observations. The adapter makes no HTTP
requests. It emits only `search_lead`, with title/employer/eligibility/application
facts unknown. Capture expiry and the trusted grant's shorter expiry cap retention;
replaying a frozen snapshot cannot renew its evidence. Permission must cover the
intended downstream storage/use. A key, subscription or public access is insufficient.

A separate traversal source accepts retained `search_lead` observations with search
provenance, or explicitly reviewed operator roots:

```ts
const career = createCareerTraversalAdapter({
  sourceId: "public-career-stream",
  sourcePolicyRef: "reviewed-public-source-policy",
  seeds: [{
    url: "https://employer.example/careers",
    seedRef: "reviewed-operator-root-1",
    sourcePolicyRef: "reviewed-public-source-policy",
    observedAt: reviewedSeedTime,
    retentionUntil: reviewedSeedExpiry,
  }],
  // Alternatively: seeds: retainedSearchObservations,
  fetchOptions: reviewedPublicFetchOptions,
  retentionDays: 7,
  // Optional source-specific shortening, evaluated for every target/redirect hop:
  retentionUntil: (url, now) => reviewedRetentionExpiry(url, now),
  limits: { maxDepth: 2, maxLinksPerPage: 20, maxPending: 64, maxVisited: 256 },
});
await runDiscovery({ repository, adapters: [career], bounds: finiteRunBounds });
```

Freeze seed configuration across restarts. Build the complete daily adapter list
before starting a run; adding an adapter later that day changes its contract and
is rejected. A search snapshot can be normalized by its `step` method (without HTTP)
to supply traversal seeds before running both adapters together. A permitted operator
root does not require search-provider permission. Search and fetched observations
use distinct source identities and are never automatically merged.

One inert HTML page is fetched per traversal step. Career intent comes from anchor
text and destination path/query, excluding host names. Version 2 ranks main/article
and job-card links with detail paths or record-ID queries before navigation/footer
links, then applies the existing link/frontier limits. Equally ranked links preserve
document order. Obvious home/about/legal, job-publishing and employer signup links
are excluded; legitimate nested career links remain a fallback. These generic
heuristics do not verify a vacancy, employer or candidate fit, and use no employer
allowlist. A v1 frontier cannot be resumed under v2's changed adapter contract.
New employer/ATS domains pass the same target, DNS, source-policy, origin ownership
and redirect controls; there is no employer/domain allowlist. Relative links resolve
against the final page URL. Query parameters remain intact. Fragments are ignored
only for cycle detection; original source URLs remain in provenance and identity.
No scripts, rendered browser automation, forms, applications or hidden anchors run.

The maximum limits above can only be lowered. `rejectedLinks`, `excessLinks`,
`limitsReached` and `expiredTargets` expose rejected/truncated/expired work without
retaining rejected URLs. A normal unavailable, 401/403, challenge or unresolved-policy
page emits an unavailable observation with unknown facts and advances to siblings.
429 retains its pending target, persists a cooldown and stops the stream. Accounting,
ownership, deadline and fence refusals halt without fake page observations. Missing
or expired unfinished checkpoints fail closed with a bounded source error.

Typed checkpoints contain the bounded pending frontier, expiring visited hashes and
minimal discovery provenance. Cursors contain only opaque tokens. Every pending
entry and descendant observation expires no later than its parent evidence/grant;
source-specific restrictions on any redirect hop can shorten it further. Cleanup
physically prunes checkpoints in all historical runs. New daily runs carry a matching
unfinished checkpoint and cursor, while preserving daily request/step limits and
cross-day cooldowns. Static adapters and old state without checkpoints remain valid.

Offline verification of these adapters does not establish search rights, live
search access, broad coverage or useful daily discovery. Default tests use synthetic DNS/transport only.


## Explicit private Brave execution

[ADR 0016](../../docs/adr/0016-private-brave-operator-authorization.md) records the
user's bounded private-use instruction. This is a separate access route from the
permitted snapshot callback; `providerGrant: "unverified"` remains explicit and is
never converted into a provider storage/AI-use grant. It does not change employer
page policies or authorize redistribution or model use of search output.

```ts
import { createBraveSearchAdapter, createCareerTraversalAdapter } from "@job-search/discovery";

const brave = createBraveSearchAdapter({
  sourceId: "brave-web",
  liveOptIn: true,
  access: {
    operatorAuthorizationRef: "private-operator-instruction-reference",
    providerGrant: "unverified",
    decisionRef: "docs/adr/0016-private-brave-operator-authorization.md",
    purpose: "bounded_private_discovery",
    retain: "urls_and_provenance_only",
    expiresAt: privateAuthorizationExpiry,
  },
  manifest: experimentStore.manifest,
  pages: selectedFrozenQueryIds.map(queryId => ({ queryId, offset: 0 })),
  apiKey: privatelyLoadedKey,
  beforeRequest: reserveAndBeginUniqueG3SearchAttempt,
  afterAttempt: recordSafeG3AttemptOutcome,
});
const career = createCareerTraversalAdapter({
  sourceId: "public-career-stream",
  sourcePolicyRef: "reviewed-public-source-policy",
  seeds: () => repository.listJobs(new Date())
    .filter(job => job.sourceId === "brave-web")
    .slice(0, 64)
    .map(job => job.observation),
  seedVersion: "frozen_manifest_selection_v1",
  seedSelectionRef: "private-reviewed-seed-selection",
  fetchOptions: reviewedPublicFetchOptions,
});
await runDiscovery({ repository, adapters: [brave, career], bounds: finiteRunBounds });
```

The manifest uses the existing strict G3 schema/hash: twenty unique frozen queries,
ten per stream. Each selected page must reference one exact manifest query ID and
an offset from 0 through 9; duplicate pages and extra page/configuration fields are
rejected. The adapter sends the exact query text to the fixed official HTTPS Web
Search endpoint with `count=10`, `country=DE` and `result_filter=web`. It never adds
pages, retries automatically, calls Answers/LLM Context, or requests extra snippets.
The API key is captured privately, sent only in `X-Subscription-Token`, omitted from
version hashes/summaries, and rejected if echoed in result URLs. Native fetch uses
`redirect: "error"`, no credentials/referrer, and no cache. Responses are streamed
within one megabyte and ten seconds, additionally bounded by the runner's deadline.

The `beforeRequest` argument is a safe `BraveSearchRequest`:
`{ attemptId, requestRef, queryId, offset, manifestHash, count: 10 }`. `attemptId` is
a fresh UUID and `requestRef` hashes the frozen manifest/query/page. The private
hook must check the manifest binding and source/budget limits, then durably reserve
and begin that exact G3 attempt before returning. The first actual discovery
attempt starts G3's existing seven-day clock; the adapter does not reset the ledger.

`afterAttempt` receives those same fields plus `outcome`, `reason`, optional HTTP
`status`, `returnedRecords` (accepted unique URL leads), and `rejectedRecords`.
Outcomes are `not_dispatched`, `response_received`, or `ambiguous`; reasons are
bounded codes. Neither hook receives raw queries, payloads, result URLs or keys.
An HTTP error, redirect, body/parse failure or timeout can still incur charges.
The operator must retain conservative allowance or reconcile actual cost; receiving
an HTTP response alone is not a zero-cost receipt. The adapter estimates no billing.
A hook refusal before transport is `not_dispatched`; transport without a definitive
response is `ambiguous`. A late hook cannot dispatch or commit after abort/fencing.

Only a validated search envelope whose original query matches the frozen request
can create leads. A nullable/absent web section is an empty result. Unsafe/malformed
URLs are rejected; titles, descriptions, snippets, schemas and raw responses are
never retained. IDs derive from the query ID and exact result URL, preserving URL
queries and keeping search/fetched identities separate. Provenance records the
operator instruction, unverified provider grant, manifest/query/result references
and expiry. Its temporal fields do not manufacture new content revisions.

Lazy traversal seed callbacks are synchronous and must only select retained local
evidence; they perform no HTTP or writes. `seedVersion` and `seedSelectionRef` bind
the selection contract. After earlier adapters commit, the runner atomically stores
the parsed frontier and an initialization marker before any page dispatch. Missing,
removed or expired unfinished frontiers cannot invoke seed selection again, including
on a new day. A new completed daily run can use its new day's retained evidence.
Keep the same complete adapter list throughout that day's run.

### Paid-attempt reconciliation

G4 persists `paidAttempt` before the private G3 hook. Only successful observation
and cursor commit clears it automatically. HTTP failures, 429, ambiguous transport,
late work, settlement-hook failure and interrupted cross-store commits retain the
exact marker, so restarts cannot silently repeat paid work. A 429 also persists its
cooldown. No automatic paid retry is configured.

Before authorizing a retry, stop old workers, reconcile G3's exact attempt and any
billing uncertainty, preserve its consumed allowance, and record private evidence.
Then the operator may explicitly authorize a new attempt using the latest run's
exact marker (never clear arbitrary state or reset either ledger):

```ts
import { authorizePaidAttemptRetry } from "@job-search/discovery";
authorizePaidAttemptRetry(repository, {
  runId: latestRun.runId,
  sourceId: "brave-web",
  attemptId: latestRun.sources.find(source => source.sourceId === "brave-web").paidAttempt.attemptId,
  evidenceRef: "private-paid-attempt-reconciliation-1",
}, new Date());
```

The helper rejects an active run, stale run or wrong token, records a bounded retry
authorization receipt, and clears only that marker. It preserves cursors, daily
attempt/request counts, origin ownership, spacing and cooldowns. It does not settle
G3, prove source rights or dispatch. Existing explicit interrupted-run recovery and
writer-lock reconciliation remain necessary where applicable.

Current API details reviewed 2026-10-19 against the official
[Web Search guide](https://api-dashboard.search.brave.com/app/documentation/web-search/get-started)
and [GET reference](https://api-dashboard.search.brave.com/api-reference/web/search/get).
Default tests inject synthetic fetch/transport and make no external calls.
