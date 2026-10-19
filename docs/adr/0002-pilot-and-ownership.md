# 0002: one-person pilot with explicit ownership for later reuse

- Status: accepted
- Date: 2026-10-19

## Context

The original proposal targets a single English-speaking Berlin student. The user
wants the tool to be usable by others eventually and agreed to a simple pilot
while avoiding an expensive change from global private state to owned data later.

## Decision

- Pilot with one authenticated owner and one active candidate profile. Do not build
  public signup, invitations, administration, billing, or shared candidate access.
- Give every private profile/version, CV, evaluation, application, and OAuth
  credential an owner boundary and candidate association where relevant.
- Enforce authorization server-side and in database/storage access rules. Resolve
  mailbox credentials by authenticated ownership; never accept an arbitrary owner ID.
- Keep reusable source listings separate from private annotations and assessments.
- Store languages, location, availability, preferences, and mailbox connection as
  profile/configuration values rather than global English/Berlin/mailbox constants.
- Test cross-owner denial with synthetic identities even in the one-person pilot.
- Deliver discovery, matching, and applications as slices of the full MVP. Start
  automatic Gmail drafting disabled; validate the manual path before optional opt-in.

## Alternatives

- A global single-user profile/mailbox: simplest initially but creates avoidable
  identity, credential-isolation, and migration risks.
- Public multi-user service immediately: adds onboarding, OAuth, privacy, quotas,
  abuse handling, and operational scope before useful job coverage is validated.

## Consequences

The pilot remains small while persistence and authorization have a useful boundary.
This is not a claim that a public multi-user service is complete or a trivial
migration: onboarding, OAuth production readiness, data lifecycle, and capacity
still need a separately scoped goal. Exact record paths and schemas will be decided
before the affected implementation slice, with the original samples treated as proposals.
