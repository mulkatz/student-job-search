# Fresh-session continuation: finish G4 discovery

Updated 2026-10-19 after the first local G4 slice. G2 is complete; G3 and G4 remain
incomplete. The implemented slice, executed checks and remaining exit criteria are
in [PLAN.md](PLAN.md#g4-discovery-slice). Do not restart the foundation or treat this
handoff as source-coverage, production authentication or V1 acceptance.

```text
Continue G4 in the existing student-job-search repository. Read AGENTS.md,
CONCEPT.md, docs/PLAN.md, docs/G4_LOCAL.md and the relevant G3_SETUP/OPEN_QUESTIONS
sections. Read accepted ADRs 0005/0008/0010/0011/0012/0013/0014 where relevant.
Inspect branch, commits, worktree and current native Goal; never overwrite an
unfinished goal. Preserve unrelated changes, including the concurrent AGENTS.md
reasoning-policy edit if it is still present. Reasoning must not exceed high.

The first slice is integrated locally on main: packages/discovery implements
strict observation/evidence contracts, source-pair IDs, conservative duplicate
links, content revisions, private atomic persistence, bounded Berlin daily runs,
request reservations, fenced recovery, cross-day cooldowns and origin ownership.
One source owns each target/redirect origin; other source IDs cannot bypass pacing.
The React table/API uses Firebase Auth/Firestore/Storage emulators only. Shared
job projections are API-only with expiry filtering and bounded manual cleanup;
owner-private paths and rules deny cross-owner access. Fit scores are unavailable;
application-package UI remains G6. No cloud schedule or deployment is installed.

npm run verify passed 97 offline tests, all workspace builds, Biome, strict types,
Secretlint, real emulator ownership integration and a Chromium synthetic journey.
CI installs Java 21 and Chromium, but no remote CI run was observed. npm audit has
seven development-CLI dependency nodes (4 moderate / 3 high), and npm ls flags the
intentional patched gRPC override against Firestore's original range; consult the
explicit G4_LOCAL limitation instead of claiming these commands pass.

Actual private source evidence: .local/g4/source-probe-v1 has two independently
reviewed live reads of the existing G3 employer page (one request each). Final
.local/g4/normalization-v2 binds source/build/operator/capture hashes and replays
those real bytes offline to one job/one revision; v1 is preserved separately.
An authenticated emulator API import proof matches that job exactly (anonymous 401,
authenticated 200). Chromium rendering used synthetic data; the extra manual CUA
browser connection was unavailable. Do not combine these into a claimed live
browser/source-coverage pass. Preview services were stopped without emulator export.
Raw captures, normalized records and all copies have at most seven-day retention;
check expiry before reuse and perform operator cleanup. Do not overwrite evidence
or reset state to repeat an observation. No unlimited mirroring grant is inferred.

Next bounded task: establish an applicable permitted web-search storage/use route,
then implement and observe bounded broad discovery/career-link traversal beyond
operator-seeded pages. Brave Search/Postpaid/key does not establish storage or
AI/benchmark permission. Keep it disabled until an explicit applicable grant exists;
a separately permitted alternative requires its own current rights/access review.
Do not narrow the product to APIs or a fixed employer list. The second permitted
adapter and incremental broad-web vacancies remain V1 requirements. Two immediate
reads of one page do not establish repeatable useful daily discovery or finish G4.
Progress on independent offline behavior while genuinely missing access is pending.

G3 remains incomplete and separate. Its discovery clock is unset. The cumulative
ledger has 24 settled HTTP attempts and 30 model attempts (15 CountTokens + 15
inferences); source follow-up added only 2 HTTP attempts. No outstanding attempt,
overrun or writer reconciliation was present at handoff. Preserve all reservations,
failed model cases and old captures/results. Nineteen matching cases and full
human exact-content package review remain pending. Never waive the seven days or
mark G3 complete merely to continue G4. The prepared G3 eight-detail cohort remains
unexecuted; review current method/policy/hash guards before any future dispatch.

Use separate planning, implementation and independent review for substantive work,
with bounded file ownership and current AGENTS.md model selection. Resolve material
findings and re-review affected changes. Update PLAN at meaningful boundaries.
Use the pinned runtime and npm run verify; no Prettier/ESLint. Exercise actual local
journeys in a real browser and server/rules ownership independently. No provider
calls in default tests. Keep fixture data synthetic and source evidence private.

Preserve the EUR 50/month ceiling and cumulative G3 caps. HTTP has no internal daily
cap under ADR 0012, but cumulative limits, finite runs, source pacing and provider
limits remain. Search/model daily constraints and A's sampling protocol are separate.
No new subscription, credit purchase, top-up, IAM/billing change, deployment or real
CV use is authorized. Gmail is Firebase Auth login only: no mailbox API/OAuth,
sending, submissions, autofill or browser-form writes. CAPTCHA solver work remains
deferred; actual challenges stop. Never invent applicant or application facts.

Keep project/account identifiers, credentials, real applicant facts, licensed/raw
captures and scratch data out of Git. Read credentials privately only when needed.
Commit only task-owned changes with lowercase semantic commits on main. Inspect
staged content and scan secrets; do not push/publish. Report briefly in German with
actual verification, commit IDs, remaining dependencies and the next bounded task.
```
