import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { once } from "node:events";
import { createServer } from "node:http";
import test from "node:test";
import { revisionIdentity } from "@job-search/discovery";
import { deleteApp as deleteClient, initializeApp } from "firebase/app";
import { connectAuthEmulator, getAuth, signInAnonymously } from "firebase/auth";
import { deleteApp } from "firebase-admin/app";
import { apiHandler } from "../src/api.js";
import { applicationSourcePayloadHash } from "../src/application-domain.js";
import { applicationFixtureJobs } from "../src/application-fixtures.js";
import { applicationsResponseSchema } from "../src/application-schema.js";
import {
  createEmulatorServices,
  decodeProfileState,
  persistSharedJobs,
  projectId,
} from "../src/emulator.js";
import { profileViewSchema } from "../src/profile-schema.js";
import { syntheticPdf } from "./profile-fixtures.js";

test("authenticated application API persists five immutable package snapshots, exact copy reviews, owner isolation and deletion", async () => {
  const services = createEmulatorServices();
  const server = createServer(apiHandler(services.dependencies));
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const base = `http://127.0.0.1:${address.port}`;
  const clients = [
    initializeApp({ apiKey: "synthetic", projectId }, "applications-a"),
    initializeApp({ apiKey: "synthetic", projectId }, "applications-b"),
  ];
  try {
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
    assert.ok(first && second);
    const send = (
      token: string,
      path: string,
      method = "GET",
      input?: unknown,
    ) =>
      fetch(`${base}${path}`, {
        method,
        headers: {
          Authorization: `Bearer ${token}`,
          ...(input === undefined
            ? {}
            : { "Content-Type": "application/json" }),
        },
        ...(input === undefined ? {} : { body: JSON.stringify(input) }),
      });
    const apps = async (token = first.token) => {
      const response = await send(token, "/api/applications");
      assert.equal(response.status, 200);
      return applicationsResponseSchema.parse(await response.json());
    };
    assert.equal((await fetch(`${base}/api/applications`)).status, 401);
    assert.equal(
      (await send("expired-token", "/api/applications")).status,
      401,
    );
    const jobs = applicationFixtureJobs(Date.now());
    await persistSharedJobs(services.firestore, jobs);
    const initial = jobs[0];
    assert.ok(initial);
    const statusInput = {
      jobId: initial.jobId,
      expectedRevision: 0,
      operationId: randomUUID(),
      status: "ignored",
    };
    assert.equal(
      (
        await send(
          first.token,
          "/api/applications/status",
          "PATCH",
          statusInput,
        )
      ).status,
      200,
    );
    assert.equal((await apps()).applications[0]?.packages.length, 0);
    const uploadId = randomUUID();
    assert.equal(
      (
        await fetch(`${base}/api/profile/upload`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${first.token}`,
            "Content-Type": "application/pdf",
            "X-Operation-Id": uploadId,
          },
          body: new Uint8Array(syntheticPdf()),
        })
      ).status,
      200,
    );
    assert.equal(
      (
        await send(first.token, "/api/profile/approve", "POST", {
          draftId: uploadId,
          expectedRevision: 0,
          expectedActiveVersionId: null,
          operationId: randomUUID(),
          confirmFacts: true,
        })
      ).status,
      200,
    );
    const profileResponse = await send(first.token, "/api/profile");
    const profilePayload: unknown = await profileResponse.json();
    assert.ok(
      typeof profilePayload === "object" &&
        profilePayload !== null &&
        "profile" in profilePayload,
    );
    const profile = profileViewSchema.parse(profilePayload.profile);
    assert.ok(profile.activeVersionId);
    assert.equal(
      (
        await send(first.token, "/api/profile/evaluate", "POST", {
          expectedActiveVersionId: profile.activeVersionId,
        })
      ).status,
      200,
    );
    for (const job of jobs) {
      const before = (await apps()).applications.find(
        (record) => record.jobId === job.jobId,
      );
      const input: {
        jobId: string;
        expectedJobRevisionId: string;
        expectedActiveVersionId: string;
        expectedCurrentPackageId: string | null;
        operationId: string;
      } = {
        jobId: job.jobId,
        expectedJobRevisionId: job.currentRevisionId,
        expectedActiveVersionId: profile.activeVersionId,
        expectedCurrentPackageId: before?.currentPackageId ?? null,
        operationId: randomUUID(),
      };
      assert.equal(
        (
          await send(first.token, "/api/applications/generate", "POST", {
            ...input,
            recipient: "forged@synthetic.example",
          })
        ).status,
        400,
      );
      const response = await send(
        first.token,
        "/api/applications/generate",
        "POST",
        input,
      );
      assert.equal(response.status, 200);
      const generated = applicationsResponseSchema.parse(await response.json());
      const record = generated.applications.find(
        (record) => record.jobId === job.jobId,
      );
      const pkg = record?.packages.find(
        (pkg) => pkg.id === record.currentPackageId,
      );
      assert.ok(record && pkg);
      assert.equal(
        (await send(first.token, "/api/applications/generate", "POST", input))
          .status,
        200,
      );
      const fieldId =
        pkg.content.kind === "email"
          ? "body"
          : pkg.content.fields[0]?.internalId;
      assert.ok(fieldId);
      const copy = {
        applicationId: record.id,
        packageId: pkg.id,
        expectedContentHash: pkg.contentHash,
        fieldId,
      };
      assert.equal(
        (await send(first.token, "/api/applications/copy", "POST", copy))
          .status,
        409,
      );
      assert.equal(
        (await send(second.token, "/api/applications/copy", "POST", copy))
          .status,
        409,
      );
      assert.equal(
        (
          await send(first.token, "/api/applications/review", "POST", {
            applicationId: record.id,
            packageId: pkg.id,
            expectedContentHash: pkg.contentHash,
            operationId: randomUUID(),
            confirmReviewed: true,
          })
        ).status,
        200,
      );
      const copied = await send(
        first.token,
        "/api/applications/copy",
        "POST",
        copy,
      );
      assert.equal(copied.status, 200);
      const copiedPayload: unknown = await copied.json();
      assert.ok(
        typeof copiedPayload === "object" &&
          copiedPayload !== null &&
          "text" in copiedPayload,
      );
      assert.equal(
        copiedPayload.text,
        pkg.content.kind === "email"
          ? pkg.content.body
          : pkg.content.fields[0]?.answer,
      );
    }
    assert.equal((await apps()).applications.length, 5);
    assert.deepEqual((await apps(second.token)).applications, []);
    const stored = (
      await services.firestore
        .doc(`users/${first.uid}/profileState/current`)
        .get()
    ).data();
    const state = decodeProfileState(stored, first.uid);
    assert.equal(
      state.applications?.flatMap((record) => record.packages).length,
      5,
    );
    assert.ok(
      state.applications?.every(
        (record) =>
          record.packages[0]?.jobSnapshot.observation.languageRequirements
            ?.status === "complete",
      ),
    );
    const exported = await send(first.token, "/api/profile/export");
    assert.equal(exported.status, 200);
    const ownerExport: unknown = await exported.json();
    assert.ok(
      typeof ownerExport === "object" &&
        ownerExport !== null &&
        "profile" in ownerExport,
    );
    assert.equal(
      JSON.stringify(ownerExport.profile).includes("application-case-5"),
      true,
    );
    assert.equal(
      (await send(first.token, "/api/profile", "DELETE")).status,
      200,
    );
    assert.deepEqual((await apps()).applications, []);
    assert.equal(
      (
        await send(first.token, "/api/applications/status", "PATCH", {
          ...statusInput,
          operationId: randomUUID(),
        })
      ).status,
      410,
    );
  } finally {
    server.close();
    await once(server, "close");
    for (const client of clients) await deleteClient(client);
    await deleteApp(services.app);
  }
});

test("expired source review is ordinary stale metadata and does not poison retained shared jobs", async () => {
  const services = createEmulatorServices();
  try {
    const now = Date.now();
    const job = applicationFixtureJobs(now)[0];
    assert.ok(job?.observation.applicationSource);
    await persistSharedJobs(services.firestore, [job]);
    const ref = services.firestore.doc(`sharedJobs/${job.jobId}`);
    const stored = (await ref.get()).data();
    assert.ok(stored);
    job.observation.observedAt = new Date(now - 4 * 86400000).toISOString();
    job.observation.retentionUntil = new Date(now + 2 * 86400000).toISOString();
    job.observation.applicationSource.review.reviewedAt = new Date(
      now - 3 * 86400000,
    ).toISOString();
    job.observation.applicationSource.review.expiresAt = new Date(
      now - 1,
    ).toISOString();
    job.observation.applicationSource.review.payloadHash =
      applicationSourcePayloadHash(job.observation.applicationSource);
    job.currentRevisionId = revisionIdentity(job.observation);
    job.firstSeenAt = job.observation.observedAt;
    job.lastSeenAt = job.observation.observedAt;
    job.lastCheckedAt = job.observation.observedAt;
    await ref.set({
      ...stored,
      ...job,
      retentionUntilEpochMs: Date.parse(job.observation.retentionUntil),
      observation: {
        ...job.observation,
        languageRequirements: stored.observation?.languageRequirements,
      },
    });
    const jobs = await services.dependencies.listJobs();
    assert.ok(
      jobs.some(
        (value) =>
          value.jobId === job.jobId &&
          value.currentRevisionId === job.currentRevisionId,
      ),
    );
  } finally {
    await deleteApp(services.app);
  }
});
