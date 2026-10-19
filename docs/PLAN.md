# Delivery plan

Updated: 2026-10-19. Status describes evidence, not estimated progress.

| Goal                              | Status      | Outcome                                                                                    |
| --------------------------------- | ----------- | ------------------------------------------------------------------------------------------ |
| G0: repository foundation         | Complete    | Local Git repository, concept, shared agent rules, ADRs, and plan.                         |
| G1: feasibility brief             | Complete    | Accepted baseline, public-fetch policy, bounded experiment and fresh-session handoff.      |
| G2: development foundation        | In progress | Executable TypeScript workspace, synthetic fixtures, verification gate, and CI.            |
| G3: feasibility experiment        | Planned     | Source, web search/page extraction, and Gmail evidence; explicit blockers if a path fails. |
| G4: discovery slice               | Planned     | Traceable, deduplicated job discoveries in an authenticated UI and daily pipeline.         |
| G5: profile and matching          | Planned     | Approved profiles and evidence-based matching meet the fixture targets.                    |
| G6: application assistant         | Planned     | Fact-grounded packages and recoverable, unsent Gmail drafts.                               |
| G7: V1 release and handover       | Planned     | CV, application text, Gmail drafts, and bounded daily discovery meet V1 acceptance.        |
| V2: broader use and search orders | Deferred    | Multi-user onboarding and individually managed search orders/schedules.                    |

G1–G7 deliver V1. Discovery, matching, and application slices are internal delivery
milestones, not a split that moves CV or Gmail to V2. A Gmail blocker may permit
continued discovery development but prevents claiming V1 complete.

## Working method

The [conception closure and implementation handoff](IMPLEMENTATION_START.md) defines
what needs resolving before live experiments and the exact first G2 outcome. The
[fresh-session start prompt](START_PROMPT.md) initiates that bounded goal; it does
not request the whole V1 in one run. G1 is complete as a brief; live results remain G3 work.

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

## G1: feasibility brief — complete

- [x] G1.1a: Record the user-confirmed EUR 50 total monthly operating ceiling.
- [x] G1.1b: Define the EUR 5 experiment planning sublimit and explicitly record
      project/IAM/region/OAuth/plan checks as G3 prerequisites, not verified facts.
- [x] G1.1c: Record user-reported Firebase/Blaze, Gmail test account and Brave access.
- [x] G1.2: Define a seven-day coverage benchmark: 10 compatible unique vacancies,
      including 3 incremental web discoveries; report the two streams separately.
- [x] G1.3: Record core pilot defaults and keep private candidate facts/preferences
      unknown until onboarding; do not block offline tooling on missing CV details.
- [x] G1.4: Write [FEASIBILITY.md](FEASIBILITY.md) with sample sizes, shared cost/work
      caps, positive/negative-case criteria, manual Gmail reconciliation and evidence.
- [x] G1.5: Resolve Q7 through ADR 0005's broad public-fetch policy; specific source
      rights and actual provider storage/access behavior remain G3 checks.
- [x] G1.6: Adopt GCP-managed Gemini and Brave behind replaceable boundaries;
      alternatives remain bounded comparisons, not required production integrations.
- [x] G1.7a: Complete delegated [extraction market research](EXTRACTION_OPTIONS.md).
- [x] G1.7b: Adopt HTTP/Cheerio initially; define the fallback comparison and limit
      any later fallback adoption to one justified by measured benefit.
- [x] Independently review the experiment contract; resolve non-vacuity findings
      with minimum successes and explicit recall/positive-case criteria.

Evidence: the accepted ADRs 0004/0005, experiment contract and implementation handoff.
Documentation links, diffs, shared instructions and sensitive-content checks pass.
No live tests have run. G1 completion means a usable brief; it does not certify
integration feasibility, source coverage, legal eligibility or a finished V1.

## G2: development foundation

Dependencies: completed G1 brief; live credentials are not required for offline setup.

Outcome: a clean checkout installs reproducibly and passes `npm run verify`; CI
uses that same gate without provider secrets or live services. Acceptance follows
[IMPLEMENTATION_START.md](IMPLEMENTATION_START.md#first-fresh-session-goal-g2).

Bounded work: a planning agent defines the minimal foundation; an implementation
agent owns runtime/configuration, the core workspace, tests, CI and ADR 0006; the
coordinator maintains setup/handoff documentation and clean-checkout evidence; a
separate reviewer inspects the actual diff and checks. Q5 is resolved only for the
synthetic owner/candidate boundary; persistence and external-write contracts remain
for their delivery slices. No browser/emulator layer is implemented in G2.

Tooling update: the user requested Biome instead of Prettier/ESLint during G2.
The follow-up uses one Biome formatter/linter and keeps strict TypeScript checking
separate; ADR 0007 records the superseding decision. Clean-checkout and negative
probes must be repeated against the final tooling before completion.

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

Dependencies: the completed G1 brief, G2 tooling and the applicable live-access checks in
[FEASIBILITY.md](FEASIBILITY.md). Each branch needs actual access and live opt-in.

- [ ] Verify the current provider/model/region, source rights/plan and operator/OAuth
      prerequisites; reserve within the experiment caps before live execution.
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
- [ ] Execute the synthetic CV, 20-case matching and 5-package model branch with
      the positive/negative-case and repair limits from FEASIBILITY.md.
- [ ] Report all four required branches with counts, evidence, costs and decisions;
      distinguish optional unexecuted comparisons from required missing observations.

Exit: the required seven-day observations and source/extraction/model/Gmail branches
have executed findings and explicit decisions. A supported negative finding can
complete the investigation but is not a passed criterion; revise the affected
delivery plan. A required branch blocked before observation keeps G3 incomplete.
Independent work may continue, but source success cannot imply Gmail success or
V1 release readiness. Optional comparisons are reported separately.

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
