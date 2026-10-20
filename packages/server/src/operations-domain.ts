import { decodeProfileState, decodeSharedJob } from "./emulator.js";
import {
  type OperationsAlertCode,
  type OperationsStatus,
  operationsPolicy,
  operationsStatusSchema,
} from "./operations-schema.js";

export interface OperationsRow {
  id: string;
  path: string;
  data: unknown;
}
export interface OperationsReader {
  shared(limit: number, signal: AbortSignal): Promise<readonly OperationsRow[]>;
  private(
    limit: number,
    signal: AbortSignal,
  ): Promise<readonly OperationsRow[]>;
}
const limitation =
  "Bounded tracked records only; not storage reconciliation, source/model health, production monitoring, or release evidence." as const;
/** No identifiers, source/private values or caught error strings enter this aggregate projection. */
export async function collectOperationsStatus(
  reader: OperationsReader,
  options: { now?: () => number; deadlineMs?: number } = {},
): Promise<OperationsStatus> {
  const now = options.now ?? Date.now;
  const deadlineMs = options.deadlineMs ?? operationsPolicy.deadlineMs;
  if (
    !Number.isInteger(deadlineMs) ||
    deadlineMs < 1 ||
    deadlineMs > operationsPolicy.deadlineMs
  )
    throw new Error("operations_configuration_invalid");
  const observedAt = now();
  const controller = new AbortController();
  const deadline = performance.now() + deadlineMs;
  const checkDeadline = () => {
    if (controller.signal.aborted || performance.now() >= deadline) {
      controller.abort();
      throw new Error("deadline");
    }
  };
  const timer = setTimeout(() => controller.abort(), deadlineMs);
  const alerts = new Set<OperationsAlertCode>();
  const counts = {
    sharedScanned: 0,
    privateScanned: 0,
    unavailableShared: 0,
    invalidShared: 0,
    invalidPrivate: 0,
    expiredShared: 0,
    expiredSourceReviews: 0,
    duePrivateCleanup: 0,
    expiredPrivateEntries: 0,
    pendingReconciliation: 0,
    deletionInProgress: 0,
  };
  let incomplete = false;
  let unavailable = false;
  const scan = async (kind: "shared" | "private", maximum: number) => {
    let abort: () => void = () => {};
    const expired = new Promise<never>((_resolve, reject) => {
      abort = () => reject(new Error("deadline"));
      controller.signal.addEventListener("abort", abort, { once: true });
    });
    try {
      checkDeadline();
      const rows = await Promise.race([
        reader[kind](maximum + 1, controller.signal),
        expired,
      ]);
      if (!Array.isArray(rows) || rows.length > maximum + 1)
        throw new Error("scan_contract_invalid");
      if (rows.length > maximum) {
        incomplete = true;
        alerts.add(
          kind === "shared"
            ? "shared_scan_incomplete"
            : "private_scan_incomplete",
        );
      }
      for (const row of rows.slice(0, maximum)) {
        checkDeadline();
        if (kind === "shared") {
          counts.sharedScanned += 1;
          try {
            if (row.path !== `sharedJobs/${row.id}`) throw new Error("path");
            const job = decodeSharedJob(row.data, row.id, observedAt);
            if (job.observation.kind === "unavailable")
              counts.unavailableShared += 1;
            if (Date.parse(job.observation.retentionUntil) <= observedAt)
              counts.expiredShared += 1;
            if (
              job.observation.applicationSource &&
              Date.parse(job.observation.applicationSource.review.expiresAt) <=
                observedAt
            )
              counts.expiredSourceReviews += 1;
          } catch {
            counts.invalidShared += 1;
          }
        } else {
          counts.privateScanned += 1;
          try {
            const owner =
              /^users\/([A-Za-z0-9_-]{1,128})\/profileState\/current$/.exec(
                row.path,
              )?.[1];
            if (!owner || row.id !== "current") throw new Error("path");
            const state = decodeProfileState(row.data, owner);
            if (
              state.lifecycle === "deleted" &&
              (state.assets.length ||
                state.drafts.length ||
                state.versions.length ||
                state.evaluations.length ||
                state.cleanupObjects.length ||
                state.applications?.length)
            )
              throw new Error("deleted_data");
            const expiredEntry = (value: { expiresAt: string }) =>
              Date.parse(value.expiresAt) <= observedAt;
            const expired = [
              ...state.assets,
              ...state.drafts,
              ...state.versions,
              ...state.evaluations,
              ...(state.applications ?? []).flatMap((record) => [
                record,
                ...record.packages,
                ...record.attempts,
              ]),
            ].filter(expiredEntry).length;
            counts.expiredPrivateEntries += expired;
            const reconciliation =
              state.assets.filter(
                (asset) =>
                  asset.status === "uncertain" ||
                  (asset.status === "pending" &&
                    Date.parse(asset.pendingUntil) <= observedAt),
              ).length +
              state.cleanupObjects.filter(
                (marker) =>
                  marker.status === "pending" || marker.status === "uncertain",
              ).length;
            counts.pendingReconciliation += reconciliation;
            if (state.lifecycle === "deleting") counts.deletionInProgress += 1;
            if (
              (state.nextCleanupAt !== null &&
                Date.parse(state.nextCleanupAt) <= observedAt) ||
              expired ||
              reconciliation ||
              state.cleanupObjects.length ||
              state.lifecycle === "deleting"
            )
              counts.duePrivateCleanup += 1;
          } catch {
            counts.invalidPrivate += 1;
          }
        }
      }
      checkDeadline();
    } catch {
      unavailable = true;
      alerts.add(
        kind === "shared"
          ? "shared_scan_unavailable"
          : "private_scan_unavailable",
      );
      if (controller.signal.aborted) alerts.add("status_deadline_exceeded");
    } finally {
      controller.signal.removeEventListener("abort", abort);
    }
  };
  try {
    await Promise.all([
      scan("shared", operationsPolicy.maximumSharedRecords),
      scan("private", operationsPolicy.maximumPrivateRecords),
    ]);
  } finally {
    clearTimeout(timer);
    controller.abort();
  }
  if (counts.unavailableShared) alerts.add("shared_source_unavailable");
  if (counts.invalidShared) alerts.add("shared_record_invalid");
  if (counts.invalidPrivate) alerts.add("private_record_invalid");
  if (counts.expiredShared) alerts.add("shared_expiry_due");
  if (counts.expiredSourceReviews) alerts.add("source_review_expired");
  if (counts.duePrivateCleanup) alerts.add("private_cleanup_due");
  if (counts.expiredPrivateEntries) alerts.add("private_expiry_due");
  if (counts.pendingReconciliation)
    alerts.add("private_reconciliation_required");
  if (counts.deletionInProgress) alerts.add("private_deletion_in_progress");
  return operationsStatusSchema.parse({
    format: "job-search-local-operations-v1",
    observedAt: new Date(observedAt).toISOString(),
    scope: "local_emulator_records_only",
    completeness: unavailable
      ? "unavailable"
      : incomplete
        ? "partial"
        : "complete",
    status: unavailable
      ? "unavailable"
      : alerts.size
        ? "attention_required"
        : "clear_in_scanned_records",
    counts,
    alerts: [...alerts].sort(),
    limitation,
  });
}
