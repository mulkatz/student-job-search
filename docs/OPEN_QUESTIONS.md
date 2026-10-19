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
- The initial repository is local. No remote creation or publication is included.

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

Confirm the operator, cloud/billing project, monthly budget and per-test ceiling,
available source credentials, consenting Gmail test account, and who may access
candidate data. Decide LLM provider/data handling and retention before sending real
CV-derived facts. Candidate consent is separate from the developer requesting work.

**Current handling:** documentation and offline synthetic setup can continue. No
provider account, spend, OAuth consent, or personal-data access is assumed. The
original 400 listings / 40 evaluations / 5 drafts caps are proposals, not spending
authorization or a validated budget.

## Q3: source rights and useful coverage

**Needed before:** enabling a source; coverage threshold before G3 measurements.

Adzuna credentials, permitted reuse/retention/attribution, quotas, actual Berlin
coverage, and a curated employer-board list are unverified. Greenhouse/Lever board
availability alone does not establish useful student/Minijob coverage. Define a
minimum useful unique shortlist across an agreed observation period and report
the two search streams separately; the numerical threshold remains open.

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

**Fallback:** discovery and application text packages remain usable. Gmail acceptance
stays incomplete until tested; a fallback does not waive full MVP criteria.

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

- Select runtime/tool versions, framework, test tooling, deployment approach, and
  LLM provider after checking maintained official documentation.
- Define the human-label rubric, metric denominators, and minimum positive examples;
  tune provisional fit/confidence thresholds against the labeled fixture.
- Select a license and attribution before public distribution. The reference
  repository's intended MIT license does not automatically decide this project's.
- Broader use needs its own scope: onboarding, account lifecycle, OAuth production
  readiness, per-owner quotas/deletion, support, abuse prevention, and privacy review.
