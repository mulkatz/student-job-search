# 0015: permitted leads and expiring discovery frontiers

- Status: accepted
- Date: 2026-10-19
- Extends: [ADR 0013](0013-discovery-identities-and-recovery.md)

## Context

G4's initial adapter needs explicit target URLs. Broad discovery also needs search
lead intake and finite traversal of newly linked career/vacancy pages. Search
provider rights remain unresolved. Daily run history outlives source retention;
putting a URL frontier in an opaque cursor would retain source data indefinitely.

## Decision

- Add provider-neutral intake of frozen search-result URLs only after a trusted
  operator supplies an applicable storage/use policy and bounded retention.
  Provider payloads cannot grant themselves permission. No search API, account,
  paid dispatch or Brave integration is enabled by this contract.
- Search records remain `search_lead`, with query/result references and unknown
  vacancy facts. Provider text cannot become evidence from an unfetched employer.
  Independently fetched pages use their own source-pair identities; similarity and
  redirects never silently merge provider leads and vacancy records.
- Permit bounded public-page traversal from retained leads or operator seeds.
  Newly linked domains pass the existing public target, DNS, redirect, access,
  source-policy and durable pacing/reservation boundary. No employer allowlist applies.
  No browser rendering/subrequests, forms, credentials or challenge solving is added.
- Store strict typed frontier/checkpoint data separately from opaque cursors in
  source progress. Lazy seed selection runs once after earlier sources commit;
  initialize it atomically before dispatch. Commit observations/frontier advancement
  under existing fences. Old state and static adapters remain compatible.
- Bound depth, admitted links, pending targets, visited identities, daily steps,
  requests and wall time. Preserve query parameters; fragment removal and exact
  normalized URL comparison prevent traversal cycles without cross-source merging.
  Record parent anchor evidence and explicit bounded outcomes for rejected/excess links.
- Frontier entries/provenance expire no later than their parent evidence or
  applicable policy. Never dispatch expired entries. Physically prune expired
  checkpoint data from historical runs as well as current jobs/revisions; do not
  preserve source URLs in long-lived technical cursors or diagnostic messages.
- A non-rate-limit page failure records its unavailable/unknown outcome and
  advances so siblings can proceed. A 429 preserves the current target, persists
  cooldown and stops that source; restart/day changes cannot evade it.
- Keep discovery provenance optional for legacy observations so old content IDs
  are unchanged. Exclude refreshed lineage timestamps/capture IDs from content IDs;
  retain their actual values in the current observation for traceability.
  Missing/expired checkpoints fail closed rather than resetting
  an interrupted traversal or reinterpreting its cursor.

## Alternatives

In-memory queues lose recovery. URL-encoded cursors overflow and outlive retention.
A fixed employer list misses the product's intended reach. Adding a search provider
without established rights would bypass the known G3/G4 integration prerequisite.

## Consequences

Synthetic checks can establish traversal, provenance, bounded recovery and expiry.
They establish no live search access, useful coverage, second permitted source,
production scheduling or G4/V1 completion. Real observations need separately
reviewed policy/access, private evidence and the existing cumulative allowances.
