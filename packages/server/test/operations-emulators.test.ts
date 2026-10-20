import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import {
  emptyState,
  ingestObservation,
  syntheticObservation,
} from "@job-search/discovery";
import { deleteApp } from "firebase-admin/app";
import {
  createEmulatorServices,
  encodeProfileState,
  persistSharedJobs,
} from "../src/emulator.js";
import { firestoreOperationsReader } from "../src/operations.js";
import {
  collectOperationsStatus,
  type OperationsReader,
} from "../src/operations-domain.js";
import type { ProfileState } from "../src/profile-schema.js";

test("real emulator status is read-only, reports lifecycle backlog, overflow, faults and recovery without private output", async () => {
  const services = createEmulatorServices();
  try {
    const now = Date.now();
    const sentinel = "SENSITIVE_OPERATIONS_OWNER_QUOTE_ADDRESS";
    const shared = await services.firestore.collection("sharedJobs").get();
    const privateSnapshots = await services.firestore
      .collectionGroup("profileState")
      .get();
    const cleanup = services.firestore.batch();
    for (const doc of [...shared.docs, ...privateSnapshots.docs])
      cleanup.delete(doc.ref);
    await cleanup.commit();
    const expired = ingestObservation(
      emptyState(),
      syntheticObservation({
        observedAt: new Date(now - 2 * 86400000).toISOString(),
        retentionUntil: new Date(now - 1).toISOString(),
      }),
    ).job;
    await persistSharedJobs(services.firestore, [expired]);
    const owner = "synthetic-operations-owner";
    const profile: ProfileState = {
      ownerId: owner,
      generation: randomUUID(),
      lifecycle: "deleting",
      revision: 1,
      activeVersionId: null,
      assets: [
        {
          id: randomUUID(),
          hash: "a".repeat(64),
          bytes: 1,
          status: "pending",
          pendingUntil: new Date(now - 1000).toISOString(),
          expiresAt: new Date(now + 86400000).toISOString(),
        },
      ],
      cleanupObjects: [{ id: randomUUID(), status: "uncertain" }],
      drafts: [],
      versions: [],
      evaluations: [],
      createdAt: new Date(now - 86400000).toISOString(),
      updatedAt: new Date(now - 1000).toISOString(),
      nextCleanupAt: new Date(now - 1000).toISOString(),
    };
    const profileRef = services.firestore.doc(
      `users/${owner}/profileState/current`,
    );
    await profileRef.set(encodeProfileState(profile));
    await services.firestore
      .doc("users/synthetic-invalid/profileState/current")
      .set({ ownerId: sentinel, facts: [sentinel], credential: sentinel });
    const beforeShared = await services.firestore
      .collection("sharedJobs")
      .get();
    const beforePrivate = await services.firestore
      .collectionGroup("profileState")
      .get();
    const reader = firestoreOperationsReader(services);
    const status = await collectOperationsStatus(reader, { now: () => now });
    assert.equal(status.counts.sharedScanned, 1);
    assert.equal(status.counts.privateScanned, 2);
    assert.equal(status.counts.expiredShared, 1);
    assert.equal(status.counts.pendingReconciliation, 2);
    assert.equal(status.counts.deletionInProgress, 1);
    assert.equal(status.counts.invalidPrivate, 1);
    assert.equal(status.status, "attention_required");
    assert.ok(!JSON.stringify(status).includes(sentinel));
    assert.ok(!JSON.stringify(status).includes(owner));
    const afterShared = await services.firestore.collection("sharedJobs").get();
    const afterPrivate = await services.firestore
      .collectionGroup("profileState")
      .get();
    assert.deepEqual(
      afterShared.docs.map((doc) => doc.data()),
      beforeShared.docs.map((doc) => doc.data()),
    );
    assert.deepEqual(
      afterPrivate.docs.map((doc) => doc.data()),
      beforePrivate.docs.map((doc) => doc.data()),
    );
    const fault: OperationsReader = {
      shared: async () => {
        throw new Error(sentinel);
      },
      private: reader.private,
    };
    const failed = await collectOperationsStatus(fault);
    assert.equal(failed.status, "unavailable");
    assert.ok(failed.alerts.includes("shared_scan_unavailable"));
    assert.ok(!JSON.stringify(failed).includes(sentinel));
    const recovered = await collectOperationsStatus(reader, { now: () => now });
    assert.deepEqual(recovered, status);
    const overflow = services.firestore.batch();
    for (let index = 0; index < 101; index++)
      overflow.set(
        services.firestore.doc(`sharedJobs/synthetic-overflow-${index}`),
        { marker: sentinel },
      );
    for (let index = 0; index < 25; index++)
      overflow.set(
        services.firestore.doc(
          `users/synthetic-overflow-${index}/profileState/current`,
        ),
        { marker: sentinel },
      );
    await overflow.commit();
    const limited = await collectOperationsStatus(reader);
    assert.equal(limited.completeness, "partial");
    assert.equal(limited.counts.sharedScanned, 100);
    assert.equal(limited.counts.privateScanned, 25);
    assert.ok(limited.alerts.includes("shared_scan_incomplete"));
    assert.ok(limited.alerts.includes("private_scan_incomplete"));
    assert.notEqual(limited.status, "clear_in_scanned_records");
    assert.ok(!JSON.stringify(limited).includes(sentinel));
    const allShared = await services.firestore.collection("sharedJobs").get();
    const allPrivate = await services.firestore
      .collectionGroup("profileState")
      .get();
    const drain = services.firestore.batch();
    for (const doc of [...allShared.docs, ...allPrivate.docs])
      drain.delete(doc.ref);
    await drain.commit();
    assert.equal(
      (await collectOperationsStatus(reader)).status,
      "clear_in_scanned_records",
    );
    const cli = await promisify(execFile)(
      process.execPath,
      [fileURLToPath(new URL("../src/operations.js", import.meta.url))],
      { timeout: 9000, maxBuffer: 16384 },
    );
    const cliOutput: unknown = JSON.parse(cli.stdout);
    assert.equal(typeof cliOutput, "object");
    assert.match(cli.stdout, /clear_in_scanned_records/);
    assert.ok(!cli.stdout.includes(sentinel));
  } finally {
    await services.firestore.terminate();
    await deleteApp(services.app);
  }
});
