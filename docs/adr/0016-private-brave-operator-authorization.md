# 0016: private Brave use under explicit operator authorization

- Status: accepted
- Date: 2026-10-19
- Supersedes: the wait-for-provider-grant condition for this private G4 use only;
  other source, budget, privacy and access controls remain unchanged.

## Context

The user cannot find a storage-rights setting in the Brave dashboard and explicitly
instructed continuing without it, accepting the unresolved rights condition.
This changes the local authorization decision. It does not establish a Brave grant,
amend Brave's terms or confer rights over third-party pages. Previous evidence of
Search/Postpaid access remains separate from provider permission.

## Decision

- Allow bounded private G4 Web Search using the existing account/key and budgets.
  Record explicit operator authorization and `providerGrant: unverified` separately.
  No missing authorization is treated as permission, and no general source-policy
  callback is changed to permit a URL merely because Brave returned it.
- Use only the fixed official HTTPS Web Search endpoint. Send the key solely in
  its authentication header; reject redirects, bound time/body/page counts and
  never log credentials, provider bodies or unsafe error details.
- Resolve query references to the exact existing frozen non-personal G3 manifest.
  Parse responses transiently. Retain only URL leads and minimal provenance for
  at most seven days, shortened by the operator authorization/source policy.
  Discard snippets, titles, descriptions, raw responses and error bodies.
- Keep all employer/eligibility facts unknown until independently fetched from an
  allowed source. Retain the operator-instruction basis in provenance; never label
  this exception a provider-issued storage or AI-use grant.
- Reserve every attempt before dispatch in G4 and the existing G3 ledger. Keep
  search's 100 cumulative/40 daily, record/budget caps, the EUR 5 experiment and
  EUR 50 monthly ceiling. Initial operator execution is a small explicit batch.
  No subscription, top-up, account, billing or IAM change is authorized.
- The first actual discovery dispatch starts G3 A's seven-day clock. Preserve the
  frozen manifest and separate sampling protocol; this does not complete G3.
  Stop on 429 with persisted backoff. No blind retry of ambiguous paid work; retain
  reservations and require reconciliation after interrupted cross-store commits.
- Keep default tests offline and require explicit live opt-in. Do not send retained
  Brave output to a model in this slice. Broader deployment, redistribution and
  later AI use require their own current source-policy assessment.

## Alternatives

Waiting for a vendor grant contradicts the user's current instruction. Pretending
the user issued Brave's grant would misstate the evidence. Unlimited retention or
automatic provider fan-out is unnecessary for this bounded private discovery step.

## Consequences and sources

Private execution can establish actual source behavior, not vendor permission,
legal clearance, useful coverage, a completed G4 or public-distribution rights.
Reviewed 2026-10-19: [Web Search](https://api-dashboard.search.brave.com/app/documentation/web-search/get-started),
[API reference](https://api-dashboard.search.brave.com/api-reference/web/search/get),
[rate limits](https://api-dashboard.search.brave.com/documentation/guides/rate-limiting),
[pricing](https://brave.com/search/api/). Published Search pricing is USD 5/1,000
requests; account credits/invoices are not assumed. Retain conservative headroom.
