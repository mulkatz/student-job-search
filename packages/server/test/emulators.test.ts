import assert from "node:assert/strict";
import { once } from "node:events";
import { readFile } from "node:fs/promises";
import { createServer } from "node:http";
import test from "node:test";
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
} from "@firebase/rules-unit-testing";
import {
  emptyState,
  ingestObservation,
  syntheticDiscoveryJob,
  syntheticObservation,
} from "@job-search/discovery";
import {
  deleteApp as deleteClient,
  initializeApp as initializeClient,
} from "firebase/app";
import { connectAuthEmulator, getAuth, signInAnonymously } from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { getBytes, ref, uploadBytes } from "firebase/storage";
import { deleteApp } from "firebase-admin/app";
import { apiHandler } from "../src/api.js";
import {
  cleanupExpiredProjections,
  createEmulatorServices,
  persistSharedJobs,
  projectId,
} from "../src/emulator.js";

// This suite is invoked only by the explicit local emulator gate, never a live provider.
test("real Auth token/API and Firestore/private Storage isolate two synthetic owners", async () => {
  const services = createEmulatorServices();
  const environment = await initializeTestEnvironment({
    projectId,
    firestore: {
      host: "127.0.0.1",
      port: 8080,
      rules: await readFile("../../firestore.rules", "utf8"),
    },
    storage: {
      host: "127.0.0.1",
      port: 9199,
      rules: await readFile("../../storage.rules", "utf8"),
    },
  });
  const clientA = initializeClient(
    { apiKey: "synthetic", projectId },
    "owner-a",
  );
  const clientB = initializeClient(
    { apiKey: "synthetic", projectId },
    "owner-b",
  );
  const server = createServer(apiHandler(services.dependencies));
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const url = `http://127.0.0.1:${address.port}`;
  try {
    await environment.clearFirestore();
    await environment.clearStorage();
    const identities = [];
    for (const client of [clientA, clientB]) {
      const auth = getAuth(client);
      connectAuthEmulator(auth, "http://127.0.0.1:9099", {
        disableWarnings: true,
      });
      const credential = await signInAnonymously(auth);
      identities.push({
        uid: credential.user.uid,
        token: await credential.user.getIdToken(),
      });
    }
    const first = identities[0];
    const second = identities[1];
    assert.ok(first && second && first.uid !== second.uid);
    for (const identity of identities) {
      const response = await fetch(`${url}/api/demo/preferences`, {
        method: "POST",
        headers: { Authorization: `Bearer ${identity.token}` },
      });
      assert.equal(response.status, 200);
      const data: unknown = await response.json();
      assert.deepEqual(data, {
        preferences: {
          ownerId: identity.uid,
          label: "Synthetic local preferences",
        },
      });
    }
    const now = Date.now();
    const liveJob = ingestObservation(
      emptyState(),
      syntheticObservation({
        observedAt: new Date(now).toISOString(),
        retentionUntil: new Date(now + 86_400_000).toISOString(),
      }),
    ).job;
    await persistSharedJobs(services.firestore, [liveJob]);
    const expiredJob = syntheticDiscoveryJob();
    expiredJob.jobId = "job_00000000000000000000000000000000";
    expiredJob.observation.observedAt = "2020-01-01T00:00:00.000Z";
    expiredJob.observation.retentionUntil = "2020-01-02T00:00:00.000Z";
    const expiredJobs = Array.from({ length: 101 }, (_, index) => ({
      ...expiredJob,
      jobId: `job_${index.toString(16).padStart(32, "0")}`,
    }));
    await persistSharedJobs(services.firestore, expiredJobs.slice(0, 100));
    await persistSharedJobs(services.firestore, expiredJobs.slice(100));
    const jobsResponse = await fetch(`${url}/api/jobs`, {
      headers: { Authorization: `Bearer ${first.token}` },
    });
    assert.equal(jobsResponse.status, 200);
    const jobsPayload: unknown = await jobsResponse.json();
    assert.ok(
      typeof jobsPayload === "object" &&
        jobsPayload !== null &&
        "jobs" in jobsPayload,
    );
    assert.ok(Array.isArray(jobsPayload.jobs));
    assert.equal(jobsPayload.jobs.length, 1);
    assert.equal(await cleanupExpiredProjections(services.firestore), 100);
    assert.equal(await cleanupExpiredProjections(services.firestore), 1);
    assert.equal(await cleanupExpiredProjections(services.firestore), 0);
    assert.equal(
      (await services.firestore.collection("sharedJobs").get()).size,
      1,
    );
    await services.firestore
      .doc(`users/${first.uid}/preferences/discovery`)
      .set({ ownerId: second.uid, label: "Synthetic local preferences" });
    assert.equal(
      (
        await fetch(`${url}/api/preferences`, {
          headers: { Authorization: `Bearer ${first.token}` },
        })
      ).status,
      503,
    );
    await services.firestore
      .doc(`users/${first.uid}/preferences/discovery`)
      .set({ ownerId: first.uid, label: "Synthetic local preferences" });
    const own = environment.authenticatedContext(first.uid);
    const other = environment.authenticatedContext(second.uid);
    const anonymous = environment.unauthenticatedContext();
    const ownPath = `users/${first.uid}/preferences/discovery`;
    await assertSucceeds(getDoc(doc(own.firestore(), ownPath)));
    await assertFails(getDoc(doc(other.firestore(), ownPath)));
    await assertFails(getDoc(doc(anonymous.firestore(), ownPath)));
    await assertFails(
      setDoc(doc(own.firestore(), ownPath), { ownerId: second.uid }),
    );
    const job = syntheticDiscoveryJob();
    await assertFails(getDoc(doc(own.firestore(), `sharedJobs/${job.jobId}`)));
    await assertFails(
      getDoc(doc(anonymous.firestore(), `sharedJobs/${job.jobId}`)),
    );
    await assertFails(
      setDoc(doc(own.firestore(), `sharedJobs/${job.jobId}`), job),
    );
    const objectPath = `users/${first.uid}/cvs/synthetic.txt`;
    await services.storage
      .bucket()
      .file(objectPath)
      .save("Synthetic storage isolation fixture", {
        contentType: "text/plain",
      });
    await assertFails(
      getBytes(ref(own.storage(`gs://${projectId}.appspot.com`), objectPath)),
    );
    await assertFails(
      getBytes(ref(other.storage(`gs://${projectId}.appspot.com`), objectPath)),
    );
    await assertFails(
      getBytes(
        ref(anonymous.storage(`gs://${projectId}.appspot.com`), objectPath),
      ),
    );
    await assertFails(
      uploadBytes(
        ref(own.storage(`gs://${projectId}.appspot.com`), objectPath),
        new Uint8Array([1]),
      ),
    );
    const payload = first.token.split(".")[1];
    assert.ok(payload);
    const decoded: unknown = JSON.parse(
      Buffer.from(payload, "base64url").toString(),
    );
    assert.ok(typeof decoded === "object" && decoded !== null);
    const expired = `${first.token.split(".")[0]}.${Buffer.from(JSON.stringify({ ...decoded, exp: 1 })).toString("base64url")}.`;
    for (const token of ["malformed", expired])
      assert.equal(
        (
          await fetch(`${url}/api/jobs`, {
            headers: { Authorization: `Bearer ${token}` },
          })
        ).status,
        401,
      );
    assert.equal((await fetch(`${url}/api/jobs`)).status, 401);
    await services.auth.updateUser(first.uid, { disabled: true });
    assert.equal(
      (
        await fetch(`${url}/api/jobs`, {
          headers: { Authorization: `Bearer ${first.token}` },
        })
      ).status,
      401,
    );
  } finally {
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await Promise.all([
      environment.cleanup(),
      deleteClient(clientA),
      deleteClient(clientB),
      deleteApp(services.app),
    ]);
  }
});
