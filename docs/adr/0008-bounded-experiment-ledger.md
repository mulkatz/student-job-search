# 0008: private bounded G3 experiment controls

- Status: accepted
- Date: 2026-10-19
- Partially superseded: Gmail/mailbox integration clauses only by
  [ADR 0010](0010-manual-application-packages.md); other decisions remain accepted.
- Daily HTTP limit superseded by [ADR 0012](0012-http-experiment-throughput.md).

## Context

G3 requires resumable observations and shared resource/budget controls while real
account access, rights, prices and OAuth are still being established. Production
state, authorization and source identity models remain later delivery work.

## Decision

- Add only private `packages/experiment`, with its own compiled tests/build and
  init/status CLI. Rebuild before CLI execution; no stale compiled runner is used.
- Validate and canonically SHA-256 hash the twenty-query manifest (ten per stream).
  Initialize once; reject changed manifests and duplicate attempt IDs after restart.
- Keep versioned strict configuration and the ledger under `.local/g3/` with a
  0700 directory and 0600 files. Configuration allocates integer micro-euros across
  discovery/extraction/model/Gmail; the sum cannot exceed EUR 5. No credentials or
  candidate information belong in this ledger. Status reports aggregate controls.
- Reserve attempts, branch budget and conservative token/record upper bounds before
  work. Count retries, failed and outstanding attempts permanently; release only
  unspent monetary reservations after definitive settlement. Ambiguity retains the
  upper cost and cannot be automatically settled or retried as the same attempt.
- Enforce the resource table's cumulative/daily search, structured, HTTP, LLM,
  record/token limits and five initial boards. Block Gmail while a creation is
  outstanding/ambiguous and after its first success. Persist actual cost overruns;
  block further reservations and dispatches rather than dropping billing evidence.
- Require per-dispatch explicit live opt-in. Only the live-discovery dispatch
  barrier starts seven Berlin calendar days; setup/reservations do not. Reject
  stale-day dispatches, clock rollback and new work after day seven. Status exposes
  next due date, missing past attempt days and an unevaluated/incomplete benchmark.
- Serialize writers with an exclusive lock and atomic, fsynced state installation
  or replacement. A crash/uncertain write retains the lock. Manual reconciliation
  must inspect private state/external evidence before clearing it; no reset command.
- Use exact Cheerio 1.2.0 and ipaddr.js 2.5.0 for the separately tested bounded
  public-HTTP/extraction boundary, following ADR 0005. No rendering fallback is added.
- This local control harness is not authentication, tamper-resistant storage or a
  provider runner. Callers still enforce actual per-hop reservations, source rights,
  scheduled eight follow-ups/day, stream coverage, fallback sample limits and all
  branch acceptance criteria before live work. No test substitutes for live evidence.

## Alternatives

A production workflow/database framework is premature. In-memory counters reset
across sessions. Blind retries lose ambiguity; dropping unexpected costs hides
overspend. A mutable query set invalidates the original coverage measurement.

## Consequences and sources

Offline tests can establish control behavior, not source access, Gmail behavior,
seven-day coverage, or a complete G3. Local operators can still edit/delete files;
manual reconciliation is an audit obligation, not a security boundary.
Official references reviewed 2026-10-19: [Node fs](https://nodejs.org/docs/latest-v24.x/api/fs.html),
[HTTP](https://nodejs.org/docs/latest-v24.x/api/http.html), [HTTPS](https://nodejs.org/docs/latest-v24.x/api/https.html),
[Cheerio loading](https://cheerio.js.org/docs/basics/loading/),
[Cheerio security](https://cheerio.js.org/docs/advanced/security/),
[ipaddr.js](https://github.com/whitequark/ipaddr.js/blob/main/README.md).
