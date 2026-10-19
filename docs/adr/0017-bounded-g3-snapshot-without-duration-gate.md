# 0017: bounded G3 snapshot without a duration gate

- Status: accepted
- Date: 2026-10-19
- Supersedes: the seven-consecutive-day requirement in ADR 0005/0008 and G3 A only

## Context

After G4 the user explicitly instructed removing the long-term test and completing
remaining G3 work alongside G5. One discovery date and actual extraction/model
observations already exist. Dropping duration does not establish recurring yield,
source permission, useful coverage, extraction quality or human content approval.

## Decision

- Replace the mandatory seven-day observation window with a finite, explicitly
  recorded `bounded_snapshot` policy for this G3 experiment. No further calendar
  observations or next-due dates are required solely to satisfy duration.
- Persist a one-way policy receipt with authorization reference, this ADR and actual
  authorization time in the existing ledger. Preserve its manifest, configuration,
  original start time, every attempt/reservation/settlement and historical dates.
  Legacy state without this receipt keeps its original semantics.
- Remove only the authorized duration/end-date admission gate. Keep monotonic time,
  same-Berlin-day reservation/dispatch, daily and cumulative request limits, token
  bounds, allocations, EUR 5 experiment/EUR 50 monthly ceiling and reconciliation.
  No other cap change is inferred from removing this test.
- Report the longitudinal test as removed by operator instruction, never passed.
  Report actual observation dates and snapshot quality/coverage separately. Keep
  search leads, source-advertised details and current compatible jobs distinct.
- Still measure both discovery streams and at least one structured source; retain
  the unique compatible/incremental coverage criteria and honest negative results.
  Required extraction, synthetic model and exact-content human package review stay.
- Continue G5's independent synthetic-first implementation. No real CV use until
  owner isolation and retention/export/deletion exist; no fabricated human labels
  or approvals may substitute for the remaining G3/G5 evidence.
- Source/capture retention remains at most seven days, shortened by source policy;
  dropping the seven-day benchmark never extends any data retention.
- Do not add unattended schedules, reset an experiment, fake observation dates,
  change account/billing/IAM settings or infer permission for new subscriptions.

## Alternatives

Waiting for seven dates contradicts the user's current instruction. Marking a
one-day sample as a passed seven-day benchmark would misstate the evidence.
Resetting the ledger would discard incurred usage and failure history.

## Consequences

G3 can conclude from bounded evidence and explicit positive/negative decisions
without calendar waiting. Independent daily-run behavior remains implemented, but
recurring market yield remains unmeasured. Other genuine evidence/access or human
review gaps remain visible and must not be relabeled as duration requirements.
