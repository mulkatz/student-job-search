import { z } from "zod";

export const operationsPolicy = {
  maximumSharedRecords: 100,
  maximumPrivateRecords: 25,
  deadlineMs: 5000,
} as const;
export const operationsAlertCodeSchema = z.enum([
  "shared_source_unavailable",
  "shared_scan_incomplete",
  "private_scan_incomplete",
  "shared_scan_unavailable",
  "private_scan_unavailable",
  "status_deadline_exceeded",
  "shared_record_invalid",
  "private_record_invalid",
  "shared_expiry_due",
  "source_review_expired",
  "private_cleanup_due",
  "private_expiry_due",
  "private_reconciliation_required",
  "private_deletion_in_progress",
]);
export type OperationsAlertCode = z.infer<typeof operationsAlertCodeSchema>;
const count = z.number().int().nonnegative();
export const operationsStatusSchema = z.strictObject({
  format: z.literal("job-search-local-operations-v1"),
  observedAt: z.iso.datetime({ offset: true }),
  scope: z.literal("local_emulator_records_only"),
  completeness: z.enum(["complete", "partial", "unavailable"]),
  status: z.enum([
    "clear_in_scanned_records",
    "attention_required",
    "unavailable",
  ]),
  counts: z.strictObject({
    sharedScanned: count.max(100),
    privateScanned: count.max(25),
    unavailableShared: count,
    invalidShared: count,
    invalidPrivate: count,
    expiredShared: count,
    expiredSourceReviews: count,
    duePrivateCleanup: count,
    expiredPrivateEntries: count,
    pendingReconciliation: count,
    deletionInProgress: count,
  }),
  alerts: z.array(operationsAlertCodeSchema).max(14),
  limitation: z.literal(
    "Bounded tracked records only; not storage reconciliation, source/model health, production monitoring, or release evidence.",
  ),
});
export type OperationsStatus = z.infer<typeof operationsStatusSchema>;
