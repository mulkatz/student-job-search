# Conception closure and implementation handoff

Updated: 2026-10-19. **G1 and G2 are complete; G3 is in progress.**
G2 is locally verified with synthetic data. [G3 setup](G3_SETUP.md) records a
ten-target extraction pilot and its incomplete measured baseline; no branch
acceptance is established. Offline C fixtures/schemas/scoring are verified and
Alpha's synthetic facts are approved privately. Partial live model observations
include failed first-pass cases; human package review and the full model sample
remain incomplete. The discovery window has not started.

## Accepted baseline and handoff state

The V1/V2 boundary is agreed in [CONCEPT.md](../CONCEPT.md). The user accepted the
recommended initial route: GCP-managed Gemini, Brave, and controlled HTTP retrieval
with Cheerio behind replaceable boundaries. CV processing and manually reviewed
email/questionnaire packages remain V1 requirements; the interface stays table-first.
[ADR 0010](adr/0010-manual-application-packages.md) makes Gmail exclusively a
Firebase Auth login identity, without Gmail API/mailbox OAuth integration.

| Item | State | Needed for |
| --- | --- | --- |
| V1 scope, ownership, pilot language/location | Agreed; private preferences may remain unknown | All work |
| Operating ceiling | EUR 50/month total; experiment planning sublimit EUR 5 | Costed G3 execution and operation |
| Baseline providers | GCP-managed Gemini, existing Brave, HTTP/Cheerio; optional alternatives/fallbacks need measured benefit | G3 and affected slices |
| Access | Project/ADC/billing/API verified; EU synthetic inference observed; Brave Search/Postpaid confirmed | Reliable model content/full sample, human package review and Brave storage/use rights |
| Source/model/extraction/manual-package contract | Defined in FEASIBILITY.md; no branch acceptance yet | G3 |
| Public-page fetch policy | ADR 0005; robots metadata alone does not exclude leads or block public fetches | G3 fetching and G4 |
| Exact model/region, plans, IAM/ADC and source rights | Live prerequisites explicitly recorded, not assumed verified | The affected G3 branch |
| Data/version/state schemas | Resolve Q5 before the affected persistence/side-effect slice | G4–G6 |
| Runtime/package versions and executable commands | Pinned and locally verified in G2 | Offline development foundation |

[FEASIBILITY.md](FEASIBILITY.md) owns the seven-day observation, samples, resource and
cost caps, success criteria, stop/recovery behavior and evidence requirements. It
replaces this document's earlier proposed benchmark. Accepted decisions are in
[ADR 0004](adr/0004-provider-boundaries-and-initial-candidates.md) and
[ADR 0005](adr/0005-bounded-experiment-and-public-fetch-policy.md). Provider and
extraction research remain reference snapshots, not compatibility tests.

The readiness check distinguishes a complete brief from an executed experiment.
Missing live access does not block G2. G3 must verify current prices/terms, operator
access and privacy/region conditions, then explicitly opt into live work;
this handoff does not request subscriptions, purchases, deployment or real CV use.
Candidate-specific facts/preferences remain private onboarding inputs. Unknowns
must remain visible and cannot be invented to satisfy eligibility or package tests.

G1's brief received independent review. Findings about vacuously passing extraction
and model gates were resolved by adding minimum successful samples, recall/coverage,
positive-case outcomes and bounded repairs. Partial live results exist; complete
branch results remain pending G3.

## First fresh-session goal: G2

Historical G2 contract below: its Gmail references were superseded by ADR 0010;
they do not authorize or require mailbox integration in the current product.

Completed 2026-10-19. This section retains the execution contract. Actual commands,
clean-clone/failure evidence, independent review and limits are in
[PLAN.md](PLAN.md#g2-development-foundation--complete).

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

- [x] Installation and the documented verification command succeed locally from
      a clean checkout; the lockfile and required runtime versions are committed.
- [x] Verification actually runs format/lint, strict types, meaningful tests, build,
      and a maintained secret scanner; negative tests prove invalid boundary inputs
      are rejected, and a failed check makes the gate fail.
- [x] CI invokes the documented gate without provider secrets/live API calls. Report
      remote CI success only if the actual run was observed; distinguish configuration
      and local verification from remote execution.
- [x] Synthetic owner/candidate fixtures establish the intended identity boundary;
      do not claim live authentication/authorization is implemented at this stage.
- [x] An independent reviewer has inspected the diff and verification evidence;
      material findings are resolved and rechecked.
- [x] `docs/PLAN.md` records outcome, actual commands, review evidence, and unresolved
      downstream prerequisites concisely. A next session can resume without this chat.

Follow [AGENTS.md](../AGENTS.md) for autonomous work and separate planning,
implementation, and review responsibilities. Add browser/emulator checks with their
actual layers; do not create placeholder checks that merely return success.

## Session and goal cadence

G1 is complete as an experiment brief and G2 as an offline foundation. G3 remains
in progress; the requested G4 continuation checks its viable-source prerequisite.
Read the current evidence and live-access prerequisites in
[PLAN.md](PLAN.md#g3-feasibility-experiment). [START_PROMPT.md](START_PROMPT.md)
provides the requested G4 continuation with explicit source prerequisites;
the completed G2 contract is [archived](archive/G2_START_PROMPT.md).
A fresh session is a project workflow choice,
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
