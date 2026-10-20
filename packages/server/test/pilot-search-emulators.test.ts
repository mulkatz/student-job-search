import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import {
  type DiscoveryAdapter,
  observationSchema,
} from "@job-search/discovery";
import { deleteApp } from "firebase-admin/app";
import { createEmulatorServices } from "../src/emulator.js";
import {
  decodeProfileState,
  encodeProfileState,
} from "../src/firebase-adapter.js";
import {
  pilotRunSchema,
  pilotSearchBounds,
  pilotSearchSources,
} from "../src/pilot-search-schema.js";
import { PilotSearchStore } from "../src/pilot-search-store.js";
import {
  commitPilotSearchStep,
  runPilotSearch,
} from "../src/pilot-search-worker.js";
import { matchingJob, syntheticPdf } from "./profile-fixtures.js";

async function fixture() {
  const services = createEmulatorServices();
  const owner = `pilot-${randomUUID()}`;
  const uploadId = randomUUID();
  await services.profiles.upload(owner, uploadId, syntheticPdf());
  await services.profiles.approve(owner, {
    draftId: uploadId,
    expectedRevision: 0,
    expectedActiveVersionId: null,
    operationId: randomUUID(),
    confirmFacts: true,
  });
  const profile = await services.profiles.view(owner, []);
  assert.ok(profile.activeVersionId);
  const sourceRef = services.firestore.doc("pilotSearchControl/sourceState");
  await sourceRef.set({
    version: 1,
    baselineImported: true,
    baselineSnapshotSha256: "a".repeat(64),
    baselineRecordedAt: new Date().toISOString(),
    originOwners: {
      "https://api.search.brave.com": pilotSearchSources.search,
      ...Object.fromEntries(
        Array.from({ length: 52 }, (_, index) => [
          `https://synthetic-${index}.example`,
          pilotSearchSources.web,
        ]),
      ),
    },
    originNextAllowedAt: {},
    cooldowns: {},
  });
  return { ...services, owner, versionId: profile.activeVersionId, sourceRef };
}

test("pilot ledger serializes idempotency, exact approved ownership, lease claims, monthly spend and source reservations", async () => {
  const fixtureData = await fixture();
  const { firestore, app, profiles, owner, versionId, sourceRef } = fixtureData;
  let timestamp = Date.now();
  const store = new PilotSearchStore(firestore, () => new Date(timestamp));
  try {
    await firestore
      .doc(`pilotSearchMonths/${new Date(timestamp).toISOString().slice(0, 7)}`)
      .delete();
    const operation = randomUUID();
    const results = await Promise.all([
      store.create(owner, operation, versionId),
      store.create(owner, operation, versionId),
    ]);
    assert.equal(results.filter((result) => result.created).length, 1);
    assert.equal(results[0]?.run.id, results[1]?.run.id);
    const id = results[0]?.run.id;
    assert.ok(id);
    await assert.rejects(store.create(owner, randomUUID(), "b".repeat(64)));
    await assert.rejects(
      store.create("different-owner", randomUUID(), versionId),
    );
    await assert.rejects(
      store.create(owner, randomUUID(), versionId),
      /search_already_active/,
    );
    const claimed = await store.claim(id, owner);
    assert.ok(claimed?.fence);
    assert.equal(await store.claim(id, owner), null);
    const signal = new AbortController().signal;
    for (let index = 0; index < pilotSearchBounds.httpRequests; index++) {
      timestamp += 1001;
      await store.reserve(
        id,
        claimed.fence,
        "https://synthetic.example",
        pilotSearchSources.web,
        1000,
        signal,
      );
      await store.confirm(
        id,
        claimed.fence,
        "https://synthetic.example",
        pilotSearchSources.web,
        1000,
        signal,
      );
    }
    timestamp += 1001;
    await assert.rejects(
      store.reserve(
        id,
        claimed.fence,
        "https://synthetic.example",
        pilotSearchSources.web,
        1000,
        signal,
      ),
      /http_limit_reached/,
    );
    const source = (await sourceRef.get()).data();
    assert.equal(
      source?.originOwners["https://synthetic.example"],
      pilotSearchSources.web,
    );
    await assert.rejects(
      store.reserve(
        id,
        claimed.fence,
        "https://synthetic.example",
        "different-source",
        1000,
        signal,
      ),
      /already_owned/,
    );
    await store.finish(id, claimed.fence, "limited", "http_limit_reached");
    await store.create(owner, randomUUID(), versionId);
    const exported = await store.exportOwner(owner);
    assert.equal(exported.runs.length, 2);
    await assert.rejects(store.deleteOwner(owner), /deletion_fence_required/);
    await profiles.deleteOwner(owner);
    await store.deleteOwner(owner);
    assert.equal(
      (
        await firestore
          .collection("pilotSearchRuns")
          .where("ownerId", "==", owner)
          .get()
      ).size,
      0,
    );
    assert.equal((await store.ownerRef(owner).get()).exists, false);
  } finally {
    await firestore.terminate();
    await deleteApp(app);
  }
});

test("a paid search transport failure is persisted once and repeated worker delivery never sends again", async () => {
  const { firestore, app, owner, versionId } = await fixture();
  const store = new PilotSearchStore(firestore);
  try {
    await firestore
      .doc(`pilotSearchMonths/${new Date().toISOString().slice(0, 7)}`)
      .delete();
    const { run } = await store.create(owner, randomUUID(), versionId);
    let calls = 0;
    const input = {
      store,
      runId: run.id,
      ownerId: owner,
      apiKey: "synthetic-test-key",
      config: {
        projectId: "synthetic-project",
        region: "europe-west3",
        jobName: "job-search-dry-run",
        access: {
          operatorAuthorizationRef: "synthetic",
          providerGrant: "unverified" as const,
          decisionRef:
            "docs/adr/0016-private-brave-operator-authorization.md" as const,
          purpose: "bounded_private_discovery" as const,
          retain: "urls_and_provenance_only" as const,
          expiresAt: new Date(Date.now() + 86400000).toISOString(),
        },
      },
      searchFetch: async () => {
        calls++;
        throw new Error("transport interrupted");
      },
    };
    await runPilotSearch(input);
    await runPilotSearch(input);
    assert.equal(calls, 1);
    const stored = pilotRunSchema.parse(
      (await store.runRef(run.id).get()).data(),
    );
    assert.equal(stored.status, "limited");
    assert.equal(stored.searchRequests, 1);
    assert.equal(stored.httpRequests, 1);
    assert.equal(stored.displayedJobs, 0);
    assert.ok(stored.paidAttempt);
    assert.equal(
      (await store.runRef(run.id).collection("paidAttempts").get()).size,
      1,
    );
    await assert.rejects(
      store.create(owner, randomUUID(), versionId),
      /search_already_active/,
    );
    assert.equal(
      (
        await firestore
          .doc(`pilotSearchMonths/${new Date().toISOString().slice(0, 7)}`)
          .get()
      ).data()?.reservedMicroEuro,
      1_000_000,
    );
  } finally {
    await firestore.terminate();
    await deleteApp(app);
  }
});

test("vacancy projection, count and frontier commit together and rediscovery preserves firstSeen", async () => {
  const { firestore, app, owner, versionId } = await fixture();
  let timestamp = Date.now();
  const store = new PilotSearchStore(firestore, () => new Date(timestamp));
  try {
    await firestore
      .doc(`pilotSearchMonths/${new Date(timestamp).toISOString().slice(0, 7)}`)
      .delete();
    const { applicationSource: _reviewedSource, ...content } =
      matchingJob(timestamp).observation;
    const observation = observationSchema.parse({
      ...content,
      sourceId: pilotSearchSources.web,
      sourceRecordId: `https://synthetic.example/jobs/${randomUUID()}`,
      observedAt: new Date(timestamp).toISOString(),
      retentionUntil: new Date(timestamp + 86400000).toISOString(),
    });
    const adapter: DiscoveryAdapter = {
      sourceId: pilotSearchSources.web,
      version: "synthetic",
      step: async () => {
        throw new Error("No external calls in this transaction regression");
      },
    };
    const first = await store.create(owner, randomUUID(), versionId);
    const claim = await store.claim(first.run.id, owner);
    assert.ok(claim?.fence);
    await commitPilotSearchStep(store, first.run.id, claim.fence, adapter, {
      observations: [observation],
      nextCursor: null,
      done: true,
      checkpoint: null,
    });
    const committed = pilotRunSchema.parse(
      (await store.runRef(first.run.id).get()).data(),
    );
    assert.equal(committed.displayedJobs, 1);
    assert.equal(committed.observations, 1);
    assert.equal(committed.checkpoint, null);
    const id = committed.jobIds[0];
    assert.ok(id);
    const projection = (await firestore.doc(`sharedJobs/${id}`).get()).data();
    assert.equal(projection?.firstSeenAt, observation.observedAt);
    await store.finish(
      first.run.id,
      claim.fence,
      "limited",
      "insufficient_verified_details",
    );
    timestamp += 1000;
    const second = await store.create(owner, randomUUID(), versionId);
    const secondClaim = await store.claim(second.run.id, owner);
    assert.ok(secondClaim?.fence);
    await commitPilotSearchStep(
      store,
      second.run.id,
      secondClaim.fence,
      adapter,
      {
        observations: [
          { ...observation, observedAt: new Date(timestamp).toISOString() },
        ],
        nextCursor: null,
        done: true,
        checkpoint: null,
      },
    );
    const current = (await firestore.doc(`sharedJobs/${id}`).get()).data();
    assert.equal(current?.firstSeenAt, observation.observedAt);
    assert.equal(current?.lastCheckedAt, new Date(timestamp).toISOString());
    assert.equal(
      pilotRunSchema.parse((await store.runRef(second.run.id).get()).data())
        .displayedJobs,
      1,
    );
  } finally {
    await firestore.terminate();
    await deleteApp(app);
  }
});

test("expired approved profile cleanup purges all private search history and leaves aggregate budgets and technical source state", async () => {
  const { firestore, app, profiles, owner, versionId } = await fixture();
  const store = new PilotSearchStore(firestore);
  try {
    const monthRef = firestore.doc(
      `pilotSearchMonths/${new Date().toISOString().slice(0, 7)}`,
    );
    await monthRef.delete();
    const { run } = await store.create(owner, randomUUID(), versionId);
    const claim = await store.claim(run.id, owner);
    assert.ok(claim?.fence);
    await store.mutate(run.id, claim.fence, (value, transaction) => {
      const attemptId = randomUUID();
      value.paidAttempt = { attemptId, requestRef: "c".repeat(64) };
      transaction.create(
        store.runRef(run.id).collection("paidAttempts").doc(attemptId),
        { status: "reserved", requestRef: "c".repeat(64) },
      );
    });
    const beforeSource = (
      await firestore.doc("pilotSearchControl/sourceState").get()
    ).data();
    const profileRef = store.profileRef(owner);
    const state = decodeProfileState((await profileRef.get()).data(), owner);
    const expired = Date.now() - 1000;
    for (const version of state.versions) {
      version.approvedAt = new Date(expired - 90 * 86400000).toISOString();
      version.expiresAt = new Date(expired).toISOString();
    }
    for (const asset of state.assets) {
      asset.pendingUntil = new Date(expired - 7 * 86400000).toISOString();
      asset.expiresAt = new Date(expired).toISOString();
    }
    for (const draft of state.drafts) {
      draft.createdAt = new Date(expired - 7 * 86400000).toISOString();
      draft.expiresAt = new Date(expired).toISOString();
    }
    await profileRef.set(encodeProfileState(state));
    assert.equal(await store.get(owner), null);
    assert.deepEqual(await store.exportOwner(owner), { runs: [] });
    await profiles.cleanup(owner);
    assert.ok(
      ["deleting", "deleted"].includes(
        decodeProfileState((await profileRef.get()).data(), owner).lifecycle,
      ),
    );
    assert.equal(await store.cleanupPrivateHistory(owner), 1);
    assert.equal((await store.runRef(run.id).get()).exists, false);
    assert.equal(
      (await store.runRef(run.id).collection("paidAttempts").get()).size,
      0,
    );
    assert.equal((await store.ownerRef(owner).get()).exists, false);
    assert.equal(
      (
        await firestore
          .doc(`users/${owner}/pilotSearchOperations/${run.operationId}`)
          .get()
      ).exists,
      false,
    );
    assert.equal((await monthRef.get()).data()?.reservedMicroEuro, 1_000_000);
    assert.deepEqual(
      (await firestore.doc("pilotSearchControl/sourceState").get()).data(),
      beforeSource,
    );
  } finally {
    await firestore.terminate();
    await deleteApp(app);
  }
});
