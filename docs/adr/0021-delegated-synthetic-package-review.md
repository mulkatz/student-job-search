# 0021: delegated review of exact synthetic application packages

- Status: accepted
- Date: 2026-10-19
- Supersedes: direct human line-by-line review method for these five G3 packages only

## Context

The user received the exact five-package review artifact and said they were not
fully certain, requested a separate agent review, and would approve it. This is
conditional operator approval after independent semantic review, not evidence
that the user personally inspected every line. The scope is synthetic G3 content.

## Decision

- Independently review every full subject/body/answer, source channel, field mapping
  and candidate claim against the approved synthetic profile and source evidence.
  The reviewer must not have implemented/editorially corrected these package files.
- Check exact output/file hashes and versions. Missing questionnaire facts remain
  `needs_input`; consents, signatures and declarations remain applicant actions.
  Unsupported facts, qualifier claims or channels require a new corrected version
  and independent re-review before conditional approval can take effect.
- When no material finding remains, record the user's conditional approval and
  delegated reviewer result against the exact five outputs and review artifact hash.
  Record reviewMethod `delegated_semantic_review_with_operator_approval`; never claim
  direct human line-by-line review or automatically approve future regenerated text.
- Preserve original generated failures and editorial versions separately. Approval
  of corrected content does not turn original model failures into C successes.
- No email, application submission, browser-form write or external recipient action
  is authorized. G6 review/copy UI and real candidate approval remain separate.
- This exception does not authorize AI-generated human labels for G5's 50-posting
  benchmark. Keep that requirement/evidence explicitly pending unless separately
  changed by the user.

## Alternatives

Treating uncertain conditional approval as an unconditional human content review
would misstate the evidence. Asking for the same approval again would ignore the
user's explicit delegated-review instruction.

## Consequences

These five synthetic artifacts can complete D under the revised review method if
independent review succeeds. Facts and approval remain exact-version scoped; source,
quality, benchmark and real-data boundaries otherwise remain unchanged.
