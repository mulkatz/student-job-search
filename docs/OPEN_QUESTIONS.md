# Open decisions and validation needs

Updated: 2026-10-19. These are unresolved items, not an approval checklist for
routine work. Resolve technical details autonomously within agreed scope; ask for
product choices, unavailable access, consent, or unapproved spending when needed.
Keep personal candidate answers in private configuration rather than this file.

## Agreed baseline

- One-person pilot, designed with explicit private-data ownership for later reuse.
- Pilot working language: English; scope: Berlin and Germany-compatible remote work.
- Minijob, part-time, working-student, and short-term roles; no freelance-only or
  inflexible full-time roles for the pilot.
- Applicant sends/submits; the system prepares packages and unsent drafts.
- Automatic drafting starts disabled; matching and generation use approved facts.
- V1 includes CV processing, application text, Gmail drafts, web search, and direct
  employer-page extraction. V2 adds multi-user use and user-managed search orders.
- The user created `mulkatz/student-job-search` and authorized the first pushes;
  `main` tracks `origin/main`. Runtime deployment is not part of that action.

## Q1: pilot search/profile details

**Needed before:** meaningful personalized evaluation; not repository/tooling setup.

Availability, commute, minimum pay preference, start date, sectors, experience,
languages, and any relevant candidate-supplied work restrictions need confirmation.
Also confirm whether broader student work should receive the same ranking priority
as Minijobs. The current scope includes both; no hidden preference is assumed.

**Current handling:** unknown values remain unknown, no invented work authorization,
and decisive missing evidence prevents automatic drafting. The original proposal's
“confirmed” profile assumptions still require candidate review before live use.

## Q2: operating budget, access, and data processing

**Needed before:** paid resources, live providers, or real candidate data processing.

**Confirmed:** the user set a total monthly operating ceiling of EUR 50 for cloud,
search, and LLM on 2026-10-19. This is a budget constraint; no subscription or
resource provisioning is requested by the conception/setup task.

**Available, user-reported:** Firebase project with Blaze enabled, Gmail test account,
and Brave Search API. No live connection, model endpoint, OAuth client/refresh flow,
or Brave storage-rights plan has been verified. Project/IAM/region details and other
provider accounts remain unspecified.

Confirm the operator/project access, per-test ceiling, OAuth setup, actual source
plan/credentials configuration, and who may access candidate data. Decide LLM
provider/data handling and retention before sending real CV-derived facts.
Include search-provider queries and page-fetch limits in the cost
ceiling. Candidate consent is separate from the developer requesting work.

**Current handling:** documentation and offline synthetic setup can continue. No
unreported provider account, spend, OAuth consent, or personal-data access is assumed.
The original 400 listings / 40 evaluations / 5 drafts caps are proposals, not spending
authorization or a validated budget.

## Q3: source rights and useful coverage

**Needed before:** enabling a source; coverage threshold before G3 measurements.

Adzuna credentials, permitted reuse/retention/attribution, quotas, actual Berlin
coverage, and a curated employer-board list are unverified. Greenhouse/Lever board
availability alone does not establish useful student/Minijob coverage. Define a
minimum useful unique shortlist across an agreed observation period and report
the two search streams separately; the numerical threshold remains open. Include
search-discovered small-employer jobs, incremental coverage beyond structured
sources, and the distinction between a generic careers page and an actual vacancy.

Brave access is available, but remains an unverified integration and plan. Consider
Serper, Tavily, and Exa alongside it using the comparison in
[PROVIDERS_AND_COSTS.md](PROVIDERS_AND_COSTS.md). Search-result storage rights must fit
the chosen plan, and search API access does not grant rights to third-party pages.
Google Custom Search JSON API is closed to new customers and scheduled to end on
January 1, 2027; do not use it as an assumed available default. See dated official
references in [SOURCE_DISCOVERY.md](SOURCE_DISCOVERY.md).

**Required evidence:** current official terms/API references and review date, bounded
sample results, duplicate rate, language/location uncertainty, source health, and
manually reviewed role suitability. Store only samples allowed by the source policy.
If coverage is poor, revisit permitted sources before expanding the dashboard.

## Q4: Gmail feasibility and ambiguous-write recovery

**Needed before:** unattended drafts; investigate in the early feasibility experiment.

Validate current compose-scope classification, consent/test/verification constraints,
refresh behavior, and reconnect. The proposed scope also permits sending; code and
tests must enforce the narrower product behavior. Do not assume verification
exemptions, seven-day token behavior, or a sender identity without checking.

The proposal excludes mailbox monitoring. Reconciliation after “Gmail succeeded,
database write failed” still needs a precise method. Choose either an explicitly
authorized, narrowly scoped draft lookup or manual reconciliation; neither may
silently introduce mailbox monitoring or blind retries. Define stale pending-state
recovery and how a user confirms whether a draft exists.

**Degraded operation:** discovery and application text packages remain usable.
Gmail acceptance stays incomplete until tested; V1 cannot be declared complete
without working Gmail drafts. This is not a feature deferred to V2.

## Q5: identity, versions, and state contracts

**Needed before:** implementing the corresponding persistence/generation slice.

Resolve these inconsistencies in the original proposal through schemas/tests and
an ADR, rather than copying the sample types as final contracts:

- A source-derived hash is a stable source identity, not by itself a cross-source
  canonical job identity. Define canonical IDs, aliases/merges, and revision history.
- `applications/{candidateId_jobId}` and per-profile-version idempotency need distinct
  parent/application and package/generation-attempt records. Define which version
  changes permit a new package and whether a new external draft needs user action.
- Content freshness, publication age, source check time, and successful recruitment-
  channel verification are distinct timestamps. A fresh fetch cannot make an old
  listing new or prove its application channel is verified.
- UI status, generation status, and external-write/reconciliation status are separate
  state machines; a flat `pending` string or unbounded event array is insufficient.
- Owner-scoped reads/writes must be enforced by API, database/storage rules, and
  server credential resolution, not only by adding `candidateId` fields.

## Q6: thresholds, tooling, and wider distribution

**Needed before:** the affected slice or publication, not initial documentation.

- Select runtime/tool versions, framework, test tooling, and deployment approach
  after checking maintained official documentation. The first LLM route is open:
  GCP-managed Gemini is recommended initially; OpenRouter remains an alternative
  behind the same boundary. See [the proposed provider ADR](adr/0004-provider-boundaries-and-initial-candidates.md).
- Select the first extraction dependency using [the delegated market research](EXTRACTION_OPTIONS.md):
  controlled HTTP/Cheerio is recommended, with at most one evidence-driven
  Playwright/Firecrawl fallback. Costs and access conditions still need live evaluation.
- Define the human-label rubric, metric denominators, and minimum positive examples;
  tune provisional fit/confidence thresholds against the labeled fixture.
- Select a license and attribution before public distribution. The reference
  repository's intended MIT license does not automatically decide this project's.
- Broader use needs its own scope: onboarding, account lifecycle, OAuth production
  readiness, per-owner quotas/deletion, support, abuse prevention, and privacy review.

## Q7: broad public-page crawl policy

**Needed before:** automatic employer-page fetching; does not block offline fixtures.

The user requests broad discovery including pages outside conventional platforms,
without automatically excluding leads because of robots.txt or similar restrictions.
Preserve that intent; do not silently limit results to APIs or a fixed employer list.

Robots directives, actual authentication/access controls, site terms, provider
retention rights, and technical availability are different inputs. RFC 9309 states
that robots rules are not access authorization. A universal “fetch everything despite
all restrictions” guarantee is not a feasible V1 contract. The exact policy for
robots-disallowed/unknown pages and conflicting site conditions remains unresolved;
it must be explicit and covered by tests before the live crawler is implemented.

Define behavior for missing/unreadable robots files, HTTP 401/403/429, redirects,
JS-only pages, and content unavailable to the extractor. Rate/budget limits, internal-
network protection, and bounded link traversal remain technical requirements.
Keep unavailable leads with their original URL and a reason when retention permits;
they must not gain invented facts, verified channels, or automatic drafts.
