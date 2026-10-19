# 0001: autonomous, independently reviewed development

- Status: accepted
- Date: 2026-10-19
- Partially superseded: Gmail feasibility priority only by
  [ADR 0010](0010-manual-application-packages.md); other workflow decisions remain accepted.

## Context

The user requested a repository foundation and the collaboration/commit rules from
StateParcel. This project is at the concept stage, with no runtime or live access.
StateParcel's product-specific restoration and fingerprint rules do not apply.

## Decision

- Keep repository content in English and use atomic lowercase semantic commits.
- Maintain one instruction set in `AGENTS.md`; `CLAUDE.md` is a relative symlink.
- Work autonomously within agreed scope and resolve reversible technical details.
- Use distinct planning, implementation, and independent review agents for
  substantive implementation; scale coordination for documentation/mechanical work.
- Define bounded goals with acceptance evidence and record delivery state in
  `docs/PLAN.md`; significant decisions belong in concise ADRs.
- Establish one verification entry point and CI before substantial product coding;
  add relevant browser/emulator checks as the corresponding layers appear.
- Default checks to synthetic offline data. Live checks require authorized access
  and opt-in, and must not run as ordinary CI tests.
- Start with source/Gmail feasibility before building the full dashboard/assistant.
- Protect applicant data and credentials; select license/attribution before public
  distribution. Push, publication, and unapproved spending are outside setup scope.

## Alternatives

- Copy the reference verbatim: preserves irrelevant product invariants and licensing assumptions.
- Use a single agent for all implementation/review: less coordination but no independent scrutiny.
- Build the complete proposed architecture before checking sources: risks poor coverage.

## Consequences

The general workflow and commit conventions are adopted; privacy, eligibility,
source access, ownership, and draft-only invariants replace StateParcel-specific
rules. No executable verification command or tested integration exists yet.
The reference is not a runtime dependency. Adapted from the reference repository's
`AGENTS.md` and `docs/adr/0001-development-workflow.md` during this setup.
