# 0019: bounded private profile data lifecycle

- Status: accepted
- Date: 2026-10-19
- Extends: [ADR 0018](0018-owner-private-profiles-and-evaluations.md)

## Context

Private CVs, extracted text, approved facts and evaluations need minimization,
ownership, retention, export and deletion before real applicant processing.
Concurrent uploads must not recreate data after an owner deletion.

## Decision

- Limit raw PDFs and unapproved drafts to seven days from creation. Approved fact
  versions expire after 90 days; renewed use requires a new explicit approval/version,
  not silent mutation of old evidence. Raw expiry does not renew on editing/replay.
- Evaluation expiry is no later than seven days, its source observation and approved
  profile expiry. Hide expired/private-deleted data immediately on every API read;
  enforce the same boundary on export, approval, evaluation and storage operations.
- Define strict local capacities and encoded document-size limits. Raw PDFs live
  separately in private Storage. Do not retain applicant facts in telemetry, shared
  jobs, provider search queries or error bodies. No real CV/model dispatch is enabled
  merely by implementing this local lifecycle.
- Register bounded upload reservations before Storage writes. Server-generated asset
  paths include a lifecycle generation. Finalization checks active lifecycle and
  generation; compensate by deleting an object if deletion won the race.
- Delete through a tombstone first: deny private reads/new work immediately, then
  sweep tracked documents/objects in bounded idempotent batches. Do not report full
  physical completion while a pending uploader can still publish. Cleanup marks
  unresolved reservations uncertain and retains markers; physical reconciliation
  requires terminal-write evidence. Remove other expired private records/objects.
- Tombstones remove facts immediately. Ambiguous upload markers remain minimal and
  fail closed; elapsed time alone cannot prove a writer has terminated. Retain the
  deletion boundary until terminal-write evidence supports physical reconciliation.
- Provide owner-authenticated export of retained assets, drafts, approved versions,
  evidence, private evaluations and applicable preferences; never another owner's
  data. Exported bytes inherit retention and remain the user's private copy.
- Direct SDK access to G5 state/assets is denied; API expiry/deletion cannot be
  bypassed through a broad owner read rule. Check persisted owner/candidate scope
  even though the Admin SDK bypasses Firebase rules.
- Test expired data, two owners, unauthenticated access, stale approval, interrupted
  upload/deletion races, idempotent cleanup and preserved immutable versions.

## Alternatives

Indefinite retention and merely hiding data in the UI are insufficient. A background
cloud cleanup schedule or multi-user administration adds unauthorized infrastructure.

## Consequences

The operator runs bounded cleanup locally; no unattended lifecycle is installed.
Deletion covers the operated emulator state/Storage, not backups or deployments
that this task does not operate. Synthetic browser/API evidence does not establish
production privacy compliance, applicant consent or universal safe PDF parsing.
