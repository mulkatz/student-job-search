# 0010: manual application packages; Gmail identity for login only

- Status: accepted
- Date: 2026-10-19
- Partially supersedes: Gmail feasibility priority in [0001](0001-development-workflow.md)
  and Gmail/mailbox integration clauses only in ADRs [0002](0002-pilot-and-ownership.md), [0003](0003-release-scope-and-web-discovery.md),
  [0005](0005-bounded-experiment-and-public-fetch-policy.md) and
  [0008](0008-bounded-experiment-ledger.md).

## Context

The user replaced Gmail draft integration with an application draft that can be
reviewed and copied, including answers to external application questionnaires.
Gmail addresses serve exclusively as Firebase Auth login identities. Ownership,
approved profile versions, truthful claims and broad discovery remain required.

## Decision

- Current V1/G3 has no Gmail API, mailbox OAuth scopes/credentials, mailbox
  connection, draft creation or mailbox monitoring. No later integration is promised.
- The job table's “View application draft” opens one shared review/copy dialog:
  email subject/body or questionnaire fields with internal mapping IDs,
  source-evidenced questions and proposed answers.
  Questionnaire answers each have an individual copy action and original form link.
- The applicant alone transfers text, attaches files, sends or submits. Never
  autofill, write browser forms, or perform consent/signature/declaration actions.
- Candidate claims trace to approved immutable profile facts and job evidence.
  Missing facts use `needs_input` without an invented answer; unknown start dates
  remain unanswered. Consents/signatures/declarations use
  `applicant_action_required`, without claiming that action has occurred.
- Preserve package/profile/job/evaluator versions and human edits. Human review
  binds to exact full generated content and its hash; changed content needs review.
- Replace G3 D's Gmail test with manual review of the same five C packages:
  two email and three questionnaire packages. Stable internal field IDs map to
  source-evidenced question wording/association; do not invent employer DOM/source
  IDs. All candidate claims and missing/action states must be reviewed.
  Pending profile approval or absent/unreviewed model content keeps C/D incomplete.
- Implement and exercise the actual dialog and clipboard in G6, in a real browser.
  G3's offline fixture/schema/scorer work introduces no UI or clipboard pass claim.
- Preserve historical evidence and cumulative version-1 ledger compatibility.
  Dormant zero-valued Gmail allocation/count controls do not authorize mailbox
  access or impose a current acceptance requirement. No Gmail adapter is added.

## Alternatives

Keeping Gmail draft OAuth adds an integration the user no longer requests.
Automatic questionnaire filling expands external side effects and falsely implies
authority over applicant declarations. A generic letter alone misses field answers.

## Consequences

V1 still requires CV processing and useful application packages. G3 measures
content correctness and manual review; G6 measures review/copy usability. Removing
Gmail does not approve profiles, prove source/model access or complete the seven-day
benchmark. The original proposal and historical G2 contract remain unchanged with
current-scope pointers. Firebase Auth login must still receive its own ownership,
session and recovery verification when implemented.
