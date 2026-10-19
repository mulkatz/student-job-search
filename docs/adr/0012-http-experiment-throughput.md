# 0012: HTTP experiment throughput

- Status: accepted
- Date: 2026-10-19
- Partially supersedes [ADR 0008](0008-bounded-experiment-ledger.md): daily HTTP
  limit only; all other experiment controls remain accepted.

## Context

G3's local experiment ledger imposed 40 direct-page HTTP attempts per Berlin
calendar day. This was an experiment design choice, not an HTTP tool or provider
quota. The user identified daily request limits as unsuitable for this workflow.
The 200-attempt cumulative bound already limits the extraction experiment's work.

## Decision

- Remove only the daily HTTP cap from the ledger and G3 resource table. Allow the
  remaining HTTP allowance within one day, subject to source-specific pacing.
- Preserve the 200-attempt whole-experiment cap and existing private ledger.
  Reservations, failures, outstanding attempts, redirects, robots requests,
  retries and browser subrequests continue to count; no reset or migration occurs.
- Preserve the seven-day discovery clock, cumulative accounting, budgets, token
  and record bounds, search's 40/day and LLM's 30/day controls.
- Preserve source policy, network restrictions, provider quotas, request pacing,
  and 429/`Retry-After` handling. This decision does not authorize bypassing an
  external restriction or adding a CAPTCHA solver.
- This changes G3's local controls only. Production throughput and scheduling
  remain separate architecture work.

## Alternatives

Keeping 40/day delays an already bounded sample without evidence of a provider
requirement. Raising that arbitrary daily number adds another unnecessary bound.
Removing all HTTP accounting would discard the agreed experiment work limit.

## Consequences

Offline restart tests establish admission above 40 HTTP attempts on one Berlin
date and rejection of attempt 201, including failed and outstanding work. They
do not establish any website's permitted request rate or source accessibility.
Existing experiment state retains all prior usage; the change cannot create a
fresh allowance by restarting the process.
