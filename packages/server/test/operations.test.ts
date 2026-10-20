import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { once } from "node:events";
import { createServer, type Socket } from "node:net";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  emptyState,
  ingestObservation,
  syntheticObservation,
} from "@job-search/discovery";
import { operationsCommand } from "../src/operations.js";
import {
  collectOperationsStatus,
  type OperationsReader,
  type OperationsRow,
} from "../src/operations-domain.js";
import {
  operationsPolicy,
  operationsStatusSchema,
} from "../src/operations-schema.js";
import type { ProfileState } from "../src/profile-schema.js";
import { fixtureNow } from "./profile-fixtures.js";

function profile(overrides: Partial<ProfileState> = {}): ProfileState {
  return {
    ownerId: "synthetic-operator-owner",
    generation: randomUUID(),
    lifecycle: "active",
    revision: 0,
    activeVersionId: null,
    assets: [],
    cleanupObjects: [],
    drafts: [],
    versions: [],
    evaluations: [],
    createdAt: new Date(fixtureNow - 86400000).toISOString(),
    updatedAt: new Date(fixtureNow - 86400000).toISOString(),
    nextCleanupAt: new Date(fixtureNow + 86400000).toISOString(),
    ...overrides,
  };
}
function privateRow(state: ProfileState): OperationsRow {
  return {
    id: "current",
    path: `users/${state.ownerId}/profileState/current`,
    data: state,
  };
}
function sharedRow(expired = false, unavailable = false): OperationsRow {
  const observation = syntheticObservation({
    observedAt: new Date(fixtureNow - 2 * 86400000).toISOString(),
    retentionUntil: new Date(
      fixtureNow + (expired ? -1 : 1) * 86400000,
    ).toISOString(),
    ...(unavailable
      ? {
          kind: "unavailable",
          title: null,
          employer: null,
          location: null,
          employmentType: null,
          englishAccepted: { status: "unknown" },
          applicationLinks: [],
        }
      : {}),
  });
  const job = ingestObservation(emptyState(), observation).job;
  return {
    id: job.jobId,
    path: `sharedJobs/${job.jobId}`,
    data: {
      ...job,
      retentionUntilEpochMs: Date.parse(observation.retentionUntil),
    },
  };
}
const reader = (
  shared: readonly OperationsRow[] = [],
  privateRows: readonly OperationsRow[] = [],
): OperationsReader => ({
  shared: async () => shared,
  private: async () => privateRows,
});

test("local status validates retained records and reports aggregate expiry, due cleanup, source failure and reconciliation without mutation", async () => {
  const state = profile({
    assets: [
      {
        id: randomUUID(),
        hash: "a".repeat(64),
        bytes: 1,
        status: "pending",
        pendingUntil: new Date(fixtureNow - 1000).toISOString(),
        expiresAt: new Date(fixtureNow + 86400000).toISOString(),
      },
    ],
    cleanupObjects: [{ id: randomUUID(), status: "uncertain" }],
    lifecycle: "deleting",
  });
  const rows = [sharedRow(true, true)];
  const privateRows = [privateRow(state)];
  const before = structuredClone({ rows, privateRows });
  const status = await collectOperationsStatus(reader(rows, privateRows), {
    now: () => fixtureNow,
  });
  assert.equal(status.completeness, "complete");
  assert.equal(status.status, "attention_required");
  assert.equal(status.counts.expiredShared, 1);
  assert.equal(status.counts.unavailableShared, 1);
  assert.equal(status.counts.pendingReconciliation, 2);
  assert.equal(status.counts.deletionInProgress, 1);
  assert.equal(status.counts.duePrivateCleanup, 1);
  assert.ok(status.alerts.includes("shared_source_unavailable"));
  assert.ok(status.alerts.includes("private_reconciliation_required"));
  assert.deepEqual({ rows, privateRows }, before);
  operationsStatusSchema.parse(status);
});

test("bounded scans request limit plus one and cannot report a partial set as clear", async () => {
  const requested: number[] = [];
  const status = await collectOperationsStatus(
    {
      shared: async (limit) => {
        requested.push(limit);
        return Array.from({ length: limit }, () => sharedRow());
      },
      private: async (limit) => {
        requested.push(limit);
        return Array.from({ length: limit }, () => privateRow(profile()));
      },
    },
    { now: () => fixtureNow },
  );
  assert.deepEqual(requested, [101, 26]);
  assert.equal(status.completeness, "partial");
  assert.equal(status.status, "attention_required");
  assert.equal(status.counts.sharedScanned, 100);
  assert.equal(status.counts.privateScanned, 25);
  assert.deepEqual(status.alerts, [
    "private_scan_incomplete",
    "shared_scan_incomplete",
  ]);
});

test("malformed paths, identities and private payloads yield fixed invalid alerts without reflecting sensitive sentinels", async () => {
  const sentinel = "SENSITIVE_OWNER_FACT_RECIPIENT_https://sensitive.invalid";
  const invalidShared = {
    id: sentinel,
    path: `sharedJobs/${sentinel}`,
    data: { sentinel },
  };
  const invalidPrivate = {
    id: "current",
    path: "users/synthetic-owner/profileState/current",
    data: { ownerId: sentinel, facts: [sentinel], credential: sentinel },
  };
  const status = await collectOperationsStatus(
    reader([invalidShared], [invalidPrivate]),
    { now: () => fixtureNow },
  );
  assert.equal(status.counts.invalidShared, 1);
  assert.equal(status.counts.invalidPrivate, 1);
  assert.equal(status.status, "attention_required");
  assert.ok(!JSON.stringify(status).includes(sentinel));
  const wrongPath = await collectOperationsStatus(
    reader(
      [],
      [
        {
          ...privateRow(profile()),
          path: "users/other-owner/profileState/not-current",
        },
      ],
    ),
    { now: () => fixtureNow },
  );
  assert.equal(wrongPath.counts.invalidPrivate, 1);
});

test("expired private assets and due settled deletion markers are visible, while fresh pending uploads do not require reconciliation", async () => {
  const expired = profile({
    assets: [
      {
        id: randomUUID(),
        hash: "a".repeat(64),
        bytes: 1,
        status: "ready",
        pendingUntil: new Date(fixtureNow - 2 * 86400000).toISOString(),
        expiresAt: new Date(fixtureNow - 1).toISOString(),
      },
    ],
  });
  const settled = profile({
    cleanupObjects: [{ id: randomUUID(), status: "settled" }],
  });
  const fresh = profile({
    assets: [
      {
        id: randomUUID(),
        hash: "a".repeat(64),
        bytes: 1,
        status: "pending",
        pendingUntil: new Date(fixtureNow + 1000).toISOString(),
        expiresAt: new Date(fixtureNow + 86400000).toISOString(),
      },
    ],
  });
  const status = await collectOperationsStatus(
    reader([], [privateRow(expired), privateRow(settled), privateRow(fresh)]),
    { now: () => fixtureNow },
  );
  assert.equal(status.counts.expiredPrivateEntries, 1);
  assert.equal(status.counts.duePrivateCleanup, 2);
  assert.equal(status.counts.pendingReconciliation, 0);
  assert.ok(status.alerts.includes("private_expiry_due"));
});

test("scan faults and deadline expiry are sanitized, abort outstanding reads and recover with a fresh invocation", async () => {
  let aborted = false;
  const status = await collectOperationsStatus(
    {
      shared: async () => {
        throw new Error("SENSITIVE_TRANSPORT_PROJECT_OWNER");
      },
      private: async (_limit, signal) =>
        new Promise((resolve) => {
          signal.addEventListener(
            "abort",
            () => {
              aborted = true;
              resolve([]);
            },
            { once: true },
          );
        }),
    },
    { deadlineMs: 10, now: () => fixtureNow },
  );
  assert.equal(status.completeness, "unavailable");
  assert.equal(status.status, "unavailable");
  assert.ok(status.alerts.includes("shared_scan_unavailable"));
  assert.ok(status.alerts.includes("private_scan_unavailable"));
  assert.ok(status.alerts.includes("status_deadline_exceeded"));
  assert.ok(aborted);
  assert.ok(!JSON.stringify(status).includes("SENSITIVE"));
  const recovered = await collectOperationsStatus(reader(), {
    now: () => fixtureNow,
  });
  assert.equal(recovered.status, "clear_in_scanned_records");
  assert.deepEqual(recovered.alerts, []);
  await assert.rejects(
    collectOperationsStatus(reader(), {
      deadlineMs: operationsPolicy.deadlineMs + 1,
    }),
  );
});

test("operator CLI rejects non-emulator configuration with sanitized aggregate-only output", async () => {
  const previous = process.env.FIRESTORE_EMULATOR_HOST;
  process.env.FIRESTORE_EMULATOR_HOST = "SENSITIVE_NONLOCAL_CONFIGURATION";
  const output: unknown[] = [];
  try {
    assert.equal(
      await operationsCommand((value) => {
        output.push(value);
      }),
      2,
    );
  } finally {
    if (previous === undefined) delete process.env.FIRESTORE_EMULATOR_HOST;
    else process.env.FIRESTORE_EMULATOR_HOST = previous;
  }
  assert.deepEqual(output, [
    {
      error: "operations_status_unavailable",
      scope: "local_emulator_records_only",
    },
  ]);
});

test("operator CLI naturally exits after a nonresponsive loopback transport and its bounded shutdown", async (context) => {
  const sockets = new Set<Socket>();
  const transport = createServer((socket) => {
    sockets.add(socket);
    socket.on("close", () => sockets.delete(socket));
  });
  try {
    await new Promise<void>((resolve, reject) => {
      transport.once("error", reject);
      transport.listen(8080, "127.0.0.1", () => resolve());
    });
  } catch (error) {
    transport.close();
    if (
      error instanceof Error &&
      "code" in error &&
      error.code === "EADDRINUSE"
    ) {
      context.skip(
        "The transport fault drill requires the isolated verify phase before emulators start.",
      );
      return;
    }
    throw error;
  }
  const child = spawn(
    process.execPath,
    [fileURLToPath(new URL("../src/operations.js", import.meta.url))],
    {
      env: {
        ...process.env,
        FIREBASE_AUTH_EMULATOR_HOST: "127.0.0.1:9099",
        FIRESTORE_EMULATOR_HOST: "127.0.0.1:8080",
        FIREBASE_STORAGE_EMULATOR_HOST: "127.0.0.1:9199",
        STORAGE_EMULATOR_HOST: "http://127.0.0.1:9199",
      },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  let stdout = "";
  let stderr = "";
  child.stdout.on("data", (bytes: Buffer) => {
    stdout += bytes.toString("utf8");
  });
  child.stderr.on("data", (bytes: Buffer) => {
    stderr += bytes.toString("utf8");
  });
  let timedOut = false;
  const started = Date.now();
  const timer = setTimeout(() => {
    timedOut = true;
    child.kill("SIGKILL");
  }, 9000);
  try {
    const [code, signal] = await once(child, "exit");
    assert.equal(timedOut, false);
    assert.equal(signal, null);
    assert.equal(code, 2);
    assert.ok(Date.now() - started < 8500);
    assert.match(stdout, /status_deadline_exceeded/);
    assert.ok(!stderr.includes("users/") && !stderr.includes("sharedJobs/"));
  } finally {
    clearTimeout(timer);
    if (child.exitCode === null && child.signalCode === null)
      child.kill("SIGKILL");
    for (const socket of sockets) socket.destroy();
    await new Promise<void>((resolve) => transport.close(() => resolve()));
  }
});

test("deadline also rejects an overrun during synchronous record validation", async () => {
  const value = sharedRow();
  const delayed: OperationsRow = {
    id: value.id,
    path: value.path,
    get data() {
      const until = performance.now() + 20;
      while (performance.now() < until) {
        /* Simulated bounded decode work holds the event loop. */
      }
      return value.data;
    },
  };
  const status = await collectOperationsStatus(reader([delayed]), {
    now: () => fixtureNow,
    deadlineMs: 10,
  });
  assert.equal(status.status, "unavailable");
  assert.ok(status.alerts.includes("status_deadline_exceeded"));
});
