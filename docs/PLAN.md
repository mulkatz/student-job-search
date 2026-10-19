# Delivery plan

Updated: 2026-10-19. Status describes evidence, not estimated progress.

| Goal | Status | Outcome |
| --- | --- | --- |
| G0: repository foundation | Complete | Local Git repository, concept, shared agent rules, ADRs, and plan. |
| G1: feasibility brief | Complete | Accepted baseline, public-fetch policy, bounded experiment and fresh-session handoff. |
| G2: development foundation | Complete | Reproducible offline TypeScript workspace, synthetic fixtures, verification gate, and configured CI. |
| G3: feasibility experiment | Investigation complete; quality failed | Actual A/B/C findings reject coverage/extraction/model acceptance; corrected D packages approved under delegated review. |
| G4: discovery slice | Complete locally | Traceable discovery, conservative identities, authenticated table and verified bounded daily-run behavior; market yield remains unproven. |
| G5: profile and matching | Implemented locally; acceptance pending | Synthetic profile/matching/lifecycle journeys pass; human 50-case benchmark and live-model quality remain unproven. |
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

The user requested integration on `main` and then authorized pushing after G4 is
complete and verified. Finished task-owned changes are committed there; preserve
unrelated work and inspect outgoing secrets before the authorized push. The current
[handoff](START_PROMPT.md) preserves unfinished G3 evidence and G4's explicit local
limits, with G5 implementation in progress. The five synthetic packages now have
delegated semantic review and exact-version
operator approval; repository publication does not authorize runtime deployment.

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

Started 2026-10-19. The initial actual discovery date is preserved; the user
subsequently removed the long-term test. ADR 0017 records a bounded-snapshot policy
in the existing ledger, with historical dates and all usage intact. This removes
only calendar-duration acceptance, not source quality or retention. Outcome and
remaining branch criteria are in [FEASIBILITY.md](FEASIBILITY.md).

Final decision: the required branches have executed evidence and G3 closes as an
investigation with negative A/B/C quality/coverage findings, not a feasibility pass.
The bounded 30-URL baseline recovers 16/45 labeled fields and seven of twelve detail
adverts; its exact-string oracle has documented route/encoding limitations. Three
actual structured employer GET records establish access, with zero confirmed
compatible coverage. Full synthetic matching/package failures remain recorded;
all five corrected editorial packages passed delegated review and exact-version
conditional approval. [Current findings](G3_SETUP.md#current-findings-and-decisions)
record costs, counts, limitations and follow-up decisions. No further calendar wait
or default dispatch is needed. G5 remains synthetic-first with separate human quality
acceptance; no source, model, privacy or V1 quality requirement is waived.

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

- [x] Verify current provider/model/region, source rights/plan and operator access;
      reserve within the experiment caps before live execution.
- [x] Review source terms, attribution, storage/retention, quotas, endpoints and
      redirects. Record source-policy evidence and enable only permitted sources.
- [x] Fetch bounded samples; curate up to five employer boards and measure real
      coverage against G1's threshold, not just HTTP success.
- [x] Test search-query → employer career page → vacancy extraction on smaller local
      employers; measure additional unique vacancies beyond structured samples.
- [x] Implement offline C corpus, schemas, prompts and scorer; run the integrated gate.
- [x] Record explicit approval of the synthetic facts used for matching/generation.
- [x] Resolve conservative combined-token reservations and complete-usage settlement.
- [x] Complete the synthetic CV, twenty-case matching and five-package sample within
      caps, preserving all first-pass failures and at most one repair per case.
- [x] Independently review those same five full packages under delegated-review
      ADR 0021 and conditional operator approval: two email and three questionnaire
      packages, internal field IDs mapped to source-evidenced question text, correct missing/action states,
      no unsupported claims, and exact reviewed full-content hashes (ADR 0010).
- [x] Report A/B/C and manual-review D with counts, evidence, costs and decisions;
      distinguish optional comparisons from required missing observations.

Exit: required bounded-snapshot source/extraction/model/package-review
branches have executed findings and explicit decisions. A supported negative result
can complete investigation but is not a passing criterion. A required branch blocked
before observation, pending profile approval or unresolved package-review findings
keeps G3 incomplete. Independent source success cannot establish model/package or
V1 release readiness. The shared dialog and browser/clipboard checks belong to G6.

## G4: discovery slice

Completed locally on 2026-10-19. Dependencies: G2 and the observed viable public
source path in G3; G3 remains incomplete and separate. Outcome: traceable source
observations, conservative identity/revisions, authenticated local table and bounded
Europe/Berlin daily-run behavior. This is an internal V1 milestone, not V1 release,
production login, recurring market-yield evidence or an installed cloud schedule.

Acceptance: validated source/evidence contracts; repeat ingestion without duplicate
jobs/revisions; uncertain duplicate links without automatic merges; atomic bounded
cursors/frontiers, fencing, overlap denial and source-local errors; Auth/server/rules
owner isolation; real-browser evidence/unknowns/original links; actual source reads
and repeatable normalization; integrated verification and independent review.

Planning, implementation and independent review were separate. The coordinator
owned architecture/docs, integration and private operators; the discovery implementer
owned `packages/discovery` and provenance rendering; the application implementer
owned server/emulator/browser import work. Material review findings were resolved
and affected changes re-reviewed. The unrelated concurrent `AGENTS.md` edit remains
outside task-owned commits. Decisions are in ADRs [0013](adr/0013-discovery-identities-and-recovery.md),
[0014](adr/0014-local-firebase-authenticated-discovery.md),
[0015](adr/0015-expiring-discovery-frontiers.md) and
[0016](adr/0016-private-brave-operator-authorization.md).

- [x] Source-pair identities, meaningful immutable revisions, distinct timestamps,
      conservative duplicate links and strict normalization/evidence contracts.
- [x] Public-page, frozen permitted-snapshot and fixed-endpoint Brave adapters;
      search leads remain separate from fetched pages and source-advertised details.
- [x] Expiring bounded career-link frontiers, cross-domain target/redirect policy,
      SSRF boundaries, origin ownership/pacing, cooldowns and bounded diagnostics.
- [x] Daily Berlin runs, atomic cursor/observation commits, overlap/fence recovery,
      cross-day behavior and fail-closed paid-attempt reconciliation.
- [x] Local Firebase-authenticated table, exact evidence and source links, unknowns,
      owner-private server/rules denial and explicit source projection import.
      Fit stays unavailable until G5; latest checked observation determines order.
- [x] Actual broad-search leads followed by separately bounded targeted original-page
      extraction, repeated real-byte normalization and authenticated Chromium proof.
- [ ] Second permitted adapter, useful incremental/compatible coverage benchmark and
      recurring daily market yield remain G3/V1 acceptance, not established here.

### Executed verification

The integrated `npm run verify` passed in an isolated checkout without pre-existing
workspace build outputs, using Node 24.22.0/npm 11.11.0 and local Java 26. Build now
precedes dependent-workspace type checking; the former order failed in a genuinely
isolated fresh checkout despite passing with warm local outputs. CI installs Java 21
and Chromium; no remote CI run is claimed.

The gate passed Biome, all five builds, strict source/test types, **143 offline
tests** (5 core, 67 experiment, 60 discovery, 7 API/import, 1 links, 3 scanner),
Secretlint over 125 repository files, one real Firebase emulator ownership integration
and one synthetic Chromium journey. The integration tests actual SDK tokens,
anonymous/cross-owner denial, expired/invalid/disabled authentication, private
Firestore/Storage ownership, expiry filtering beyond 101 stale projections, bounded
physical cleanup and corrupt-owner rejection. Default tests call no paid provider.

A separate explicitly opted-in Chromium journey imported the current actual hostel
projection and passed login, exact title/employer/evidence/revision/provenance,
unknown conditions, unavailable fit and logout. It blocked external navigation;
no source/application link, browser form or external submission was opened. Its
first execution exposed a test locator that included nested location text; the
locator-only correction passed independent review and the actual-source rerun.
Manual CUA inspection remained unavailable and is not claimed.

### Private source evidence and limits

The initial slice at `899f581` passed 97 offline tests and synthetic browser/owner
checks. `.local/g4/source-probe-v1/` preserves two real reads of the previous G3
employer page; `.local/g4/normalization-v2/` binds actual bytes/operator/build hashes
and demonstrates one stable job/revision plus authenticated API 401/200 evidence.
Earlier replay v1 is preserved. These are not broad-coverage observations.

The user then explicitly authorized bounded private Brave use despite an unverified
provider storage/use grant. ADR 0016 records that operator instruction separately;
it neither changes vendor terms nor grants rights over third-party pages. No result
was sent to a model. Raw search responses, snippets and provider titles were discarded;
only URL/provenance leads are retained privately for at most seven days.

`.local/g4/brave-live-v1/` executed all twenty frozen G3 queries (ten per stream),
retaining 200 URL leads. Fourteen HTTP attempts produced eight career leads, four
unavailable observations and **zero vacancy details**. Same-day completed replay
sent zero additional requests. All attempts settled and paid markers cleared.
Conservative search accounting is EUR 0.20, not an invoice. Exact executed method
inputs are archived privately against their hashes.

The v1 selection spent child slots on navigation/publishing links. Traversal v2 now
ranks likely vacancy anchors using text/path/page context and excludes obvious
service navigation. Sixty discovery tests include these regressions. Its useful
live yield has not been measured; do not attribute the later hostel result to it.

A separately reviewed `.local/g4/search-detail-probe-v1/` packet fetched four actual
retained Brave URLs in four additional HTTP attempts, preserving source ownership,
pacing, the shared lock, cumulative G3 accounting and parent evidence expiry. It
neither resets nor resumes the completed v1 daily run. Three pages returned HTML;
one was unavailable. Independent inert inspection established an unsolicited museum
lead, an advert explicitly expired in 2022 and a specific hostel cleaner advert.
Only the last is represented as a source-advertised vacancy detail. Its publication,
currentness, language/Germany eligibility and unsupported fields remain unknown;
it is not a confirmed compatible/current G3 coverage count.

`.local/g4/search-normalization-v1/` binds these actual captures to reviewed selectors,
source/build/operator hashes and original search/query/result/attempt provenance.
Offline normalization yields three jobs/three revisions: lead, unavailable expired
advert and observed vacancy detail. Repeat ingestion changes neither job nor revision
identity (`newRevision` true then false); it is not another live fetch. The hostel
uses exact source-specific visible selectors, not a generic-extractor accuracy claim.
Its minimized one-job projection supplied the successful actual-source Chromium run.

All captures, projections, method snapshots and browser failure artifacts inherit
at most seven-day retention; do not renew evidence by replay. Future operators inherit
latest packet ownership/pacing and global cooldowns. Emulator preview services stopped
without data export; operator expiry cleanup remains necessary. Production retention,
Google login/deployment and CV/package work remain later milestones.

G3 now has **42 HTTP, 20 search and 30 model attempts**, all settled, with no pending
writer reconciliation or overrun. Search started A at `2026-10-19T19:18:01.181Z`;
its seven Berlin dates end 2026-10-25 and next observation is due 2026-10-20. Only
one live discovery date is observed. Nineteen matching cases, the full extraction
cohort and exact-content human package review remain incomplete; no cap/state reset
or seven-day waiver occurred. Search's conservative EUR 0.20 and previous model
EUR 0.052615 remain inside existing allocations/EUR 5 experiment/EUR 50 monthly cap.

Known dependency limitation remains: `npm audit` reports seven development-CLI nodes
(4 moderate/3 high), and `npm ls` flags the explicit patched gRPC override against
Firestore's original range. Neither command is claimed to pass; see
[G4_LOCAL.md](G4_LOCAL.md#dependency-audit-limitation). The behavior gate passes.
The user authorized pushing main after this completed verification; no deployment,
new account/subscription, billing/IAM change or real-CV processing is included.

## G5: profile and matching

Dependencies: G4; ownership/data-lifecycle decisions resolved before real CV use.

Started 2026-10-19 under the user's instruction to implement remaining work in parallel.
Planning is complete. Outcome: actual bounded PDF upload/extraction, traceable editable
facts, immutable approval versions, owner-private evaluations, conservative matching,
retention/export/deletion and the authenticated synthetic browser journey. ADR 0018
records identity/evaluation contracts; ADR 0019 records lifecycle. The separate G5
implementer owns server/web/rules and synthetic fixtures; coordinator owns ADRs,
root/CI integration and docs; independent reviewer owns inspection, not implementation.

Acceptance includes owner isolation, expired/deleted data denial, stale-draft and
upload/delete races, preserved versions, unknown/blocker separation, private score
projections and actual local PDF/browser checks. Use installed maintained Poppler,
no shell or external PDF service, with finite input/page/text/time limits. Raw/draft
retention 7 days, approved versions 90 days, evaluations capped by source/profile/7 days.
No real CV processing or paid G5 provider call is enabled by default.

Prepare 50 varied synthetic oracle cases, rubric and hash-bound human-label review
support. Agent-authored oracle labels do not satisfy the human-reviewed benchmark;
that evidence stays pending. Keep deterministic/local checks, live model observations
and human quality acceptance distinct, and do not mark full G5 complete prematurely.

- [x] Define profile/evaluation version contracts (Q5); add private PDF upload,
      extraction, correction, approval, and profile versions.
- [x] Implement conservative filters, schema-validated evaluation, and evidence UI.
- [ ] Evaluate at least 50 human-labeled varied postings against `CONCEPT.md` targets.

Executed verification (2026-10-19): the final isolated checkout removed all workspace
build/test outputs and passed `npm run verify` with pinned Node/npm and Java 26:
166 offline tests (5 core, 77 experiment, 61 discovery, 19 server, one web-link and
three scanner regressions), all builds, strict types, Biome, Secretlint, two actual
emulator integrations and two Chromium journeys. The G5 browser journey verifies
actual synthetic PDF upload/correction/approval, a positive score and separate
confidence/ranking, unknown evidence, immutable/stale versions, exact PDF/history
export and deletion. The independent reviewer reran server/discovery tests and
inspected actual code, evidence and rendered UI; material findings were fixed and
re-reviewed. No runtime code changed after the final gate input snapshot. A separate final
actual-source Chromium regression also passed against the retained private source
projection, with no new external requests.

Fifty frozen synthetic oracle cases match their implementation targets, but no
human labels are recorded. The private review artifact is
`.local/g5/human-benchmark-v1/review.html`; changing the G3 five-package review method
does not approve this different benchmark. G5 remains incomplete at this acceptance
boundary. Default matching is deterministic; optional validated assessment hooks are
version-bound and cannot upgrade unknown/blocked gates. No paid/live G5 model call
or real CV was used. Ambiguous uploads retain minimal unresolved cleanup markers;
time alone cannot establish physical deletion. Production and G6 remain separate.

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
