# Delivery plan

Updated: 2026-10-19. Status describes evidence, not estimated progress.

| Goal | Status | Outcome |
| --- | --- | --- |
| G0: repository foundation | Complete | Local Git repository, concept, shared agent rules, ADRs, and plan. |
| G1: feasibility brief | Next | Resolve blocking choices and define a bounded, measurable experiment. |
| G2: development foundation | Planned | Executable TypeScript workspace, synthetic fixtures, verification gate, and CI. |
| G3: feasibility experiment | Planned | Source, web search/page extraction, and Gmail evidence; explicit blockers if a path fails. |
| G4: discovery slice | Planned | Traceable, deduplicated job discoveries in an authenticated UI and daily pipeline. |
| G5: profile and matching | Planned | Approved profiles and evidence-based matching meet the fixture targets. |
| G6: application assistant | Planned | Fact-grounded packages and recoverable, unsent Gmail drafts. |
| G7: V1 release and handover | Planned | CV, application text, Gmail drafts, and bounded daily discovery meet V1 acceptance. |
| V2: broader use and search orders | Deferred | Multi-user onboarding and individually managed search orders/schedules. |

G1–G7 deliver V1. Discovery, matching, and application slices are internal delivery
milestones, not a split that moves CV or Gmail to V2. A Gmail blocker may permit
continued discovery development but prevents claiming V1 complete.

## Working method

The [conception closure and implementation handoff](IMPLEMENTATION_START.md) defines
what needs resolving before live experiments and the exact first G2 outcome. The
[fresh-session start prompt](START_PROMPT.md) initiates that bounded goal; it does
not request the whole V1 in one run. G1 remains open pending its remaining decisions.

For each goal, define the outcome, dependencies, acceptance criteria, and smallest
reviewable tasks. Planning precedes substantive implementation; a separate reviewer
checks actual changes and evidence before completion. Roles and Git rules are in
[AGENTS.md](../AGENTS.md). A goal is complete only when its exit criteria have evidence.

Keep this plan current at goal boundaries. Record significant decisions in ADRs
and unresolved questions in [OPEN_QUESTIONS.md](OPEN_QUESTIONS.md). Task records can
live here until a remote issue tracker exists; an external project board is not
required. Report blockers with the missing evidence or access and a concrete next
action. Independent tasks may proceed while an integration is blocked.

## G0: repository foundation

- [x] Preserve the original proposal and establish the current concept.
- [x] Adopt the StateParcel collaboration and commit rules with product-specific adaptations.
- [x] Record the one-person pilot with explicit ownership for later reuse.
- [x] Establish a plan and decision backlog; initialize local Git.

Exit: documentation links and relative `CLAUDE.md` symlink resolve; no runtime or
external integration is claimed. Initial sensitive-content checks passed. The user
subsequently created the GitHub repository and authorized pushing `main`; the
initial commit is now on `origin/main`.

## G1: feasibility brief — next

Dependencies: G0. No external account access is needed for the brief itself.

- [x] G1.1a: Record the user-confirmed EUR 50 total monthly ceiling for cloud/search/LLM.
- [ ] G1.1b: Confirm account/project ownership, per-experiment cost ceiling, and
      live-test access (Q2). Missing credentials need not block synthetic tooling.
- [ ] G1.2: Define source-coverage measures and a go/no-go threshold (Q3): inspect
      both Berlin on-site and Germany-remote streams; report unique, fresh,
      plausible roles by employment type, language evidence, and review outcome.
      Include incremental coverage from small employer pages beyond structured sources.
- [ ] G1.3: Confirm available pilot search/profile defaults (Q1); record remaining
      unknowns without delaying offline tooling. Keep private candidate answers
      out of repository documentation.
- [ ] G1.4: Write a concise experiment checklist with current official references,
      request/token/draft caps, synthetic applicant input, evidence format, and
      cleanup. Confirm Gmail feasibility separately from source coverage (Q4).
- [ ] G1.5: Resolve the public-page crawl policy (Q7) and select a candidate search
      provider/plan with compatible retention and AI use. Reference the dated
      findings in [SOURCE_DISCOVERY.md](SOURCE_DISCOVERY.md).

Exit: measurable source success criteria and a bounded test plan exist; all live
actions have the necessary access, consent, and cost authorization before execution.
Document an incomplete discovery slice if Gmail is blocked. Do not invent access or label
a test passed because the documentation suggests it should work.

## G2: development foundation

Dependencies: G1's scope; live credentials are not required for offline setup.

- [ ] Select and pin maintained runtime/package versions; define workspace structure
      and one package manager. Record significant choices and actual commands.
- [ ] Set up formatting, linting, strict types, meaningful tests, build, and secret
      scanning behind one `verify` command and CI. No live external calls by default.
- [ ] Add synthetic candidate/job fixtures, typed configuration, and a private
      owner/candidate boundary (Q5); add emulator/browser checks as those layers appear.
- [ ] Document local setup with placeholder-only configuration. Decide the license
      before publication; this does not block private development.

Exit: a clean checkout can install and run the documented gate; CI enforces it
without secrets or paid services. Review independently before substantive product work.

## G3: feasibility experiment

Dependencies: G1, minimal G2 tooling, and authorized provider access.

- [ ] Review source terms, attribution, storage/retention, quotas, endpoints, and
      redirects. Record source-policy evidence and enable only permitted sources.
- [ ] Fetch bounded samples; curate five employer boards if available and measure
      real coverage against G1's threshold, not just HTTP success.
- [ ] Test search-query → employer career page → individual vacancy extraction on
      smaller local employers; distinguish leads, blocked/unavailable pages, and
      confirmed vacancies. Measure additional unique jobs beyond API/board samples.
- [ ] Check current Gmail/OAuth requirements and create one synthetic draft addressed
      to the consenting test account with a test attachment. Never send it.
- [ ] Check token lifecycle/reconnect and document recovery constraints. Keep tokens,
      captures, account identifiers, and provider-controlled private data out of Git.

Exit: at least one permitted source meets the coverage threshold and a separate
search/page-extraction sample reports its outcome. Gmail draft creation has direct
evidence or remains an explicit V1 blocker. Internal discovery work can continue,
but source success cannot imply Gmail success or V1 release readiness.

## G4: discovery slice

Dependencies: G2 and a viable source in G3.

- [ ] Resolve canonical job/source identities and revision semantics (Q5).
- [ ] Implement source registry/adapters, normalization, stable identity, conservative
      duplicate linking, revisions, cursor recovery, and source-isolated failures.
- [ ] Implement web-search leads, bounded public-page fetching/extraction, shared
      deduplication, source-policy handling, and traceable extraction evidence.
- [ ] Build an authenticated job table sorted by fit score, original application
      links, concise evidence/unknowns, and expandable details.
- [ ] Add the bounded daily Europe/Berlin run, overlap protection, and diagnostics.
- [ ] Enable a second permitted adapter and demonstrate web-discovered vacancies
      outside the structured-source set before declaring V1 complete.

Exit: repeatable daily discoveries are traceable and nonduplicated; UI works in a
real browser and private data is inaccessible to unauthorized users.

## G5: profile and matching

Dependencies: G4; ownership/data-lifecycle decisions resolved before real CV use.

- [ ] Define profile/evaluation version contracts (Q5); add private PDF upload,
      extraction, correction, approval, and profile versions.
- [ ] Implement conservative filters, schema-validated evaluation, and evidence UI.
- [ ] Evaluate at least 50 human-labeled varied postings against `CONCEPT.md` targets.

Exit: documented benchmark results meet targets and candidate facts remain traceable;
uncertain eligibility does not become confirmed through scoring.

## G6: application assistant

Dependencies: G5, verified channels, and the Gmail branch of G3 for draft features.

- [ ] Resolve application/package/generation-attempt identities and state contracts
      (Q5) before implementing their persistence and external writes.
- [ ] Generate fact-grounded text packages and verified email/ATS routes.
- [ ] Add manual Gmail creation, attachment checks, token disconnect/reconnect,
      ambiguous-write recovery, and manual applied/ignored status.
- [ ] Test absent send paths and crashes around external writes; validate opt-in
      auto-drafting separately after the manual path meets acceptance criteria.

Exit: verified end-to-end packages/drafts contain supported claims, sending remains
manual, and retries cannot silently create duplicate drafts. Gmail blockers leave
packages available but do not satisfy V1's Gmail criteria.

## G7: V1 release and operational handover

Dependencies: all preceding V1 slices, including CV processing and Gmail; review
every V1 criterion. An incomplete discovery slice cannot pass this goal.

- [ ] Verify retention, export/deletion, ownership enforcement, and minimal telemetry.
- [ ] Exercise cost caps, source/token failures, alerts, and recovery; write a runbook.
- [ ] Demonstrate the real-browser review-to-manual-application workflow with safe data.
- [ ] Record acceptance evidence and limitations; scope a separate goal for broader use.

Exit: every V1 criterion in `CONCEPT.md` has evidence. Missing CV, application text,
or Gmail acceptance keeps V1 incomplete. No general multi-user availability is implied.

## V2: broader use and user-managed search orders — deferred

Dependencies: a useful, accepted V1; define a new bounded goal before implementation.

- [ ] Design onboarding and account lifecycle for additional owners, OAuth production
      readiness, per-owner quotas, privacy, deletion, and support.
- [ ] Add user-managed search orders: create/edit, geography/keywords/preferences,
      active/paused state, and individual schedules.
- [ ] Validate cross-user isolation and concurrent runs before broader availability.

V1 retains operator-configured streams and profile correction; it does not need
this management interface to personalize matches for the pilot candidate.
