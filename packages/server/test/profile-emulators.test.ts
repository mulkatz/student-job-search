import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { once } from "node:events";
import { readFile } from "node:fs/promises";
import { createServer } from "node:http";
import test from "node:test";
import {
  assertFails,
  initializeTestEnvironment,
} from "@firebase/rules-unit-testing";
import { deleteApp as deleteClient, initializeApp } from "firebase/app";
import { connectAuthEmulator, getAuth, signInAnonymously } from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { getBytes, ref } from "firebase/storage";
import { deleteApp } from "firebase-admin/app";
import { apiHandler } from "../src/api.js";
import {
  createEmulatorServices,
  persistSharedJobs,
  projectId,
} from "../src/emulator.js";
import { profileViewSchema } from "../src/profile-schema.js";
import { matchingJob, syntheticPdf } from "./profile-fixtures.js";

test("actual owner-scoped PDF/profile/evaluation lifecycle uses Auth tokens and API-only Firestore/Storage", async () => {
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
  const clients = [
    initializeApp({ apiKey: "synthetic", projectId }, "profile-owner-a"),
    initializeApp({ apiKey: "synthetic", projectId }, "profile-owner-b"),
  ];
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
    for (const client of clients) {
      const auth = getAuth(client);
      connectAuthEmulator(auth, "http://127.0.0.1:9099", {
        disableWarnings: true,
      });
      const result = await signInAnonymously(auth);
      identities.push({
        uid: result.user.uid,
        token: await result.user.getIdToken(),
      });
    }
    const first = identities[0];
    const second = identities[1];
    assert.ok(first && second && first.uid !== second.uid);
    const send = (token: string, path: string, init: RequestInit = {}) =>
      fetch(`${url}${path}`, {
        ...init,
        headers: { ...init.headers, Authorization: `Bearer ${token}` },
      });
    const json = (value: unknown): RequestInit => ({
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(value),
    });
    const view = async (token: string) => {
      const response = await send(token, "/api/profile");
      assert.equal(response.status, 200);
      const payload: unknown = await response.json();
      assert.ok(
        typeof payload === "object" && payload !== null && "profile" in payload,
      );
      return profileViewSchema.parse(payload.profile);
    };
    for (const path of ["/api/profile", "/api/profile/export"])
      assert.equal((await fetch(`${url}${path}`)).status, 401);
    assert.equal(
      (
        await send(first.token, "/api/profile/upload", {
          method: "POST",
          headers: {
            "Content-Type": "text/plain",
            "X-Operation-Id": randomUUID(),
          },
          body: "not a PDF",
        })
      ).status,
      415,
    );
    const job = matchingJob(Date.now());
    await persistSharedJobs(services.firestore, [job]);
    const roundTrip = await services.dependencies.listJobs();
    assert.deepEqual(roundTrip, [job]);
    assert.equal(roundTrip[0]?.currentRevisionId, job.currentRevisionId);
    // Nested AND/OR arrays round-trip through a Firestore-compatible object wrapper.
    const storedJob = (
      await services.firestore.doc(`sharedJobs/${job.jobId}`).get()
    ).data();
    assert.ok(storedJob);
    const originalProjection = structuredClone(storedJob);
    await services.firestore.doc(`sharedJobs/${job.jobId}`).set({
      ...storedJob,
      observation: {
        ...job.observation,
        languageRequirements: {
          status: "complete",
          alternatives: [{ requirements: [] }],
          evidence: job.observation.title?.evidence,
        },
      },
    });
    await assert.rejects(services.dependencies.listJobs());
    await services.firestore.doc(`sharedJobs/${job.jobId}`).set({
      ...originalProjection,
      currentRevisionId: `rev_${"0".repeat(64)}`,
    });
    await assert.rejects(
      services.dependencies.listJobs(),
      /Invalid projection identity/,
    );
    await services.firestore
      .doc(`sharedJobs/${job.jobId}`)
      .set(originalProjection);
    const misplaced = services.firestore.doc(
      `sharedJobs/job_${"f".repeat(32)}`,
    );
    await misplaced.set(originalProjection);
    await assert.rejects(
      services.dependencies.listJobs(),
      /Invalid projection identity/,
    );
    await misplaced.delete();
    const operationId = randomUUID();
    const bytes = syntheticPdf();
    const upload = () =>
      send(first.token, "/api/profile/upload", {
        method: "POST",
        headers: {
          "Content-Type": "application/pdf",
          "X-Operation-Id": operationId,
        },
        body: new Uint8Array(bytes),
      });
    assert.equal((await upload()).status, 200);
    assert.equal((await upload()).status, 200);
    const firstView = await view(first.token);
    assert.equal(firstView.drafts.length, 1);
    assert.equal(firstView.drafts[0]?.facts.length, 6);
    assert.equal(firstView.versions.length, 0);
    assert.equal((await view(second.token)).lifecycle, "empty");
    assert.equal((await send(second.token, "/api/profile/export")).status, 409);
    assert.equal(
      (await send(first.token, `/api/users/${second.uid}/profile`)).status,
      404,
    );
    const draft = firstView.drafts[0];
    assert.ok(draft);
    const approval = {
      draftId: draft.id,
      expectedRevision: 0,
      expectedActiveVersionId: null,
      operationId: randomUUID(),
      confirmFacts: true,
    };
    assert.equal(
      (
        await send(first.token, "/api/profile/approve", {
          method: "POST",
          ...json({ ...approval, ownerId: second.uid }),
        })
      ).status,
      400,
    );
    assert.equal(
      (
        await send(first.token, "/api/profile/approve", {
          method: "POST",
          ...json(approval),
        })
      ).status,
      200,
    );
    assert.equal(
      (
        await send(first.token, "/api/profile/approve", {
          method: "POST",
          ...json(approval),
        })
      ).status,
      200,
    );
    const approved = await view(first.token);
    const version = approved.versions[0];
    assert.ok(version);
    assert.equal(approved.versions.length, 1);
    assert.equal(version.ownerId, first.uid);
    const match = () =>
      send(first.token, "/api/profile/evaluate", {
        method: "POST",
        ...json({ expectedActiveVersionId: version.id }),
      });
    assert.equal((await match()).status, 200);
    assert.equal((await match()).status, 200);
    const evaluated = await view(first.token);
    assert.equal(evaluated.evaluations.length, 1);
    assert.equal(evaluated.evaluations[0]?.eligibility, "eligible");
    assert.equal(evaluated.evaluations[0]?.fitScore, 100);
    assert.equal(
      (await services.firestore.doc(`sharedJobs/${job.jobId}`).get()).data()
        ?.fitScore,
      null,
    );
    const own = environment.authenticatedContext(first.uid);
    const other = environment.authenticatedContext(second.uid);
    const anonymous = environment.unauthenticatedContext();
    const statePath = `users/${first.uid}/profileState/current`;
    for (const context of [own, other, anonymous]) {
      await assertFails(getDoc(doc(context.firestore(), statePath)));
      await assertFails(setDoc(doc(context.firestore(), statePath), {}));
    }
    const [objects] = await services.storage
      .bucket()
      .getFiles({ prefix: `users/${first.uid}/g5/` });
    assert.equal(objects.length, 1);
    const object = objects[0];
    assert.ok(object);
    for (const context of [own, other, anonymous])
      await assertFails(
        getBytes(
          ref(context.storage(`gs://${projectId}.appspot.com`), object.name),
        ),
      );
    const exportedResponse = await send(first.token, "/api/profile/export");
    assert.equal(exportedResponse.status, 200);
    const exported: unknown = await exportedResponse.json();
    assert.ok(
      typeof exported === "object" &&
        exported !== null &&
        "files" in exported &&
        Array.isArray(exported.files),
    );
    const file: unknown = exported.files[0];
    assert.ok(
      typeof file === "object" &&
        file !== null &&
        "base64" in file &&
        typeof file.base64 === "string",
    );
    assert.deepEqual(Buffer.from(file.base64, "base64"), bytes);
    const nextFacts = draft.facts.map(({ id, category, value }) => ({
      id,
      category,
      value: category === "skill" ? "Data analysis" : value,
      ...(category === "skill"
        ? { attestation: "Explicit synthetic correction" }
        : {}),
    }));
    assert.equal(
      (
        await send(first.token, "/api/profile/draft", {
          method: "PATCH",
          ...json({ draftId: draft.id, expectedRevision: 0, facts: nextFacts }),
        })
      ).status,
      200,
    );
    assert.equal(
      (
        await send(first.token, "/api/profile/draft", {
          method: "PATCH",
          ...json({ draftId: draft.id, expectedRevision: 0, facts: nextFacts }),
        })
      ).status,
      409,
    );
    assert.equal(
      (
        await send(first.token, "/api/profile/approve", {
          method: "POST",
          ...json({
            ...approval,
            operationId: randomUUID(),
            expectedRevision: 1,
            expectedActiveVersionId: version.id,
          }),
        })
      ).status,
      200,
    );
    const changed = await view(first.token);
    assert.equal(changed.versions.length, 2);
    assert.equal(changed.versions[0]?.profileHash, version.profileHash);
    assert.equal(changed.evaluations[0]?.stale, true);
    await services.auth.updateUser(first.uid, { disabled: true });
    assert.equal((await send(first.token, "/api/profile")).status, 401);
    await services.auth.updateUser(first.uid, { disabled: false });
    assert.equal(
      (await send(first.token, "/api/profile", { method: "DELETE" })).status,
      200,
    );
    const deleted = await view(first.token);
    assert.equal(deleted.lifecycle, "deleted");
    assert.equal(deleted.versions.length, 0);
    assert.equal(deleted.drafts.length, 0);
    assert.equal(deleted.evaluations.length, 0);
    assert.equal(
      (
        await services.storage
          .bucket()
          .getFiles({ prefix: `users/${first.uid}/g5/` })
      )[0].length,
      0,
    );
    assert.equal((await send(first.token, "/api/profile/export")).status, 410);
    assert.equal(
      (await send(first.token, "/api/demo/preferences", { method: "POST" }))
        .status,
      410,
    );
    assert.equal(
      (
        await services.firestore
          .doc(`users/${first.uid}/preferences/discovery`)
          .get()
      ).exists,
      false,
    );
    assert.equal((await view(second.token)).lifecycle, "empty");
  } finally {
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await Promise.all([
      environment.cleanup(),
      ...clients.map(deleteClient),
      deleteApp(services.app),
    ]);
  }
});
