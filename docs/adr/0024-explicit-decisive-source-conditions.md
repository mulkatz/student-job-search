# 0024: explicit decisive source conditions for matching

- Status: accepted
- Date: 2026-10-19
- Extends: [ADR 0018](0018-owner-private-profiles-and-evaluations.md)

## Context

The original English Boolean cannot represent additional mandatory German/Russian.
Substring location checks confuse a city with a negation or a foreign namesake.
Separate contract/hour fields cannot safely combine alternatives such as twelve-hour
part-time work or forty-hour full-time work. Unmodeled mandatory conditions remain
decisive uncertainty even when the supported fields happen to match.

## Decision

- Add strict, optional source condition fields without defaults, preserving legacy
  stored shapes and hashes. Absence stays unknown; it does not mean no restrictions.
- Represent complete working-language alternatives with exact source quotes:
  alternatives are OR, languages within each alternative are AND. Bind explicit
  proficiency requirements and compare them with approved language declarations.
  Missing ability/level remains review; explicit denial or a lower stated CEFR
  level can block an alternative. Do not equate fluency with CEFR implicitly.
- Represent quoted on-site/hybrid city and country or permitted remote countries;
  compare explicit approved preferences without global city/language assumptions.
  Preserve incompatible work modes, negations, unfamiliar and conflicting values.
- Tie each employment alternative to its own weekly-hour range and explicit
  flexibility. Never take the format from one option and hours from another.
  A straddling range without confirmed flexibility remains review.
- Require explicit handling of remaining mandatory conditions. Unknown/unresolved
  requirements remain review; absence is not proof that no conditions remain.
  No legal eligibility, professional qualification or candidate ability is inferred.
- The current permission declaration covers Germany only. A foreign-only work
  arrangement remains review; a supported Germany alternative must also match the
  approved location preference. Generic city support does not expand permission.
- Use evaluator version `g5-deterministic-v2`. Retained v1 evaluations still parse,
  but server/UI mark them stale; changed conditions never silently rewrite history.
- Positives in tests use the same quoted production schema and approval path;
  no fixture-only eligibility bypass. Preserve original regression labels and
  independently frozen holdout first-run results, including policy-tightening changes.

## Alternatives

Adding more English/location substrings cannot express conjunctive requirements or
paired alternatives safely. A general executable rules language adds unnecessary
scope; bounded typed conditions and conservative unknowns suffice for this pilot.

## Consequences

Legacy observations can become review rather than eligible, without inventing source
conditions. This is intentional uncertainty preservation, not improved real-market
coverage. Extraction/normalization must supply evidence before live jobs can pass.
Independent agent benchmark review remains separate from source authenticity,
candidate approval and production/real-data authorization.
