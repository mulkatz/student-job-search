# G3 setup and resumable experiment

Status: setup in progress, 2026-10-19. G3 is not complete. No vacancy discovery,
vacancy extraction, model call or Gmail write has run. Two public-documentation
HTTP diagnostics are recorded below; neither is a vacancy observation. The
seven-day observation window has not started. [FEASIBILITY.md](FEASIBILITY.md)
remains the experiment contract.

## Current readiness

| Branch | Evidence available | Still needed before live execution |
| --- | --- | --- |
| A: discovery | Twenty non-personal queries frozen by the private ledger; official Brave/Greenhouse documentation checked | Intended Brave key and exact plan/storage entitlement; source-specific rights and up to five useful initial boards; reviewed live runner |
| B: extraction | Implemented/offline-reviewed bounded HTTP/Cheerio library; counted documentation-only transport smoke | Thirty labeled vacancy/career/negative URLs, source-specific rights/retention, orchestration and measured live extraction accuracy |
| C: model | Provisional EU Gemini candidate and dated price/retention documentation below | Intended project, region/endpoint, ADC, IAM, enabled API, actual billing/terms and synthetic fixture approval; reviewed live runner |
| D: Gmail | Current compose/draft/OAuth documentation checked | Dedicated OAuth client/callback, consenting test identity, local token setup, draft-only code/tests and account-holder inspection |

The local Google Cloud CLI has an active account and configured project, and an
ADC credential file exists locally (not validated). This does not establish that
these credentials belong to this experiment, that ADC works, or that any
API is enabled. No account/project identifiers or credentials are recorded here.
Do not use an unrelated default project or mailbox. The user has been asked to
identify the intended project/region and local credential-file locations privately.
Never paste keys, tokens or OAuth client secrets into chat or Git.

## Runner boundary

The first runner slice manages local control state. Initialize it only once:

```sh
mkdir -p .local/g3
cp -n experiments/g3/config.example.json .local/g3/config.json
chmod 700 .local/g3
chmod 600 .local/g3/config.json
npm run experiment -- init --config .local/g3/config.json
npm run experiment -- status
```

If the private config/state already exists, inspect it and run only `status`; do
not copy over existing settings or initialize another ledger. Initialization
freezes the twenty-query manifest and allocations but does not start day one or
make a provider call. The example allocates EUR 1 each to discovery and model work,
inside EUR 5; it contains no credentials or live-provider configuration.

The CLI rebuilds the experiment package before execution. It exposes only init
and read-only status; no cloud schedule or browser job is installed. Library
reservations account for aggregate/daily requests, upper token/record counts and
conservative branch cost before a future dispatch. Pending/ambiguous reservations
remain counted across restarts; an overrun blocks new work. No command can mark
G3 passed. Status reports attempted observation dates, next due date and gaps.

Provider-specific pricing/rights checks, search follow-up selection and its eight
requests/day protocol, retry/fallback URL limits, sample labels/metrics and all
live dispatch adapters remain separate responsibilities before live execution.
The controlled public-fetch/extraction library uses public DNS validation and
pinned HTTP/TLS connections, checks redirect permissions, and requires a durable
pre-request hook. Its conservative limits include default ports only, no compressed
bodies, no rendering, a default 15-second whole-operation deadline and 2 MB body
limit. It never forwards credentials or cookies and does not retry automatically.
Its caller must account for every request/redirect/robots fetch in the ledger and
persist Retry-After across restarts; pacing/backoff inside one fetcher is in memory.
HTML challenge-marker matching is deliberately conservative and can flag ordinary
pages mentioning CAPTCHA/login. Its marker outcome does not prove an authentication
wall; actual 401/403 status outcomes remain distinct.
A request hook that completes after a deadline can leave a conservative outstanding
reservation and must be reconciled. Neither this library nor its synthetic tests
establish live vacancy coverage, source rights or extraction accuracy.

Extraction recognizes only supported JSON-LD JobPosting facts and explicitly
labeled application links. It returns plain evidence, keeps language and
Germany-remote eligibility unknown, and marks all application routes unverified.
It is not an HTML sanitizer or a general extractor for arbitrary career pages.

Store experiment state, credentials and permitted captures only under ignored
`.local/g3/` or another explicitly approved private store. Keep private files
owner-readable, retain only needed evidence, and follow shorter provider retention
limits. A Git ignore rule is not authorization, encryption or deletion assurance.
Do not delete/reset the cumulative ledger between sessions. Investigate outstanding
or ambiguous writes and locks before resuming; never blindly repeat a Gmail create.

## Executed evidence and next observation

On 2026-10-19, the documented init/status commands succeeded with the version-1
manifest and credential-free allocation example. Status is read-only; the ledger
has no discovery start, no scheduled next observation, and no benchmark result.
The frozen manifest SHA-256 is
`49be10b193f4838353d9a12cbe8874a9b1248f4cfeaca9bf4eb8921bb42fd147`.

After independent review of the real transport, a private exact-target diagnostic
script ran with the mandatory durable HTTP/extraction hook and explicit live opt-in:

```sh
node .local/g3/http-smoke.mjs
```

This private diagnostic is retained as local evidence, not a clean-checkout live
command. It used no credentials, retained no response HTML, allowed only the two
reviewed official documentation URLs, and counted every send in the same ledger.

| Target | Observed outcome | HTTP attempts |
| --- | --- | --- |
| `https://developers.google.com/robots.txt` | Text retrieved, 93 bytes | 1 |
| `https://developers.google.com/workspace/gmail/api/auth/scopes` | Stopped at HTML authentication/challenge marker; no retry | 1 |

The original private record uses the then-current `authentication_or_challenge`
label. Review clarified that heuristic label to
`authentication_or_challenge_marker`, retaining the stop behavior and separate
401/403 outcomes. The second observation does not establish an actual login wall.
Private evidence: `.local/g3/http-smoke-result.json` and `.local/g3/state.json`.
Paid provider calls: zero; counted HTTP attempts: two; incremental paid API spend:
EUR 0. The EUR 2 allocation is a reservation envelope, not spent money. Existing
account billing was not inspected. No A-window clock or vacancy/sample count started.

The integrated `npm run verify` passed with strict types, Biome, 33 offline tests,
both workspace builds and Secretlint. A fresh local clone of setup commit
`9009001` also passed `npm ci` and `npm run verify` with the pinned runtime;
its tracked worktree stayed clean. Installation reported no audit findings and
one upstream deprecation warning for Cheerio's transitive `whatwg-encoding`.
Independent review separately ran experiment and affected network tests; the concurrency and marker-label findings were fixed
and rechecked. Markdown/YAML and relative documentation links were reviewed
manually. CI remains configured; no remote CI run or push is claimed.

All four required experiment branches remain unexecuted against their acceptance
samples. The transport smoke is not a passed source, extraction, model or Gmail
branch. Configure the intended private accounts/rights, finish the actual live
adapters and fixtures, then start the seven-day coverage window with the frozen
queries. After that first discovery dispatch, use `status` for the next due Berlin
date and record gaps; do not keep an agent waiting for calendar time.

## Current provider references

Reviewed 2026-10-19; these are public-document checks, not account compatibility
results. Existing subscriptions, credits, quotas, IAM and billing are unverified.

- Brave currently lists USD 5 per 1,000 Search requests. One hundred attempts are
  forecast at USD 0.50 before account-specific credits, currency and taxes. Do not
  assume credits. Result storage requires an entitlement expressly granting it;
  search access grants no rights to third-party pages. Confirm the actual plan
  before retaining URLs/snippets/raw results. [Pricing and storage](https://brave.com/search/api/).
  Use the documented [Web Search endpoint](https://api-dashboard.search.brave.com/app/documentation/web-search/get-started),
  not an additional LLM-context or Answers product. Respect actual
  [rate-limit headers](https://api-dashboard.search.brave.com/documentation/guides/rate-limiting),
  while the experiment counts all attempts, including errors and retries.
- Greenhouse documents unauthenticated GET access for published job-board data.
  This establishes technical access only. Check each selected employer's terms,
  permitted storage, attribution, retention and useful coverage. Never call its
  application POST endpoint. [Job Board API](https://docs.greenhouse.io/job-board).
- Provisional model: `gemini-3.5-flash-lite`, Standard PayGo, EU multi-region.
  Verify the operator's project and supported endpoint first; EU is not a
  Germany-only processing promise. [Model](https://docs.cloud.google.com/gemini-enterprise-agent-platform/models/gemini/3-5-flash-lite),
  [locations](https://docs.cloud.google.com/gemini-enterprise-agent-platform/resources/locations).
  Non-global standard list prices are USD 0.33/million input and USD 2.75/million
  output tokens, including reasoning: all 500k input/100k billed output tokens
  forecast USD 0.44, shared by the 100 attempts. Reprice against actual EUR SKUs,
  taxes, account terms and overhead. [Pricing](https://cloud.google.com/gemini-enterprise-agent-platform/generative-ai/pricing).
  Structured output still needs independent schema validation and at most one
  repair. [Structured output](https://docs.cloud.google.com/gemini-enterprise-agent-platform/models/capabilities/control-generated-output).
  Retention is not automatically zero: current docs describe project-scoped
  caching, including supported durable caching up to 24 hours; logging exceptions
  also apply. Use only synthetic facts and GenerateContent without additional
  grounding/storage features. [Retention](https://docs.cloud.google.com/gemini-enterprise-agent-platform/resources/zero-data-retention).
  CLI login does not establish ADC. [Local ADC setup](https://docs.cloud.google.com/docs/authentication/set-up-adc-local-dev-environment).
- Gmail's `gmail.compose` scope is restricted and permits sending as well as draft
  management. No sending method is allowed in the experiment. Dedicated draft-only
  code boundaries and tests are required before a write; account-holder consent is
  separate from the developer's G3 request. [Scopes](https://developers.google.com/workspace/gmail/api/auth/scopes),
  [draft creation](https://developers.google.com/workspace/gmail/api/reference/rest/v1/users.drafts/create).
  External OAuth apps in Testing normally receive seven-day refresh tokens for
  Gmail scopes. Verify the actual app state and document unobserved expiry behavior
  as unobserved. [OAuth token expiry](https://developers.google.com/identity/protocols/oauth2#expiration).

Before paid calls, allocate provider shares inside EUR 5 and the EUR 50/month
ceiling. A possible conservative reservation uses EUR 1 for discovery and EUR 1
for the model, leaving EUR 3 unallocated. A planning multiplier of EUR 2 per listed
USD provides currency/tax headroom for the above USD 0.94 subtotal; it is not an
exchange-rate quote or invoice guarantee. Recompute if actual prices or tax/FX
conditions do not fit. No new subscriptions, prepaid purchases, provisioning,
automatic top-ups or deployment are authorized by this setup.
