# Delivery plan

Updated: 2026-10-19. Status describes evidence, not estimated progress.

| Goal | Status | Outcome |
| --- | --- | --- |
| G0: repository foundation | Complete | Local Git repository, concept, shared agent rules, ADRs, and plan. |
| G1: feasibility brief | Complete | Accepted baseline, public-fetch policy, bounded experiment and fresh-session handoff. |
| G2: development foundation | Complete | Reproducible offline TypeScript workspace, synthetic fixtures, verification gate, and configured CI. |
| G3: feasibility experiment | In progress | Source, web search/page extraction, and Gmail evidence; explicit blockers if a path fails. |
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
what needs resolving before live experiments and retains the completed G2 contract.
The [archived G2 start prompt](START_PROMPT.md) records that bounded scope. Select
the next goal deliberately; G1 is complete as a brief and live results remain G3 work.

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

## G2: development foundation — complete

Dependencies: completed G1 brief; live credentials were not required.

- [x] Pin Node 24.22.0, npm 11.11.0, direct tooling and the committed npm lockfile;
      use one private `packages/core` workspace with strict TypeScript and Zod.
- [x] Run Biome formatting/lint/import checks, strict types, meaningful tests,
      build and maintained Secretlint rules behind `npm run verify` and configured CI.
- [x] Validate explicit offline configuration, distinct synthetic owner/candidate
      scopes, shared job facts and unknown evidence; reject invalid boundary inputs.
- [x] Document setup and tool decisions in [README](../README.md),
      [ADR 0006](adr/0006-offline-typescript-foundation.md) and the superseding
      [ADR 0007](adr/0007-biome-formatting-and-linting.md).
- [x] Complete separate planning, implementation and independent review; resolve
      material findings and re-review the affected changes.

Evidence (2026-10-19): a new local clone of commit `6687255` installed with `npm ci`
and passed `npm run verify` using the pinned runtime. All eight tests passed:
five schema/identity/evidence tests and three secret-scanner subprocess regressions.
Fresh test/build output was produced; repository secret scanning passed. Reversible
clean-clone probes made the full gate fail with exit 1 for bad formatting, explicit
`any`, and generated enabled-rule synthetic credentials in both a force-tracked
ignored `.env` file and a scanner-special filename. All probes were removed.

Independent review inspected actual code, tests, CI, decisions and evidence; it
also ran Biome, types, core tests and scanner regressions. A material finding about
Secretlint CLI filename exclusions was fixed by using the maintained engine's
explicit-file API, covered by regression tests and independently rechecked. No
material findings remain. Documentation links, relative `CLAUDE.md` symlink,
diffs and staged content were reviewed; the final integrated gate passed before
the completion commit.

Limits: CI is configured for push/pull requests, including forks, with read-only
permissions and no provider secrets; no remote CI run was observed or push made.
Biome does not check Markdown/YAML, which received manual review. These synthetic
scope checks are not production authentication or database/storage authorization.
No UI, emulator, source, model, Gmail or live integration is implemented/tested;
no browser check applies yet. Secret scanning covers selected working-tree files,
not Git history or runtime artifacts. License choice remains pending publication.

Next: G3's bounded feasibility experiment. Its model/region, access, source rights,
OAuth, privacy and budget checks and explicit live opt-in remain prerequisites in
[FEASIBILITY.md](FEASIBILITY.md). Q5's persistence/version/external-write contracts
remain for G4–G6. G2 does not authorize live execution, spending or deployment.

## G3: feasibility experiment

Dependencies: the completed G1 brief, G2 tooling and the applicable live-access checks in
[FEASIBILITY.md](FEASIBILITY.md). Each branch needs actual access and live opt-in.

Started 2026-10-19 at the user's request. No live discovery observation has begun;
the seven-day window starts with the first live discovery attempt, not setup.
Outcome and branch acceptance remain [FEASIBILITY.md](FEASIBILITY.md).

Bounded tasks: the coordinator establishes private operator/provider access and
current rights/rates, freezes twenty non-personal queries, and owns live evidence
and documentation. The implementation agent owns an experiment-only resumable
runner, cap reservations and offline failure tests, with ADR 0008. A separate
reviewer checks actual changes and evidence before handoff. No production UI,
authentication, persistence service or deployment is part of this setup slice.
Missing access affects its branch only; incomplete observations never pass G3.

Current setup evidence (2026-10-19): [G3_SETUP.md](G3_SETUP.md) records the
consumed allocation example, exact init/status commands, frozen manifest and current
provider-document checks. The private ledger initialized successfully and remains
without a discovery start. A reviewed real-HTTPS documentation smoke recorded two
zero-cost HTTP attempts: robots text retrieved; one page stopped at a conservative
HTML challenge marker. No vacancy, model or Gmail result follows from this probe.

Implemented: strict experiment configuration/state, exclusive initialization and
one-writer atomic persistence, cumulative/day cap and branch-budget reservations,
ambiguity/overrun handling, Berlin observation status, plus bounded public HTTP
and conservative Cheerio extraction. Offline regressions cover synthetic
control state, malformed inputs, restarts/locks, caps, DNS/redirect safety,
Retry-After concurrency, challenge labels and unconfirmed/truncated job pages.
Independent review resolved the concurrent429 and evidence-label findings and
rechecked affected changes. The integrated `npm run verify` passed: Biome, strict
types, 33 tests, both workspace builds and Secretlint. Final independent
documentation review and staged-content checks passed before the setup commit.
A fresh local clone of setup commit `9009001` passed `npm ci` and the same
33-test `npm run verify` gate with no tracked changes. No remote CI run or push
was performed; live account setup and all branch measurements remain pending.

Still needed: intended GCP project/region and actual ADC/IAM/API/terms, Brave key
and storage-rights plan, consenting Gmail OAuth/test identity, reviewed live
adapters, labeled samples and all seven observation days. Provider credentials
were not supplied in this session; the access question is pending. No paid
provider call, vacancy discovery, model request, real CV processing or Gmail write
has run. Optional alternative providers/renderers remain unexecuted. G3 stays
in progress; no branch acceptance or V1 completion is claimed.

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
