# 0018: owner-private profiles and versioned evaluations

- Status: accepted
- Date: 2026-10-19

## Context

G5 needs actual PDF processing, corrected approved facts and evidence-based matching.
The local G4 server already derives a Firebase UID; its offline core owner IDs are
separate types. Shared discoveries must never contain candidate facts or scores.

## Decision

- Use the verified Firebase UID as the private owner boundary; derive one candidate
  identity server-side. Never accept owner paths, active profile pointers or storage
  paths from the client. Preserve the separate offline identity contract.
- Keep API-only private state under `users/{uid}` and assets under its private
  Storage prefix. Narrow existing recursive client read grants; specific denials
  cannot override broader Firebase rule grants. Admin repositories check ownership.
- For this local pilot use one size-bounded transactional state document with
  bounded assets/drafts, immutable approved versions and private evaluations.
  Capacity exhaustion returns an explicit conflict; do not silently evict history.
- Extract actual PDF page text with maintained local Poppler commands, without a
  shell, external requests or executable document instructions. Bound input, pages,
  text, subprocess output and time. Malformed, encrypted and scan-only documents
  have explicit parse/review outcomes; no invented facts or implicit OCR.
- Draft facts have stable IDs and exact page/quote provenance or explicit user
  attestation for corrections. Approval atomically creates an immutable version
  and active pointer, checking draft/base revisions against concurrent edits.
- Matching requires an active approved version. Confirmed incompatibility blocks;
  absent/conflicting decisive evidence remains `needs_review`. English text and
  unspecified remote do not establish language/Germany compatibility. Do not infer
  hours, work authorization or legal eligibility. Separate fit and confidence.
- Public observations may optionally carry quoted weekly-hour ranges and explicit
  authorization requirements; absent legacy fields remain absent and preserve hashes.
  Compare these only with approved explicit availability/self-declarations. Missing,
  conflicting or additional restrictions remain review, without legal verification.
- Strict optional model assessments cannot override deterministic constraints.
  Bind private evaluations to owner/candidate, exact profile hash/version, job ID/
  revision and evaluator/prompt/model versions. Profile/source changes make current
  evaluations stale; do not rewrite history or place candidate scores in sharedJobs.
- Exercise the real local upload/correct/approve/match/export/delete journey with
  synthetic PDFs, server/rules owner isolation and adversarial input tests. Synthetic
  oracle cases do not establish the required human-reviewed 50-posting benchmark.

## Alternatives

A global profile, mutable approved facts or scores in shared jobs break ownership
and traceability. A new generic workflow framework is unnecessary for this pilot.

## Consequences and sources

This is a local emulator implementation, not production PDF sandboxing, Google
login, real-CV consent or proven model/benchmark quality. Real data remains outside
this task. Poppler CLI capabilities are reused; local installed version 26.09.0,
upstream 26.10.0 reviewed 2026-10-19: [official project](https://poppler.freedesktop.org/).
CI installs maintained distribution Poppler utilities alongside existing tooling.
