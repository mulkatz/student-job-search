# 0026: local operational handover and scoped release evidence

- Status: accepted
- Date: 2026-10-20
- Extends: [ADR 0019](0019-private-profile-data-lifecycle.md), [ADR 0025](0025-private-versioned-application-drafts.md)

## Context

The user requests G7 after local G6 verification. V1 still lacks useful real-source
coverage, adequate extraction acceptance and live operational evidence. Passing a
local test gate cannot establish a released service or waive those requirements.

## Decision

- Add an operator-only, read-only status command using the existing loopback-only
  emulator guard. Bound reads, execution time and output; report incomplete scans
  explicitly. Do not create an HTTP diagnostics endpoint or external telemetry.
- Emit aggregate counts and controlled alert codes for due cleanup, pending deletion,
  uncertain uploads, invalid records, unavailable storage and incomplete scans.
  Never emit owner IDs, facts, addresses, URLs, quotes, credentials or raw errors.
  Status covers tracked records; it does not certify source rights or all objects.
- Keep cleanup explicit and bounded. Preserve tombstones, uncertain writer markers,
  cumulative caps, origin ownership and cooldowns. Do not remove locks to manufacture
  recovery or renew retained source evidence through replay.
- Map every V1 acceptance criterion to a stable ID in a versioned, candidate-free
  evidence manifest. Fix required local/live scopes in code; manifest edits cannot
  lower those requirements. Missing, malformed or insufficient evidence blocks release.
- Provide a separate release check with a nonzero blocked result and manifest hash.
  Ordinary verification tests the check's behavior; it does not require an already
  releasable product. Evidence records are operator claims, not automatic proof of
  authenticity merely because a referenced file exists.
- Real sources, a running daily schedule, persistent authentication recovery,
  deployed ownership controls and unattended real-data operations need authorized
  live evidence. Synthetic tests can establish bounded local behavior only.
- Complete the local runbook and safe-data handover drill independently of release.
  Record G7 as incomplete while any V1 requirement remains unmet. Add no deployment,
  cloud scheduler, subscription, paid dispatch or real-data processing through this
  operational interface. Existing separately authorized G3 work keeps its own caps.
- Retire purpose-complete source captures and derived copies by their existing
  deadlines. Preserve minimized aggregate/digest provenance without raw source data;
  distinguish actual deletion from expiry and retained technical enforcement state.

## Alternatives

A green health endpoint or documentation checklist alone hides missing evidence.
Public diagnostics or unbounded logs expose applicant data. Installing production
infrastructure now would precede useful source acceptance and a reviewable release.

## Consequences

Operators get reproducible local status, recovery and evidence checks. Alerts are
local output, not delivered notifications. A blocked release check is an expected
result while development verification can pass; neither result authorizes deployment.
