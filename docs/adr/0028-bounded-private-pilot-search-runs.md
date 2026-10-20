# 0028: bounded private pilot search runs

- Status: accepted
- Date: 2026-10-20
- Extends: [ADR 0016](0016-private-brave-operator-authorization.md), [ADR 0027](0027-private-pilot-deployment-and-profile-intake.md)

## Context

The user requests a real dry run of about 30 potential opportunities after reviewed
PDF intake and a questionnaire. G3 has only nine record reservations left. Reusing
or resetting that ledger would hide completed work and cannot support this request.

## Decision

- Keep the G3 ledger, first failures, cumulative caps and retention history intact.
  Record pilot runs separately in server-owned Firestore state with durable request,
  record and conservative cost reservations made before provider dispatch.
- Require a current explicitly approved immutable owner profile. Search uses only
  controlled generic job/preferences vocabulary, never applicant names, contacts,
  CV prose, quotes, authorization declarations or freeform personal details.
- Limit each run to EUR 1 reserved search spend, 20 search calls, 120 public HTTP
  sends including metadata/redirects, 300 observations and 30 displayed deduplicated
  potential opportunities. No model call or subscription change is included.
  Bound aggregate pilot search reservations to EUR 5 per month, leaving operating
  headroom under the user's EUR 50 monthly total. Platform billing is separate;
  instance caps and application reservations are not a provider billing hard stop.
- Allow one active run per owner and idempotent exact-profile request IDs. Dispatch
  a bounded Cloud Run job with retries disabled. Unknown dispatch/paid completion
  needs explicit reconciliation; never automatically redispatch or refund ambiguity.
- Import the retained source ownership/pacing baseline before enabling search.
  Preserve the existing technical source IDs, per-origin ownership, pacing and
  cooldowns across runs. Missing baseline refuses dispatch; a new run does not
  reset enforcement. Apply existing redirect/SSRF/access/resource/source policies.
- Reuse URL/provenance-only Brave discovery under the bounded private operator
  exception; this is not a vendor grant. Retain no snippets or raw search responses.
  Do not broaden the exception to public data redistribution or model input.
- Fetch/normalize permitted public targets with traceable evidence. Search URLs,
  generic career leads, unavailable pages and actual vacancy details remain distinct.
  Fewer than 30 usable observations is an honest terminal result, not an error to
  conceal with duplicates, synthetic jobs, guessed facts or unreviewed source claims.
- Store candidate-free shared observations; private run/profile/evaluation/status
  data remains UID-scoped, bounded and included in export/deletion/retention.
  Private run metadata expires with its approved profile version (at most 90 days);
  daily cleanup removes invalid/expired run, attempt and owner references together.
  Search result counts never establish compatibility, model quality or V1 release.

## Alternatives and consequences

A client-side API key exposes credentials and cannot enforce durable budgets. An
untracked background promise may stop when its HTTP request ends. Automatic retries
can double paid calls. A durable bounded job gives the applicant a reviewable run
without claiming market coverage or 30 eligible vacancies in advance.
