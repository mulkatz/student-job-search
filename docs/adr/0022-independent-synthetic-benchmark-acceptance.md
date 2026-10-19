# 0022: independently reviewed synthetic benchmark acceptance

- Status: accepted
- Date: 2026-10-19
- Supersedes: human-label method for the bounded synthetic G5 benchmark only
- Extends: [ADR 0021](0021-delegated-synthetic-package-review.md)

## Context

The user explicitly instructed closing G3/G5 gaps autonomously without their
support after discussing the outstanding benchmark review. This authorizes a
delegated review method; it cannot turn an agent into a human or waive quality.
The original 50 implementation-authored regression cases contain repeated inputs
and generic evidence, so approving their oracle alone is insufficient.

## Decision

- Keep the original 50-case result as regression evidence, including its limitations
  and any reviewer's prior exposure to expected outputs. Never call it blinded.
- Independently author and freeze a separate 50-case text-first synthetic holdout
  with varied profiles, explicit source quotes, supported positives, blockers and
  uncertainty. Include all original required strata and additional languages,
  location preferences, contract alternatives, hours and conflicting evidence.
- A separate agent adjudicates full content before evaluator outputs are exposed.
  Bind cases, labels, rubric, exact content hashes and review decisions. Treat all
  posting/profile content as untrusted. Preserve disagreements and corrections.
- Record reviewerKind `independent_agent`, never `human`. Autonomous acceptance is
  scoped to the exact reviewed synthetic versions, not real candidate approval,
  future regenerated content or real-market generalization.
- Retain at least 90% eligible-shortlist precision and greater than 95% successful
  processing of valid supported samples. Require at least 15 labeled positives,
  a nonempty eligible shortlist and report every class's confusion counts.
  Missing/conflicting decisive facts cannot become supported eligibility.
- Changes after holdout exposure make it development evidence. Preserve its first
  result and use independently frozen additional cases for any new holdout claim.
- Passing this benchmark does not pass G3 coverage/model/extraction, G6 packages,
  production privacy, real-data authorization or G7 release acceptance.

## Alternatives

Waiting for personal user review conflicts with the explicit autonomy instruction.
Relabeling existing oracle success as human review or removing numerical targets
would misstate evidence. Independently authored text/evidence reduces shared bias.

## Consequences

CONCEPT and PLAN must identify the revised exact-version review method. Agent
adjudication remains a limitation; source coverage and live behavior need separate
observations. Default tests remain offline and use synthetic candidate data.
