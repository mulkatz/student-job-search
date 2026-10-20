# 0027: private deployed pilot and reviewed document intake

- Status: accepted
- Date: 2026-10-20
- Extends: [ADR 0018](0018-owner-private-profiles-and-evaluations.md), [ADR 0019](0019-private-profile-data-lifecycle.md), [ADR 0026](0026-operational-handover-and-release-evidence.md)

## Context

The user explicitly authorizes Firebase deployment at student-job-search.web.app,
asks for a compact table and real-source dry runs, and wants CV/PDF intake followed
by a questionnaire. This supersedes the earlier deployment/real-data prohibition
for this bounded private pilot; it does not waive remaining V1 acceptance evidence.

## Decision

- Serve the frontend through Firebase Hosting and the authenticated API through
  an EU Cloud Run service. Explicit production configuration uses platform ADC;
  emulator mode retains its fail-closed loopback guard and synthetic defaults.
- Require revoked-token checking, verified Google identity and a private operator-
  configured pilot allowlist. Derive all private ownership from the verified UID.
  Deny direct client database/storage access in the deployed pilot. No public
  onboarding, global candidate profile or credential in browser assets is allowed.
- Use scale-to-zero and finite instance/concurrency limits. Preserve the EUR 50
  monthly operating constraint; finite search runs have separate reserved budgets.
- Deploy noindex response headers and robots/Googlebot metadata. Let crawlers read
  the public shell's noindex rule; robots.txt blocking alone cannot prevent indexing.
  Authenticate all candidate/job APIs; no candidate content goes in static assets.
- Accept at most three bounded PDFs per profile intake. Retain per-document hashes,
  original page references and quote attribution in combined review drafts and
  immutable approvals. Do not silently replace retained evidence or renew expiry.
- Real PDF extraction requires explicit runtime enablement and applicant consent.
  Parse locally with bounded Poppler, never send document text to search providers
  or a model. Ordinary CV prose still requires reviewed correction/attestation;
  a parse is not automatic semantic approval of candidate facts.
- Supplement reviewed facts through a compact questionnaire. Search preferences
  remain separate from skills/experience. Unknown languages, availability or work
  permission stay unknown. Personalized evaluation requires explicit approval.
- Keep source leads, fetched vacancies, compatibility and fit distinct. Manual Apply
  navigation/copying never submits or fills employer forms. Ignored/applied status
  stays owner-private and does not imply delivery.
- Invoke bounded cleanup daily through an authenticated Cloud Scheduler job, using
  a dedicated identity allowed to invoke only the maintenance job. Keep manual
  recovery available; this schedules no source search or model/provider call.

## Alternatives and consequences

A static-only deployment cannot support private CV processing. Publishing the local
emulator bootstrap exposes a nonworking application. Automatically trusting extracted
CV text invents confidence and prevents meaningful applicant review. The deployed
pilot remains distinct from full V1 release and broader-user V2 onboarding.

## Reviewed references (2026-10-20)

- [Hosting and Cloud Run](https://firebase.google.com/docs/hosting/cloud-run)
- [Google authentication](https://firebase.google.com/docs/auth/web/google-signin)
- [Google noindex behavior](https://developers.google.com/search/docs/crawling-indexing/block-indexing)
