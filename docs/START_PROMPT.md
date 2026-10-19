# Fresh-session continuation: G4 discovery slice

Prepared 2026-10-19 at the user's request. G2 is complete. G3 is paused for the
requested session handoff and remains incomplete;
read [current evidence](G3_SETUP.md) and [the plan](PLAN.md) before implementation.
The prior completed G2 contract is [archived](archive/G2_START_PROMPT.md).

Paste this prompt in the next fresh session:

```text
Start Goal G4 for student-job-search: implement the first traceable discovery slice
with conservative job identity/deduplication, an authenticated job table, and bounded
daily runs. Work in the existing repository; this is not a new scaffold or deployment.

Read AGENTS.md, CONCEPT.md, docs/PLAN.md and docs/G3_SETUP.md first. Consult
docs/FEASIBILITY.md, docs/OPEN_QUESTIONS.md and accepted ADRs 0002/0004/0005,
0008/0010/0011/0012 where relevant. Inspect the actual branch, commits and worktree;
preserve unrelated changes. Use separate planning, implementation and independent
review agents with bounded file ownership, and resolve/re-review material findings.

The handoff is integrated locally on main. G2 is complete and the TypeScript,
Biome, strict types, tests, builds and Secretlint foundation is verified. Use the
documented npm run verify gate; do not introduce Prettier or ESLint. Verify current
official versions and provider facts when adding dependencies or integrations.

G3 is still incomplete. Its seven-day discovery clock has not started; B has a
partial ten-target extraction pilot plus one separately versioned transport check.
A further eight-detail cohort/operator is prepared privately at
.local/g3/extraction-expansion-v1/; it has no live captures or independent operator
review yet. Review the actual files/policy/hash guards before any dispatch.
C has actual EU Vertex observations, including failed first-pass cases and two
remaining package content findings. The 2026-10-19 model cap is reached: 30 requests,
with nineteen matching cases still missing. Editorial corrections remain separate
from model scoring; D requires human review of exact full package content.
Read the latest results instead of assuming that schema validity, offline fixtures
or a prepared operator passed a branch. Never reset .local/g3/state.json,
overwrite old captures/results, restart
G2, waive the seven days, or mark G3 complete merely to begin G4.

G4 depends on G2 and at least one viable, permitted source demonstrated in G3;
it does not require every G3 branch to finish first. Verify that source prerequisite
and its actual rights/access. Brave's Search/Postpaid account and local key do not
establish persistent-storage or AI/benchmark permissions. Keep that integration
disabled until an applicable explicit grant is established. Preserve broad web
discovery; an API-only or fixed-employer-list product does not satisfy V1.

Define outcome, acceptance criteria, dependencies and small reviewable tasks in
docs/PLAN.md. First resolve canonical/source job identities, provenance, revisions,
uncertain duplicate links and timestamp meanings in a concise ADR before persistence.
Implement one permitted source path, normalization, idempotent repeat processing,
bounded cursor/recovery handling and source-isolated failures. Preserve the public
fetch boundary for targets, redirects and browser subrequests. Distinguish search
leads, career pages and verified vacancy details; retain decisive unknowns.

Build a minimal authenticated table with original application links, field evidence,
unknowns and expandable details. Fit scores remain unavailable until G5 supplies
validated matching; never use fabricated scores as real results. Use Firebase Auth
and owner-scoped Firestore/private storage contracts with synthetic-owner tests.
Prefer local emulators for development; deployment/provisioning is not requested.
Add bounded Europe/Berlin daily-run logic, overlap protection, idempotency and useful
diagnostics without installing a cloud schedule. Exercise the implemented local
journey in a real browser and verify server-side/rules ownership isolation.

While live source prerequisites remain unresolved, progress on independent contracts,
offline source/normalization behavior and a clearly synthetic local browser journey.
Mocks establish neither source access nor useful coverage. The full G4 exit needs
repeatable real-source evidence, conservative deduplication/recovery, browser
verification and private-data isolation. The second permitted adapter and broad
web discovery remain V1 requirements as recorded in PLAN.md.
Do not claim that a partial first slice completes G4 or V1.

Gmail is exclusively a Firebase Auth login identity: no Gmail API/mailbox OAuth,
send, submission, autofill or browser-form writes. The shared “View application
draft” dialog for email text/questionnaire answers and manual copying belongs to G6.
CAPTCHA solver work is explicitly deferred; real challenges stop under ADR 0005.
Never invent candidate facts, work authorization, recruiter identities or addresses.

Keep project/account identifiers, credentials, real applicant data, licensed results
and raw captures out of Git. Inspect private operator state only where needed; never
print secrets. Use placeholders in tracked config and read current credentials privately.
Preserve cumulative G3 caps and the EUR 50/month ceiling.
The internal HTTP daily cap is removed under ADR 0012; the cumulative HTTP cap,
bounded runs, source pacing and provider limits remain. Search/model daily controls
and A's seven-day sampling protocol are separate internal experiment constraints.
No new subscription, credit bundle, top-up, IAM/billing change, production deployment
or real-CV use is authorized by this prompt. Reuse applicable existing authorization; ask only for
genuinely missing access, material unresolved choices or destructive/public actions.

Use native Goals if available without inventing a budget or overwriting an unfinished
goal. Keep G3's incomplete evidence separate from G4's outcome. Run focused checks,
then npm run verify before handoff; inspect staged changes and scan secrets. Update
PLAN with actual evidence and limitations, and use task-owned lowercase semantic
commits. Integrate finished changes on main as requested; do not push or publish
without applicable authorization. Report concisely in German with executed checks,
commit IDs, remaining dependencies and the next bounded task.
```
