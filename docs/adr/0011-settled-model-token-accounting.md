# 0011: settled model token accounting

- Status: accepted
- Date: 2026-10-19
- Partially supersedes [ADR 0008](0008-bounded-experiment-ledger.md): model token
  reservation release only; all resource, attempt, calendar and monetary caps remain.

## Context

A conservative single-candidate model request reserves up to 65,536 combined
answer/thought tokens. Permanently adding these maxima prevents sequential G3
cases even when complete provider usage shows much smaller actual consumption.
Provider output cutoffs include thinking; an answer-text limit alone is inadequate.

## Decision

- Keep every original request and upper bound unchanged. Add an optional strict
  `actualModelUsage` receipt containing input, candidate and thought token counts
  together with a private `.local/` evidence reference. Combined actual output is
  candidate plus thought tokens; omitted or partial counts are never guessed zero.
- Accept receipts only for dispatched LLM attempts with definitive success/failure
  and actual cost. Reserved, cancelled-before-dispatch and ambiguous operations
  cannot release bounds. Old ledgers remain valid without receipts or migration.
- Use complete settled actual usage, otherwise the original bound, to enforce the
  unchanged cumulative 500k input/100k output caps. Count every reserved attempt
  permanently, including failures; daily/whole attempts, records and costs retain
  their existing limits. Status distinguishes original bounds from effective use.
- Persist unexpected observed usage above a request/global token bound, expose
  `tokenOverrun`, and block all subsequent reservation/dispatch. State validation
  clamps only the validation contribution to the original bound to preserve that
  observation; reported effective usage retains the full actual amount. Settlement
  of already outstanding work remains possible so no observed billing is dropped.
- A private evidence path is an operator reference, not authenticated provider
  evidence or a file-content check. The live caller validates complete provider
  metadata, reserves a documented combined upper bound, and stores its evidence.
  This change adds no provider dispatch, candidate approval or cap waiver.

## Alternatives

Reducing maxima without a proven provider bound risks unreserved thinking. Resetting
the ledger loses cumulative use. Replacing requests erases original reservations;
rejecting observed overruns loses accounting evidence. Permanent maxima prevent
otherwise bounded sequential observations despite complete actual usage.

## Consequences and sources

Offline tests establish receipt/lifecycle/cap behavior and legacy compatibility,
not provider correctness, access, prices or actual experiment results.
Reviewed 2026-10-19: Google's [thinking output cutoff and billing documentation](https://ai.google.dev/gemini-api/docs/generate-content/thinking#token-limits-and-max_output_tokens).
The operator must verify the selected endpoint/model limit before each live run.
