# 0020: operator-authorized G3 model daily throughput

- Status: accepted
- Date: 2026-10-19
- Supersedes: G3 model's internal 30/day limit only after explicit receipt

## Context

The user removed G3's long-term test. Thirty model attempts were already made today,
including fifteen free CountTokens preflights. Nineteen remaining matching cases
need 38 requests under the existing preflight/generation protocol. The user explicitly
selected increasing the internal daily model limit to 70 for remaining G3 checks,
while keeping 100 cumulative attempts and the EUR 5 experiment budget unchanged.

## Decision

- Persist a separate one-way `remaining_g3` model request policy receipt with
  dailyLimit 70, operator authorization reference, this ADR and actual adoption time.
  Legacy state without this receipt retains 30/day behavior.
- Preserve original attempts, reservations, settlements, model failures, manifest,
  start time, configuration and observation-policy receipt. No resetting counters.
  Earlier daily violations cannot be retroactively authorized by a later receipt.
- Count free CountTokens and generation/repair calls alike. Retain 100 cumulative
  model requests, 500k input/100k billed output tokens, allocation/cost reservations,
  EUR 5 experiment/EUR 50 monthly ceiling and same-day reserve/dispatch constraints.
- Keep provider rate limits, persisted 429 cooldowns, explicit live opt-in, private
  usage receipts, uncertain-attempt reconciliation and at most one allowed repair.
  No parallel paid generation may overbook the shared ledger.
- This changes a local throughput limit, not provider permissions or model quality.
  Default tests stay offline; no new account, subscription, top-up or deployment.

## Alternatives

Waiting for later dates would retain the previous limit but is not the user's
chosen option. Removing all limits or dropping preflight accounting is unnecessary.

## Consequences

The remaining nineteen matching cases fit within 68 total model attempts if each
uses one preflight and inference. Further failures/repairs still consume remaining
limits; completing requests does not mean their quality criteria passed.
