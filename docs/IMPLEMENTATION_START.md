# Conception closure and implementation handoff

Updated: 2026-10-19. G1 is still open; this document prepares the handoff, not a
claim that source access, coverage, crawling, or Gmail have been validated.

## What needs to be settled now

The V1/V2 boundary is agreed in [CONCEPT.md](../CONCEPT.md) and ADR 0003. Do not
reopen CV/application/Gmail scope just to simplify the first coding task. Keep the
interface small and implement the complete V1 through independently verified goals.

| Item | Current state | Needed for |
| --- | --- | --- |
| V1 scope, one-person pilot, ownership boundary | Agreed | All work |
| Monthly operating ceiling | EUR 50 total for cloud, search, and LLM; user confirmed | Costed live experiment and operation |
| Cloud/project ownership and available provider/test accounts | Awaiting user inventory; never store credentials here | Affected live integration, not offline tooling |
| Source-coverage threshold and bounded experiment | Proposal below; not yet accepted as the benchmark | G3 evaluation |
| Automatic-fetch/crawl policy | Q7 remains open; broad discovery intent is agreed | Live page fetching |
| Exact data/version/state contracts | Resolve just before their affected slices, as Q5 describes | Persistence and side-effect implementation |
| Tool/runtime versions and actual commands | Select and verify during G2 | Development foundation |

The EUR 50 ceiling is a planning/operating constraint, not a request to purchase
subscriptions or provision resources now. A proposed provider mix must fit the
total; if it cannot, surface that conflict rather than silently increasing spend.
Agree a per-experiment limit before paid live tests. Missing provider accounts do
not block offline work.

## Remaining G1 work in this session

1. Record available accounts, project ownership, and the intended test identity
   as availability only. Keep tokens, addresses, real CVs, and personal details private.
2. Finalize the bounded feasibility checklist: sample sizes, observation period,
   query/fetch/model/draft caps, expected evidence, and cleanup. Use the existing
   [source findings](SOURCE_DISCOVERY.md), not an assumption that APIs are accessible.
3. Define the exact crawl policy for Q7 and record it as a decision before fetching
   live employer pages. Source discovery must retain reach beyond major platforms.
4. Confirm the benchmark below or replace it with an equally measurable criterion;
   document provider/Gmail blockers separately from product scope.
5. Reconcile the concept, plan, and open questions. G1 can finish with unavailable
   access explicitly recorded as a G3 prerequisite, not invented or treated as tested.

Candidate-specific preferences may remain unknown until private onboarding. They
do not need to delay tooling, and they must not become invented matching evidence.
Detailed schemas, final prompts, polished UI designs, and every later ADR are not
prerequisites for finishing the initial conception.

## Proposed source-feasibility benchmark

This is a proposed experiment criterion, not a market forecast or accepted result:

- Observe an agreed seven-day window and report Berlin and Germany-remote streams
  separately, with explicit request and cost caps set before testing.
- Find at least 10 distinct, current vacancies manually judged compatible with
  the pilot's core language, location, and work-format constraints. Count unresolved
  decisive requirements separately; do not count them as confirmed suitable.
- Include at least 3 additional verified vacancies discovered through web search/
  employer pages outside the structured-source sample after cross-source deduplication.
- Report source yield, blocked/unavailable pages, useful-job rate, duplicate rate,
  and cost. If either stream has no confirmed suitable vacancies, record the gap.
- A failed benchmark triggers a source/query/scope decision. It does not justify
  inventing vacancies or expanding the UI while the core value remains unproven.

Keep the separate Gmail feasibility criterion from G3: one visible unsent test
draft with synthetic text and a test attachment in the consenting test account,
plus explicit token/recovery findings. No automatic sending. CV parsing and matching
need their own synthetic checks; success in one integration does not prove another.

## First fresh-session goal: G2

Outcome: a clean checkout has a documented installation path and one working
verification entry point, with CI configured to run it without secrets or paid
services. Implement the smallest TypeScript foundation needed to begin G3.

In scope: maintained pinned tooling, minimal workspace boundaries, strict types,
format/lint/build checks, meaningful synthetic fixture/schema tests, secret scanning,
CI, and setup documentation. Resolve technical choices with proportionate ADRs.

Out of scope for this goal: the complete dashboard, production connectors, live
crawling, CV processing with real data, Gmail OAuth connection, paid provisioning,
V2 onboarding, and search-order management. These stay in the delivery plan.

Completion evidence:

- [ ] Installation and the documented verification command succeed locally from
      a clean checkout; the lockfile and required runtime versions are committed.
- [ ] Verification actually runs format/lint, strict types, meaningful tests, build,
      and a maintained secret scanner; negative tests prove invalid boundary inputs
      are rejected, and a failed check makes the gate fail.
- [ ] CI invokes the documented gate without provider secrets/live API calls. Report
      remote CI success only if the actual run was observed; distinguish configuration
      and local verification from remote execution.
- [ ] Synthetic owner/candidate fixtures establish the intended identity boundary;
      do not claim live authentication/authorization is implemented at this stage.
- [ ] An independent reviewer has inspected the diff and verification evidence;
      material findings are resolved and rechecked.
- [ ] `docs/PLAN.md` records outcome, actual commands, review evidence, and unresolved
      downstream prerequisites concisely. A next session can resume without this chat.

Follow [AGENTS.md](../AGENTS.md) for autonomous work and separate planning,
implementation, and review responsibilities. Add browser/emulator checks with their
actual layers; do not create placeholder checks that merely return success.

## Session and goal cadence

Finish G1 here, then open a fresh session in this repository using
[START_PROMPT.md](START_PROMPT.md). A fresh session is a project workflow choice,
not a requirement to discard context after every task. Use a new session at a
meaningful goal boundary or when the current context becomes difficult to navigate.

Run one bounded goal at a time: plan, implement, verify, independently review,
resolve findings, and record evidence. Then deliberately select the next goal.
Do not set “finish all V1” as the first implementation objective.

Native Codex Goals are thread-scoped. Repository files carry the cross-session
contract; a fresh session starts its own goal rather than assuming an old native
goal transferred. This approach follows the outcome/evidence/constraints pattern
in [official OpenAI documentation](https://developers.openai.com/cookbook/examples/codex/using_goals_in_codex)
and the milestone guidance in
[the execution-plan cookbook](https://developers.openai.com/cookbook/articles/codex_exec_plans).
