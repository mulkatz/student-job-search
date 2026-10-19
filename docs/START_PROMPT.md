# Fresh-session implementation start prompt

Status: G2 completed and locally verified on 2026-10-19; G3 is next. See
[PLAN.md](PLAN.md#g2-development-foundation--complete) for executed evidence and
limitations. Live-access prerequisites and explicit opt-in remain G3 checks.

The following is the completed G2 execution contract, retained for traceability.
Do not restart G2 from it. For G3, select the bounded experiment and prerequisites
from [PLAN.md](PLAN.md#g3-feasibility-experiment) and [FEASIBILITY.md](FEASIBILITY.md).

```text
Start Goal G2 for student-job-search: establish a reproducible TypeScript development
foundation that a clean checkout can install and verify through one documented
command, with CI configured to run that gate without secrets or paid/live APIs.

Read AGENTS.md, CONCEPT.md, docs/PLAN.md, and docs/IMPLEMENTATION_START.md first.
Consult docs/OPEN_QUESTIONS.md and relevant accepted ADRs where a task depends on
them. Treat the original MVP proposal as reference, not the current product contract.
Inspect the actual branch, worktree, and existing files; preserve unrelated changes.

Check G1's handoff state and identify prerequisites relevant to G2. Do not claim
G1 is complete if it is not. Missing live access or unresolved live-fetch policy
does not prevent independent offline tooling. Ask only if an unresolved choice
materially blocks this goal; proceed on independent work while waiting.

If native Goals are available, create a Goal for the G2 outcome stated above.
Do not add a token/time budget unless the user explicitly supplies one. Otherwise,
track the same outcome and evidence in the repository plan.

Use separate planning, implementation, and independent review agents as AGENTS.md
requires. Delegate bounded tasks with explicit file ownership. Keep coordination
proportionate; resolve findings and re-review affected changes before completion.

Choose and pin maintained tooling after checking current official documentation.
Build the smallest useful workspace, strict TypeScript configuration, format/lint
checks, meaningful synthetic fixture/schema tests, a build, a maintained secret
scanner, and CI invoking one verification entry point. Write the actual install
and verification commands in README.md once they exist. Do not create empty package
trees, placeholder passing tests, or speculative framework layers.

Use docs/IMPLEMENTATION_START.md's G2 completion evidence as the contract. Prove
installation and verification from a clean checkout. Test meaningful invalid inputs
and include synthetic owner/candidate identities without claiming production auth.
Run browser/emulator checks only as corresponding layers are implemented. Distinguish
configured CI, locally passing checks, and an observed remote CI run.

Keep this goal offline and synthetic. The monthly operating ceiling is EUR 50 across
cloud, search, and LLM; no paid provisioning, provider subscription, live crawling,
real CV processing, OAuth account connection, or deployment is requested by G2.
The accepted initial route is GCP-managed Gemini, Brave, and HTTP/Cheerio; the
exact live model/region/plan and optional alternatives are G3 checks. Use accepted
ADRs 0004/0005 and docs/FEASIBILITY.md only when that context affects this goal.
V1 still includes CV processing, application text, Gmail drafts, and broad discovery.
V2 multi-user onboarding and user-managed search orders stay out of scope.

Work autonomously through implementation, verification, review, and fixes. Record
significant choices in concise ADRs and maintain docs/PLAN.md at meaningful changes.
Use atomic lowercase English semantic commits for task-owned changes. Follow the
session's actual authorization for pushes; do not infer deployment authorization.

Finish G2 only when its applicable acceptance criteria have evidence and material
review findings are resolved. Update the plan with actual commands, review outcome,
limitations, and the next goal. Mark a native Goal complete only when achieved.
Do not automatically expand into G3 or the rest of V1. Report the result concisely
in German, with commit IDs and executed verification; repository content stays English.
```

For later goals, reuse the outcome/evidence/constraints structure but select the
actual goal and its prerequisites from [PLAN.md](PLAN.md). Do not blindly reuse G2's
offline boundary for an explicitly authorized live-integration goal.
