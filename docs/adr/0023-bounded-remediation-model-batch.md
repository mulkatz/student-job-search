# 0023: bounded synthetic model remediation batch

- Status: accepted
- Date: 2026-10-19
- Extends: [ADR 0020](0020-g3-model-daily-throughput.md)

## Context

The original G3 sample failed uncertainty handling and four package contents.
All three textual CV outcomes already pass. The user requested autonomous quality
remediation. Today 68 of 70 model requests are consumed; total usage is 68 of 100.
CountTokens and generation each count as one request under the existing protocol.

## Decision

- After offline fixes and independent operator review, permit one versioned batch
  containing all twenty matching cases and five package cases from the unchanged
  approved synthetic corpus. Keep expected labels and editorial answers out of input.
- Use one CountTokens call and one generation, sequentially reserved and dispatched
  through the existing store and model lock. No automatic repair or retry today.
  Preserve 70/day, 100 total, token caps, EUR 5 and every original reservation.
- Reserve the documented full model-output bound for the generation even when its
  configured output is smaller. Retain exact payload, hashes, provider response,
  model version, full settled usage and conservative cost. Ambiguity stops work.
- Record one actual generation attempt shared by the 25 case outputs, never 25
  independent requests. Validate exact unique case IDs and each task schema;
  partial, truncated, missing or malformed outputs remain failures.
- Keep a separate batch report and first-pass metrics. Original C failures and
  single-case repair histories remain unchanged. Reuse unchanged passing CV
  evidence explicitly rather than pretending it was regenerated.
- Independently review every new package's complete content and fact/field/channel
  bindings. Valid IDs alone cannot establish prose truth or operator approval.
- Supply reviewed per-question fact scopes as trusted generation constraints. This
  assisted method does not test general question-to-fact selection or represent an
  unchanged original prompt; disclose the assistance alongside its actual results.
- No licensed search/page results, real candidate data, tools, external actions,
  additional provider account or uncontrolled parallel spending enter this batch.

## Alternatives

Raising limits again is unnecessary for this bounded follow-up. Dropping preflight
accounting, overwriting earlier failures or claiming batched observations are
independent would weaken the evidence. A later run still requires available caps.

## Consequences

Results establish this versioned batched method only, not statistical independence
or universal model reliability. Default tests are offline; actual access is observed
only after the separately frozen live operator executes within existing authority.
