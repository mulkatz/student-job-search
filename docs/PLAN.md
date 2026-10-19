# Delivery plan

Updated: 2026-10-19. Status describes evidence, not estimated progress.

| Goal | Status | Outcome |
| --- | --- | --- |
| G0: repository foundation | Complete | Local Git repository, concept, shared agent rules, ADRs, and plan. |
| G1: feasibility brief | Complete | Accepted baseline, public-fetch policy, bounded experiment and fresh-session handoff. |
| G2: development foundation | Complete | Reproducible offline TypeScript workspace, synthetic fixtures, verification gate, and configured CI. |
| G3: feasibility experiment | In progress | Source, web search/page extraction, synthetic model and manual-package evidence; explicit blockers. |
| G4: discovery slice | In progress | Traceable, deduplicated job discoveries in an authenticated UI and daily pipeline. |
| G5: profile and matching | Planned | Approved profiles and evidence-based matching meet the fixture targets. |
| G6: application assistant | Planned | Fact-grounded email/questionnaire packages in a shared review/copy dialog. |
| G7: V1 release and handover | Planned | CV, manual-copy application packages and bounded daily discovery meet V1 acceptance. |
| V2: broader use and search orders | Deferred | Multi-user onboarding and individually managed search orders/schedules. |

G1–G7 deliver V1. Discovery, matching and application packages remain required
internal milestones. [ADR 0010](adr/0010-manual-application-packages.md) replaces the
historical Gmail clauses below with manual review/copy packages; Gmail now serves
Firebase Auth login only. No later mailbox integration is promised.

## Working method

The [conception closure and implementation handoff](IMPLEMENTATION_START.md) defines
what needs resolving before live experiments and retains the completed G2 contract.
The [archived G2 start prompt](archive/G2_START_PROMPT.md) records that bounded scope. Select
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

The user requested local integration on `main` and a fresh-session G4 handoff.
Use [START_PROMPT.md](START_PROMPT.md) for that continuation; it preserves G3's
unfinished evidence and G4's viable-source prerequisite. Only `main` exists locally;
finished task-owned work is committed there, without an artificial merge or push.
The handoff documentation and corrected private proposals received independent
review with no remaining material findings. Human content approval remains pending.

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
privacy and budget checks and explicit live opt-in remain prerequisites in
[FEASIBILITY.md](FEASIBILITY.md). Q5's persistence/version/package-review contracts
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

Current follow-up: after the initial permission failure, the privately designated
EU-preferred project's CLI/ADC reads and enabled billing were verified. Vertex AI
API enablement succeeded without deployment, IAM or billing changes. The local
Brave credential and Search/Postpaid tariff are confirmed; no applicable storage/use
grant is established. Current public help/terms require a resolution before retaining results.
No project/account IDs or credential values belong in Git.
Offline C corpus work is implemented and locally verified: three synthetic profiles,
five PDF inputs, twenty labeled jobs, five packages, strict schemas, prompts and scoring.
Five valid PDF
pages were visually inspected, scan-only text absence checked and malformed input
rejected locally. The final corpus hash and private artifact references are in
[G3_SETUP.md](G3_SETUP.md). The follow-up integrated gate passed Biome, strict types,
47 offline tests, builds and Secretlint. The user has since explicitly approved
Alpha's ten synthetic facts in a private corpus-bound receipt. Partial model
observations now exist; human package-content approvals and full C/D remain incomplete.

The first live B pilot examined ten local employer targets: three HTML captures,
seven marker stops, one independently labeled specific advert and four present
decisive values. Frozen labels preceded extraction. The JSON-LD-only baseline
recovered 0/4 values and 0 correct details; precision is undefined with no populated
claims. This small pilot is incomplete evidence. A separate bounded diagnostic
identified an incidental-marker false positive and informed a reviewed correction;
old results remain unchanged. The evidence and remaining 30-URL requirements are
in [G3_SETUP.md](G3_SETUP.md#first-live-extraction-pilot).
HTTP attempts total 22, all settled; synthetic model calls are recorded below.
No real CV processing or discovery benchmark has run. A's window remains unstarted. Optional
alternative providers/renderers remain unexecuted. The final benchmark/fetch gate
passed Biome, strict types, 59 offline tests, both builds and Secretlint over
68 repository files. Independent review resolved findings and rechecked the
affected code, three captured HTML pages, frozen labels and actual pilot score.
Earlier 33/47-test gates remain historical evidence; no UI journey or remote CI
run is claimed.

The user's CaptchaKraken proposal was checked against primary provider documentation
and the existing access policy. It remains a deferred, untested candidate in
[EXTRACTION_OPTIONS.md](EXTRACTION_OPTIONS.md#captchakraken-deferred-optional-candidate):
the pilot has no confirmed real CAPTCHA gate, and research does not supersede
ADR 0005's stop rule or authorize US processing, purchases or application-form writes.
The user explicitly deferred solver work until after the current gate.
A separately versioned post-correction fetch retrieved one new career/list page
in one request. Independent inspection confirmed readable role summaries and
incidental CAPTCHA text; the old marker applied offline would have stopped those
same bytes. Original pilot labels/scores remain unchanged. This is transport
evidence only, not a full B, freshness or compatibility pass; see
[the follow-up evidence](G3_SETUP.md#post-correction-transport-check).

Implemented bounded C task: preserve immutable per-call reservations while accounting
complete settled model usage separately (ADR 0011), add pure Vertex request/response
validation, and independently review the private opt-in operator before dispatch.
Acceptance: pending/ambiguous usage keeps its full bound, all existing caps remain,
reported overruns persist and block new calls, and a sequential synthetic live case
records its real endpoint, payload, output, usage and first-pass validation.
CountTokens is a separate free preflight, conservatively counted against model
request limits; it is not a generated CV or matching result. No solver or V1 UI is added.
The accounting/helpers and private operator are independently reviewed, with
findings fixed and rechecked. The integrated gate passes 74 offline tests, Biome,
strict types, both builds and Secretlint; no dispatch is claimed by that gate.
The separately reviewed live operators observed three textual CVs, five package
first passes, exactly six single repairs and one matching case. Original failures
remain recorded, including two CV boolean normalizations and two truncated package
outputs. Final CV facts/quotes match 10/10, 8/8 and 4/4; scan/malformed outcomes are
correct locally. All repaired outputs are schema-valid, but package 02 still uses
an out-of-scope fact for one field and package 03 adds unsupported skill proficiency.
These model content failures remain failures after separate editorial corrections;
none of the five packages has human approval. Job 01 matches its expected decision.
The cumulative ledger has 30 LLM requests (15 free preflights + 15 generations),
17,534 effective input/7,461 billed output tokens and EUR 0.052615 accounted cost
using conservative headroom rather than an invoice. Independent review reconciled
all receipts. Every original bound remains immutable, and no outstanding attempt,
overrun or reconciliation is present. The Berlin daily cap is reached on 2026-10-19.
See [the actual model evidence](G3_SETUP.md#first-live-model-observations).
Next: preserve the two content findings, review corrected package versions with
the user, and observe the remaining nineteen matching cases from 2026-10-20 within
caps. Source rights and the unstarted seven-day discovery window remain separate
dependencies; a handoff to G4 does not complete them.

The user challenged the internal 40-HTTP/day throttle. The experimental daily
restriction is removed under ADR 0012 while retaining the cumulative 200-request cap,
all existing accounting, explicit bounded runs, source limits, pacing and persisted
429/Retry-After handling. This is a local runner rule, not an observed provider
quota. Search/model daily controls and A's seven-day sampling protocol are separate.
Acceptance: more than 40 same-day HTTP attempts survive restart, attempt 200 fits
and attempt 201 is denied, while failures/outstanding work and the other caps count.
The integrated `npm run verify` passes Biome, strict types, 75 offline tests
(5 core, 67 experiment, 3 scanner), both builds and Secretlint over 74 repository
files. The private cumulative ledger is unchanged by these checks.

An additional B cohort/operator is prepared privately under
`.local/g3/extraction-expansion-v1/`: eight new static-detail targets across six
hosted employer origins, separate source-policy records and guarded opt-in capture.
It is not independently reviewed or executed. Review before dispatch; preserve
original captures/labels and collect new labels before extraction.
Known source restrictions exclude affected targets; no solver or paid fallback is
introduced. This cohort leaves JS, career and negative strata outstanding.
The user requested session closure on 2026-10-19: pause G3 with the current ledger
unchanged at 22 HTTP and 30 model attempts, no outstanding work and no A clock.
The next fresh-session G4 prompt retains its viable-source prerequisite and G3 gaps.

- [ ] Verify current provider/model/region, source rights/plan and operator access;
      reserve within the experiment caps before live execution.
- [ ] Review source terms, attribution, storage/retention, quotas, endpoints and
      redirects. Record source-policy evidence and enable only permitted sources.
- [ ] Fetch bounded samples; curate up to five employer boards and measure real
      coverage against G1's threshold, not just HTTP success.
- [ ] Test search-query → employer career page → vacancy extraction on smaller local
      employers; measure additional unique vacancies beyond structured samples.
- [x] Implement offline C corpus, schemas, prompts and scorer; run the integrated gate.
- [x] Record explicit approval of the synthetic facts used for matching/generation.
- [x] Resolve conservative combined-token reservations and complete-usage settlement.
- [ ] Complete the synthetic CV, twenty-case matching and five-package sample within
      caps, preserving all first-pass failures and at most one repair per case.
- [ ] Manually review those same five full packages: two email and three questionnaire
      packages, internal field IDs mapped to source-evidenced question text, correct missing/action states,
      no unsupported claims, and exact reviewed full-content hashes (ADR 0010).
- [ ] Report A/B/C and manual-review D with counts, evidence, costs and decisions;
      distinguish optional comparisons from required missing observations.

Exit: required seven-day observations and source/extraction/model/manual-package
branches have executed findings and explicit decisions. A supported negative result
can complete investigation but is not a passing criterion. A required branch blocked
before observation, pending profile approval or unreviewed generated package content
keeps G3 incomplete. Independent source success cannot establish model/package or
V1 release readiness. The shared dialog and browser/clipboard checks belong to G6.

## G4: discovery slice

Dependencies: G2 and a viable source in G3. G3 remains incomplete and separate.

Started 2026-10-19 under [START_PROMPT.md](START_PROMPT.md). Outcome: the first
traceable, conservative discovery slice with an authenticated local table and
bounded Berlin daily runs. No deployment or cloud schedule is requested.

Acceptance: validated source/evidence contracts and immutable changed revisions;
repeat ingestion without duplicate jobs; uncertainty links without unsafe merging;
persisted bounded cursors/recovery, overlap protection and source-local errors;
Firebase Auth plus server/rules owner isolation using two synthetic users;
real-browser table with field evidence, unknowns and original links; repeatable
permitted real-source normalization; integrated `npm run verify` and independent
review with material findings resolved. G5 scores remain unavailable.

Bounded ownership: coordinator owns ADRs 0013/0014, root integration, source-policy
and private live operator/evidence; separate discovery implementer owns
`packages/discovery`, application implementer owns `apps/web`, `packages/server`
and emulator/rules configuration; independent reviewer owns inspection, not code.
Planning completed before implementation. Shared source identities and local Auth
contracts are recorded before persistence in [ADR 0013](adr/0013-discovery-identities-and-recovery.md)
and [ADR 0014](adr/0014-local-firebase-authenticated-discovery.md).

Source constraint: Brave remains disabled without an applicable storage/use grant.
Existing G3 employer observations support only bounded anonymous public reads,
not unrestricted mirroring. Review exact targets and source terms before a private
real-source observation, enforce at most seven-day retention on all copies and
reads, preserve G3's cumulative accounting and do not start A's discovery clock.
Synthetic local progress does not fulfill the real-source exit criterion.

- [x] Resolve discovery identities, meaningful-content revisions and timestamps (Q5)
      in ADR 0013; package/profile state contracts remain G5/G6.
- [x] Implement one operator-configured public-page adapter, strict normalization,
      stable source identity, uncertain duplicate links, atomic revisions/cursors,
      source-local failures and fenced recovery.
- [x] Demonstrate two permitted private real-source reads, then hash-bound offline
      normalization with one job/one revision and an authenticated local API import.
- [ ] Enable broad web-search leads and bounded career-link traversal outside the
      operator-seeded stream. Brave storage/AI-use rights remain unresolved.
- [x] Build a local Firebase-authenticated table with original posting/application
      links, field evidence, unknowns and expandable details. Sort by latest processed
      observation; fit scores remain unavailable until G5 supplies validated matching.
- [x] Add local bounded Europe/Berlin daily-run logic, persisted origin ownership,
      cross-day cooldowns, overlap protection, request reservations and diagnostics.
      No cloud schedule is installed.
- [ ] Demonstrate repeatable useful daily live discovery beyond one seeded source;
      the full G4 exit is not established by two immediate repeat reads.
- [ ] Enable a second permitted adapter and demonstrate web-discovered vacancies
      outside the structured-source set before declaring V1 complete.

Implemented/local verification (2026-10-19): `npm ci` succeeded with the pinned
Node 24.22.0/npm 11.11.0. The final `npm run verify` passed Biome, strict types,
97 offline tests (5 core, 67 experiment, 18 discovery, 3 API, 1 links, 3 scanner),
all five workspace builds and Secretlint over 112 repository files. It also passed
one real Firebase emulator integration and one Chromium journey. CI now explicitly
installs Java 21 and Chromium; no remote CI run was observed.

The emulator integration exercises actual Auth SDK tokens, server-derived ownership,
two synthetic owners, anonymous/cross-owner Firestore and Storage denial, expired,
invalid and disabled authentication, retained jobs beyond 101 expired projections,
bounded physical cleanup and corrupt stored-owner rejection. Chromium exercises
login, table, source links, evidence/unknowns and logout without opening application
links or writing browser forms. The additional manual CUA browser connection was
unavailable; no manual visual inspection is claimed.

Real-source evidence remains private: `.local/g4/source-probe-v1/` contains two
separately named live captures of the same existing G3 employer page, one request
each. `.local/g4/normalization-v2/` binds the final source/build/script/capture hashes
and replays the actual bytes offline: one stable job, one content revision,
`newRevision` true then false, unknown decisive conditions and null fit score.
Earlier v1 evidence is preserved separately. This is a specific observed advert,
not a language/eligibility/freshness or broad-coverage pass. A separate local import
and API proof returns 401 anonymously and the exact validated job with an emulator
Auth token. Synthetic Chromium rendering and real-source API evidence remain distinct.
All derived source copies retain the seven-day maximum. Preview services were stopped
without exporting emulator state; private raw/replay evidence needs operator expiry
cleanup, and production retention operations remain unimplemented.

Independent review resolved and re-reviewed material findings in cross-day and
cross-adapter backoff, hanging/late adapter work, source-data expiry, current-revision
retention links, projection query limits/cleanup, email-route display and CI setup.
Final disclosure: `npm audit` reports seven development-CLI dependency nodes
(4 moderate/3 high); `npm ls` flags the explicit patched gRPC override against
Firestore's original range. Neither command is claimed to pass; see
[G4_LOCAL.md](G4_LOCAL.md#dependency-audit-limitation). Behavior verification passed.
The unrelated concurrent `AGENTS.md` edit is preserved outside task-owned commits.

G4 remains **in progress**, and G3 remains incomplete: no seven-day discovery clock,
Brave call, additional model use, cloud schedule, deployment, production login or
real applicant processing was introduced. The G3 ledger now has 24 settled HTTP
attempts and the unchanged 30 model attempts. This first slice does not complete G4
or V1. Next bounded task: establish a permitted web-search storage/use route, then
implement and observe a bounded broad-discovery/career-link run with the same
identity, policy, retention and recovery contracts. Reuse existing access; no new
subscription or account/billing change is authorized by this handoff.

Exit: repeatable daily discoveries are traceable and nonduplicated; UI works in a
real browser and private data is inaccessible to unauthorized users. Synthetic
emulator/browser evidence establishes the local boundary only, not the whole exit.

## G5: profile and matching

Dependencies: G4; ownership/data-lifecycle decisions resolved before real CV use.

- [ ] Define profile/evaluation version contracts (Q5); add private PDF upload,
      extraction, correction, approval, and profile versions.
- [ ] Implement conservative filters, schema-validated evaluation, and evidence UI.
- [ ] Evaluate at least 50 human-labeled varied postings against `CONCEPT.md` targets.

Exit: documented benchmark results meet targets and candidate facts remain traceable;
uncertain eligibility does not become confirmed through scoring.

## G6: application assistant

Dependencies: G5, verified channels and G3's model/manual-package evidence.

- [ ] Resolve application/package/generation-attempt identities, immutable versions,
      review hashes and preservation of human edits before persistence (Q5).
- [ ] Generate fact-grounded email subject/body or questionnaire packages; bind every
      proposed answer by a stable internal ID to source-evidenced question text and approved candidate facts.
- [ ] Add “View application draft” to the table, opening one shared review/copy dialog
      with email text or per-field proposed answers and a copy action per answer.
- [ ] Show `needs_input` for missing facts and `applicant_action_required` for
      consents/signatures/declarations. Unknown start dates stay unanswered.
- [ ] Exercise the actual dialog and clipboard in a real browser, plus manual
      applied/ignored status. Verify no autofill, form-write, send or submit paths.
- [ ] Test interrupted/regenerated packages, preserved edits, ownership and version
      invalidation; do not imply copying proves an application was sent.

Exit: reviewed packages contain supported claims, missing/action states remain
explicit, and browser copying works. The applicant alone transfers text, attaches
files and sends/submits. Gmail is Firebase Auth login only; no Gmail integration.

## G7: V1 release and operational handover

Dependencies: all preceding V1 slices, including CV processing and manual-copy
packages; review every V1 criterion. Discovery alone cannot pass this goal.

- [ ] Verify retention, export/deletion, ownership enforcement and minimal telemetry.
- [ ] Exercise cost caps, source/authentication failures, alerts and recovery; write a runbook.
- [ ] Demonstrate the real-browser review/copy-to-manual-application workflow with safe data.
- [ ] Record acceptance evidence and limitations; scope a separate goal for broader use.

Exit: every V1 criterion in `CONCEPT.md` has evidence. Missing CV, package review/copy
or discovery acceptance keeps V1 incomplete. No multi-user availability is implied.

## Optional follow-up investigations — deferred

- [ ] Reassess a CAPTCHA fallback only if confirmed public-page challenges materially
      reduce useful discovery. Use the [CaptchaKraken research](EXTRACTION_OPTIONS.md#captchakraken-deferred-optional-candidate)
      to define a separate bounded task, resolve source/access and US-processing
      decisions, and compare added verified vacancies against cost and latency.
      This is outside the current G3 gate and is not an implementation commitment.

## V2: broader use and user-managed search orders — deferred

Dependencies: a useful, accepted V1; define a new bounded goal before implementation.

- [ ] Design onboarding and account lifecycle for additional owners, authentication
      readiness, per-owner quotas, privacy, deletion, and support.
- [ ] Add user-managed search orders: create/edit, geography/keywords/preferences,
      active/paused state, and individual schedules.
- [ ] Validate cross-user isolation and concurrent runs before broader availability.

V1 retains operator-configured streams and profile correction; it does not need
this management interface to personalize matches for the pilot candidate.
