# 0025: private versioned application drafts

- Status: accepted
- Date: 2026-10-20
- Extends: [ADR 0010](0010-manual-application-packages.md), [ADR 0018](0018-owner-private-profiles-and-evaluations.md), [ADR 0019](0019-private-profile-data-lifecycle.md)

## Context

The user explicitly requests G6 while G3 coverage, extraction and model-package
acceptance remain open. A local review/copy journey can be verified independently;
it cannot establish successful model generation or V1 release readiness.
Application links currently carry no channel-verification guarantee.

## Decision

- Implement an authenticated local draft slice with deterministic English templates
  and verbatim approved profile facts. No paid provider, mailbox, employer-form
  write, sending or submission is introduced. Treat source/profile text as data.
- Require a server-owned, reviewed source contract for channel and questionnaire
  wording/answer mapping, bound to the exact job revision and source expiry.
  Unreviewed links remain leads. Browser requests cannot promote source evidence
  to verified status or supply a recipient, question, owner or candidate identity.
  An inline source review hashes its candidate-free payload excluding the review
  receipt; the resulting observation revision then includes that reviewed payload.
  This binds exact content without a self-referential revision hash.
- Scope application records to the authenticated owner and current job identity.
  Keep operation attempts distinct from immutable package versions. Bind package
  hashes to full content, evidence, source/profile/evaluator versions and channel.
  Reusing an operation with different input fails; retries preserve the result.
- Store bounded records in the existing transactional private profile state, sharing
  tombstones, export, deletion and size limits. Bound all attempts and versions.
  Retention ends no later than source, approved profile, evaluation or seven days;
  editing, reviewing and retrying never extend the original evidence deadline.
- Regeneration creates a distinct version and preserves prior versions and edits.
  Freeform applicant edits require new review and do not inherit automatic claim
  grounding. Unsupported edited claims cannot become ready merely through review.
- Unknown facts remain answerless `needs_input`; consent, signature and declaration
  fields remain `applicant_action_required`. Unknown start dates stay unanswered.
  Missing or stale decisive eligibility/channel evidence prevents ready status.
- Derive readiness server-side from current evidence and exact review hashes. Check
  current inputs again when authorizing explicit clipboard copying; no automatic
  copy. Retained historical versions remain identifiable rather than overwritten.
- Manual applied/ignored status is separate from generation/review/copy and is only
  the applicant's report. It proves no delivery or submission. Keep G3 gaps and G7
  release acceptance explicit; synthetic browser evidence establishes local behavior.

## Alternatives

Waiting for reliable model output would block an independently testable UI slice.
Trusting arbitrary browser channel/question metadata or treating edited prose as
grounded would bypass evidence controls. Separate private persistence would add
cross-record lifecycle races without a current need.

## Consequences

The first engine is deliberately limited to approved fact rendering. Real source
contracts and model quality need separate evidence. Tests must exercise ownership,
staleness, interrupted/repeated work, preserved edits and actual browser clipboard.
