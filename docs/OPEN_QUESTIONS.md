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
- Applicant copies/sends/submits; the system prepares reviewable email or questionnaire
  packages. Missing facts are `needs_input`; consents/signatures/declarations require
  `applicant_action_required`. Matching and generation use approved versioned facts.
- Gmail is exclusively a Firebase Auth login identity; no mailbox integration is
  included in current V1/G3 or promised for V2 (ADR 0010).
- V1 includes CV processing, manual-copy application packages, web search, and direct
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
and decisive missing evidence prevents a ready-to-use application package. The original proposal's
“confirmed” profile assumptions still require candidate review before live use.

## Q2: operating budget, access, and data processing

**Needed before:** paid resources, live providers, or real candidate data processing.

**Confirmed:** the user set a total monthly operating ceiling of EUR 50 for cloud,
search, and LLM on 2026-10-19. This is a budget constraint; no subscription or
resource provisioning is requested by the conception/setup task.
The G3 experiment has a EUR 5 planning sublimit and shared work caps in
[FEASIBILITY.md](FEASIBILITY.md); live execution still needs its entry checks and opt-in.

**Current access:** the EU-preferred project is designated privately. CLI/ADC
project reads and enabled billing are verified, and Vertex API enablement succeeded.
Conservative combined-output reservations and settled usage accounting are
implemented; EU synthetic inference and usage are observed, with failed first-pass
content cases and the full C/D sample still incomplete. The local Brave credential
and Search/Postpaid tariff are confirmed; no applicable storage/use grant is
established. Account/project identifiers and credential values stay private.

Verify operator/project access, authentication setup, actual source
plan/credentials configuration, and who may access candidate data. Decide LLM
provider/data handling and retention before sending real CV-derived facts.
Include search-provider queries and page-fetch limits in the cost
ceiling. Candidate consent is separate from the developer requesting work.

**Current handling:** partial direct-page and synthetic model pilots are measured;
no Brave benchmark has run. Alpha's synthetic facts are explicitly approved
privately; this does not approve real candidate facts or generated packages. No
unreported provider account, spend or personal-data access is assumed.
The original 400 listings / 40 evaluations / 5 drafts caps are proposals, not spending
authorization or a validated budget.

## Q3: source rights and useful coverage

**Needed before:** enabling a source; actual coverage is measured in G3.

Adzuna credentials, permitted reuse/retention/attribution, quotas, actual Berlin
coverage, and a curated employer-board list are unverified. Greenhouse/Lever board
availability alone does not establish useful student/Minijob coverage. G1 defined
the initial benchmark in [FEASIBILITY.md](FEASIBILITY.md): 10 compatible unique
vacancies over seven days, including 3 additional web discoveries, with separate
stream results. Actual yield is unmeasured. Distinguish generic career leads from
vacancies and cross-source duplicates from additional coverage.

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

## Q4: manual application-package review and copying — scope resolved

**Decision:** [ADR 0010](adr/0010-manual-application-packages.md) replaces Gmail
integration in V1/G3. Gmail is exclusively the Firebase Auth login identity.
There is no Gmail API, mailbox OAuth, credential storage, draft creation or sending.
No automatic future integration is promised.

G3 D manually reviews the same five packages as C: two email and three
questionnaire packages. Review exact full content and record its hash; bind
questionnaire answers to internal field IDs mapped to source-evidenced question text. Unknown start dates
remain unanswered, and consents/signatures/declarations require applicant action.
Pending synthetic profile approval or unreviewed package content keeps this branch
incomplete. G6 will implement and exercise the shared dialog, per-answer clipboard
copying and manual application workflow in a real browser; no UI exists now.

## Q5: identity, versions, and state contracts

**Needed before:** implementing the corresponding persistence/generation slice.

**G2 boundary resolved:** [ADR 0006](adr/0006-offline-typescript-foundation.md) and
synthetic tests define distinct owner/candidate identities and reject mismatched or
missing private scopes. This is a local domain contract, not authentication or
database/storage authorization. The persistence/version/state questions below
remain unresolved for their respective slices.

Resolve these inconsistencies in the original proposal through schemas/tests and
an ADR, rather than copying the sample types as final contracts:

- A source-derived hash is a stable source identity, not by itself a cross-source
  canonical job identity. Define canonical IDs, aliases/merges, and revision history.
- `applications/{candidateId_jobId}` and per-profile-version idempotency need distinct
  parent/application and package/generation-attempt records. Define which version
  changes permit a new package and how review hashes and user edits bind to versions.
- Content freshness, publication age, source check time, and successful recruitment-
  channel verification are distinct timestamps. A fresh fetch cannot make an old
  listing new or prove its application channel is verified.
- UI status, generation/review status and manual application status are separate
  state machines; a flat `pending` string or unbounded event array is insufficient.
- Owner-scoped reads/writes must be enforced by API, database/storage rules, and
  authenticated owner resolution, not only by adding `candidateId` fields.

## Q6: thresholds, tooling, and wider distribution

**Needed before:** the affected slice or publication, not initial documentation.

- G2 selects and pins the offline runtime, package manager, validation and test
  tooling in [ADR 0006](adr/0006-offline-typescript-foundation.md) and the
  superseding [ADR 0007](adr/0007-biome-formatting-and-linting.md), after checking
  official documentation. Framework and deployment choices remain for their slices.
  The first LLM route is accepted:
  GCP-managed Gemini, with OpenRouter as an alternative behind the same boundary.
  Select the exact model/region in G3; see [ADR 0004](adr/0004-provider-boundaries-and-initial-candidates.md).
- HTTP/Cheerio is selected initially using [the delegated market research](EXTRACTION_OPTIONS.md).
  A possible Playwright/Firecrawl fallback remains a measured G3 comparison; its
  costs and access conditions are not yet verified.
- G3's initial labels, minimum positives and metric definitions are in FEASIBILITY.md.
  Extend the rubric for G5's final 50-posting fixture and calibrate provisional
  fit/confidence thresholds against it.
- Select a license and attribution before public distribution. The reference
  repository's intended MIT license does not automatically decide this project's.
- Broader use needs its own scope: onboarding, authentication/account lifecycle, per-owner quotas/deletion, support, abuse prevention, and privacy review.

## Q7: broad public-page crawl policy — resolved for initial implementation

**Decision:** [ADR 0005](adr/0005-bounded-experiment-and-public-fetch-policy.md).
Robots metadata is recorded and is not by itself a lead exclusion or public-fetch
block. New domains remain discoverable. Authentication/CAPTCHA/401/403 stop the
page attempt; 429/Retry-After, network safety and bounded resource limits apply.
Source-specific terms, storage rights and actual hosted-provider behavior remain
G3 checks. Known conflicting restrictions need resolution for that use. This is
an operating policy, not a universal extraction/permission guarantee. Preserve
unavailable or policy-unresolved leads where retention permits, without fabricated
facts or ready-to-use application packages. Tests must cover the policy when fetches are implemented.
