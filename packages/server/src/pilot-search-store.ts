import { randomUUID } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
import type { Firestore, Transaction } from "firebase-admin/firestore";
import { z } from "zod";
import { decodeProfileState } from "./firebase-adapter.js";
import {
  minimizeExpiredPilotSources,
  type PilotRun,
  pilotManifest,
  pilotRunSchema,
  pilotSearchBounds,
  pilotSourceStateSchema,
  type SearchRunSummary,
  searchRunSummary,
} from "./pilot-search-schema.js";
import { ProfileError } from "./profile-pdf.js";
import { assertActiveProfileState } from "./profile-service.js";

const ownerSchema = z.strictObject({ runId: z.string().uuid() });
const monthSchema = z.strictObject({
  reservedMicroEuro: z
    .number()
    .int()
    .min(0)
    .max(pilotSearchBounds.monthlyMicroEuro),
});
const active = (run: PilotRun) =>
  run.status === "queued" ||
  run.status === "running" ||
  run.status === "dispatch_uncertain" ||
  run.paidAttempt !== null;
export function assertPilotProfile(
  value: unknown,
  ownerId: string,
  versionId: string,
  now: Date,
  expectedGeneration?: string,
) {
  const state = decodeProfileState(value, ownerId);
  assertActiveProfileState(state, ownerId);
  const version = state.versions.find((entry) => entry.id === versionId);
  if (
    (expectedGeneration !== undefined &&
      state.generation !== expectedGeneration) ||
    state.activeVersionId !== versionId ||
    !version ||
    Date.parse(version.expiresAt) <= now.getTime() ||
    Date.parse(version.approvedAt) > now.getTime()
  )
    throw new ProfileError(409, "approved_profile_changed");
  return version;
}
export function retainedPilotMetadata(
  value: unknown,
  run: PilotRun,
  now: Date,
): boolean {
  if (value === undefined || Date.parse(run.profileExpiresAt) <= now.getTime())
    return false;
  const state = decodeProfileState(value, run.ownerId);
  return (
    state.lifecycle === "active" &&
    state.generation === run.profileGeneration &&
    state.versions.some(
      (version) =>
        version.id === run.profileVersionId &&
        Date.parse(version.expiresAt) > now.getTime(),
    )
  );
}
export function assertPilotFence(run: PilotRun, fence: string, now: Date) {
  if (
    run.status !== "running" ||
    run.fence !== fence ||
    !run.leaseUntil ||
    Date.parse(run.leaseUntil) <= now.getTime()
  )
    throw new Error("pilot_fence_lost");
}
export class PilotSearchStore {
  constructor(
    readonly firestore: Firestore,
    readonly now: () => Date = () => new Date(),
  ) {}
  runRef(id: string) {
    z.string().uuid().parse(id);
    return this.firestore.doc(`pilotSearchRuns/${id}`);
  }
  ownerRef(ownerId: string) {
    z.string()
      .regex(/^[A-Za-z0-9_-]{1,128}$/)
      .parse(ownerId);
    return this.firestore.doc(`users/${ownerId}/pilotSearch/current`);
  }
  profileRef(ownerId: string) {
    this.ownerRef(ownerId);
    return this.firestore.doc(`users/${ownerId}/profileState/current`);
  }
  async get(ownerId: string): Promise<SearchRunSummary | null> {
    const owner = await this.ownerRef(ownerId).get();
    if (!owner.exists) return null;
    const { runId } = ownerSchema.parse(owner.data());
    const snapshot = await this.runRef(runId).get();
    if (!snapshot.exists) return null;
    const run = pilotRunSchema.parse(snapshot.data());
    const profile = await this.profileRef(ownerId).get();
    if (!retainedPilotMetadata(profile.data(), run, this.now())) return null;
    if (run.ownerId !== ownerId) throw new Error("pilot_owner_mismatch");
    if (
      (run.status === "queued" || run.status === "running") &&
      this.now().getTime() - Date.parse(run.updatedAt) >
        pilotSearchBounds.durationMs + 60_000
    ) {
      await this.firestore.runTransaction(async (transaction) => {
        const current = pilotRunSchema.parse(
          (await transaction.get(this.runRef(runId))).data(),
        );
        if (
          (current.status === "queued" || current.status === "running") &&
          this.now().getTime() - Date.parse(current.updatedAt) >
            pilotSearchBounds.durationMs + 60_000
        )
          transaction.set(
            this.runRef(runId),
            pilotRunSchema.parse({
              ...current,
              status: "failed",
              reason: "worker_interrupted",
              fence: null,
              updatedAt: this.now().toISOString(),
            }),
          );
      });
      return this.get(ownerId);
    }
    return Date.parse(run.profileExpiresAt) > this.now().getTime()
      ? searchRunSummary(run)
      : null;
  }
  async create(
    ownerId: string,
    operationId: string,
    versionId: string,
  ): Promise<{ run: PilotRun; created: boolean }> {
    const id = randomUUID();
    const now = this.now();
    const operationRef = this.firestore.doc(
      `users/${ownerId}/pilotSearchOperations/${operationId}`,
    );
    const monthRef = this.firestore.doc(
      `pilotSearchMonths/${now.toISOString().slice(0, 7)}`,
    );
    return this.firestore.runTransaction(async (transaction) => {
      const [operation, owner, profile, month, source] =
        await transaction.getAll(
          operationRef,
          this.ownerRef(ownerId),
          this.profileRef(ownerId),
          monthRef,
          this.firestore.doc("pilotSearchControl/sourceState"),
        );
      if (!operation || !owner || !profile || !month || !source)
        throw new Error("pilot_read_failed");
      const version = assertPilotProfile(
        profile.data(),
        ownerId,
        versionId,
        now,
      );
      if (operation.exists) {
        const previousId = ownerSchema.parse(operation.data()).runId;
        const run = pilotRunSchema.parse(
          (await transaction.get(this.runRef(previousId))).data(),
        );
        if (
          run.ownerId !== ownerId ||
          run.operationId !== operationId ||
          run.profileVersionId !== versionId
        )
          throw new ProfileError(409, "search_operation_conflict");
        return { run, created: false };
      }
      const history = await transaction.get(
        this.firestore
          .collection("pilotSearchRuns")
          .where("ownerId", "==", ownerId)
          .limit(21),
      );
      if (history.size >= 20)
        throw new ProfileError(409, "search_history_cleanup_required");
      pilotSourceStateSchema.parse(source.data());
      if (owner.exists) {
        const previousId = ownerSchema.parse(owner.data()).runId;
        const previous = pilotRunSchema.parse(
          (await transaction.get(this.runRef(previousId))).data(),
        );
        if (previous.ownerId !== ownerId)
          throw new Error("pilot_owner_mismatch");
        if (active(previous))
          throw new ProfileError(409, "search_already_active");
      }
      const reserved = month.exists
        ? monthSchema.parse(month.data()).reservedMicroEuro
        : 0;
      if (
        reserved + pilotSearchBounds.reservedMicroEuro >
        pilotSearchBounds.monthlyMicroEuro
      )
        throw new ProfileError(429, "search_monthly_budget_reached");
      const run = pilotRunSchema.parse({
        id,
        ownerId,
        operationId,
        profileVersionId: versionId,
        profileGeneration: decodeProfileState(profile.data(), ownerId)
          .generation,
        profileExpiresAt: version.expiresAt,
        status: "queued",
        target: 30,
        displayedJobs: 0,
        observations: 0,
        searchRequests: 0,
        httpRequests: 0,
        reason: null,
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
        manifest: pilotManifest(version.facts),
        fence: null,
        leaseUntil: null,
        paidAttempt: null,
        searchCursor: null,
        traversalCursor: null,
        checkpoint: null,
        seeds: [],
        jobIds: [],
        dedupKeys: [],
      });
      transaction.create(this.runRef(id), run);
      transaction.create(operationRef, { runId: id });
      transaction.set(this.ownerRef(ownerId), { runId: id });
      transaction.set(monthRef, {
        reservedMicroEuro: reserved + pilotSearchBounds.reservedMicroEuro,
      });
      return { run, created: true };
    });
  }
  async dispatchUncertain(id: string) {
    await this.firestore.runTransaction(async (transaction) => {
      const run = pilotRunSchema.parse(
        (await transaction.get(this.runRef(id))).data(),
      );
      if (run.status === "queued")
        transaction.set(this.runRef(id), {
          ...run,
          status: "dispatch_uncertain",
          reason: "dispatch_reconciliation_required",
          updatedAt: this.now().toISOString(),
        });
    });
  }
  async claim(id: string, ownerId: string): Promise<PilotRun | null> {
    return this.firestore.runTransaction(async (transaction) => {
      const [snapshot, profile] = await transaction.getAll(
        this.runRef(id),
        this.profileRef(ownerId),
      );
      if (!snapshot || !profile) throw new Error("pilot_read_failed");
      const run = pilotRunSchema.parse(snapshot.data());
      if (run.ownerId !== ownerId) throw new Error("pilot_owner_mismatch");
      if (run.status !== "queued") return null;
      assertPilotProfile(
        profile.data(),
        ownerId,
        run.profileVersionId,
        this.now(),
        run.profileGeneration,
      );
      const next = pilotRunSchema.parse({
        ...run,
        status: "running",
        fence: randomUUID(),
        leaseUntil: new Date(
          this.now().getTime() + pilotSearchBounds.durationMs,
        ).toISOString(),
        updatedAt: this.now().toISOString(),
      });
      transaction.set(this.runRef(id), next);
      return next;
    });
  }
  async mutate<T>(
    id: string,
    fence: string,
    change: (run: PilotRun, transaction: Transaction) => T | Promise<T>,
  ): Promise<T> {
    return this.firestore.runTransaction(async (transaction) => {
      const run = pilotRunSchema.parse(
        (await transaction.get(this.runRef(id))).data(),
      );
      const profile = await transaction.get(this.profileRef(run.ownerId));
      assertPilotFence(run, fence, this.now());
      assertPilotProfile(
        profile.data(),
        run.ownerId,
        run.profileVersionId,
        this.now(),
        run.profileGeneration,
      );
      const result = await change(run, transaction);
      assertPilotFence(run, fence, this.now());
      assertPilotProfile(
        profile.data(),
        run.ownerId,
        run.profileVersionId,
        this.now(),
        run.profileGeneration,
      );
      run.updatedAt = this.now().toISOString();
      transaction.set(this.runRef(id), pilotRunSchema.parse(run));
      return result;
    });
  }
  async reserve(
    id: string,
    fence: string,
    origin: string,
    sourceId: string,
    interval: number,
    signal: AbortSignal,
  ) {
    while (true) {
      signal.throwIfAborted();
      const wait = await this.firestore.runTransaction(async (transaction) => {
        signal.throwIfAborted();
        const [snapshot, sourceSnapshot] = await transaction.getAll(
          this.runRef(id),
          this.firestore.doc("pilotSearchControl/sourceState"),
        );
        if (!snapshot || !sourceSnapshot) throw new Error("pilot_read_failed");
        const run = pilotRunSchema.parse(snapshot.data());
        const profile = await transaction.get(this.profileRef(run.ownerId));
        assertPilotFence(run, fence, this.now());
        assertPilotProfile(
          profile.data(),
          run.ownerId,
          run.profileVersionId,
          this.now(),
          run.profileGeneration,
        );
        const source = pilotSourceStateSchema.parse(sourceSnapshot.data());
        if (
          source.originOwners[origin] &&
          source.originOwners[origin] !== sourceId
        )
          throw new Error("source_origin_already_owned");
        const cooldown = source.cooldowns[sourceId];
        if (cooldown && Date.parse(cooldown) > this.now().getTime())
          throw new Error("source_cooldown_active");
        if (source.originPending[origin])
          throw new Error("source_dispatch_reconciliation_required");
        const remaining =
          Date.parse(
            source.originNextAllowedAt[origin] ?? "1970-01-01T00:00:00Z",
          ) - this.now().getTime();
        if (remaining > 0) return remaining;
        if (run.httpRequests >= pilotSearchBounds.httpRequests)
          throw new Error("http_limit_reached");
        signal.throwIfAborted();
        run.httpRequests++;
        run.updatedAt = this.now().toISOString();
        source.originOwners[origin] = sourceId;
        source.originPending[origin] = { runId: id, fence };
        source.originNextAllowedAt[origin] = new Date(
          this.now().getTime() + interval,
        ).toISOString();
        transaction.set(this.runRef(id), run);
        transaction.set(
          this.firestore.doc("pilotSearchControl/sourceState"),
          source,
        );
        return 0;
      });
      if (!wait) return;
      await delay(Math.min(wait, 60_000), undefined, { signal });
    }
  }
  async confirm(
    id: string,
    fence: string,
    origin: string,
    sourceId: string,
    interval: number,
    signal: AbortSignal,
  ) {
    signal.throwIfAborted();
    await this.firestore.runTransaction(async (transaction) => {
      const [snapshot, sourceSnapshot] = await transaction.getAll(
        this.runRef(id),
        this.firestore.doc("pilotSearchControl/sourceState"),
      );
      if (!snapshot || !sourceSnapshot) throw new Error("pilot_read_failed");
      const run = pilotRunSchema.parse(snapshot.data());
      const profile = await transaction.get(this.profileRef(run.ownerId));
      assertPilotFence(run, fence, this.now());
      assertPilotProfile(
        profile.data(),
        run.ownerId,
        run.profileVersionId,
        this.now(),
        run.profileGeneration,
      );
      const source = pilotSourceStateSchema.parse(sourceSnapshot.data());
      if (
        source.originOwners[origin] !== sourceId ||
        source.originPending[origin]?.runId !== id ||
        source.originPending[origin]?.fence !== fence
      )
        throw new Error("source_owner_mismatch");
      signal.throwIfAborted();
      delete source.originPending[origin];
      if (
        source.cooldowns[sourceId] &&
        Date.parse(source.cooldowns[sourceId]) > this.now().getTime()
      )
        throw new Error("source_cooldown_active");
      source.originNextAllowedAt[origin] = new Date(
        Math.max(
          Date.parse(
            source.originNextAllowedAt[origin] ?? this.now().toISOString(),
          ),
          this.now().getTime() + interval,
        ),
      ).toISOString();
      transaction.set(
        this.firestore.doc("pilotSearchControl/sourceState"),
        source,
      );
    });
  }
  async cooldown(sourceId: string, until: string) {
    await this.firestore.runTransaction(async (transaction) => {
      const reference = this.firestore.doc("pilotSearchControl/sourceState");
      const source = pilotSourceStateSchema.parse(
        (await transaction.get(reference)).data(),
      );
      source.cooldowns[sourceId] = new Date(
        Math.max(
          Date.parse(source.cooldowns[sourceId] ?? until),
          Date.parse(until),
        ),
      ).toISOString();
      transaction.set(reference, source);
    });
  }
  async exportOwner(ownerId: string) {
    await this.ownerRef(ownerId).get();
    const snapshot = await this.firestore
      .collection("pilotSearchRuns")
      .where("ownerId", "==", ownerId)
      .limit(21)
      .get();
    if (snapshot.size > 20) throw new Error("pilot_history_limit_exceeded");
    const runs = [];
    for (const document of snapshot.docs) {
      const run = pilotRunSchema.parse(document.data());
      if (run.ownerId !== ownerId) throw new Error("pilot_owner_mismatch");
      const attempts = await document.ref
        .collection("paidAttempts")
        .limit(21)
        .get();
      if (attempts.size > 20) throw new Error("pilot_attempt_limit_exceeded");
      const { seeds: _seeds, checkpoint: _checkpoint, ...metadata } = run;
      runs.push({
        ...metadata,
        paidAttempts: attempts.docs.map((entry) => entry.data()),
      });
    }
    const profile = await this.profileRef(ownerId).get();
    return {
      runs: runs.filter((run) =>
        retainedPilotMetadata(
          profile.data(),
          { ...run, seeds: [], checkpoint: null },
          this.now(),
        ),
      ),
    };
  }
  async cleanupPrivateHistory(ownerId?: string): Promise<number> {
    if (ownerId !== undefined) this.ownerRef(ownerId);
    const query =
      ownerId === undefined
        ? this.firestore
            .collection("pilotSearchRuns")
            .orderBy("createdAt")
            .limit(100)
        : this.firestore
            .collection("pilotSearchRuns")
            .where("ownerId", "==", ownerId)
            .limit(21);
    const snapshot = await query.get();
    if (ownerId !== undefined && snapshot.size > 20)
      throw new Error("pilot_history_limit_exceeded");
    let deleted = 0;
    for (const document of snapshot.docs) {
      const removed = await this.firestore.runTransaction(
        async (transaction) => {
          const current = await transaction.get(document.ref);
          if (!current.exists) return false;
          const run = pilotRunSchema.parse(current.data());
          if (ownerId !== undefined && run.ownerId !== ownerId)
            throw new Error("pilot_owner_mismatch");
          const operationRef = this.firestore.doc(
            `users/${run.ownerId}/pilotSearchOperations/${run.operationId}`,
          );
          const [profile, owner, operation] = await transaction.getAll(
            this.profileRef(run.ownerId),
            this.ownerRef(run.ownerId),
            operationRef,
          );
          if (!profile || !owner || !operation)
            throw new Error("pilot_read_failed");
          if (retainedPilotMetadata(profile.data(), run, this.now()))
            return false;
          const attempts = await transaction.get(
            document.ref.collection("paidAttempts").limit(21),
          );
          if (attempts.size > 20)
            throw new Error("pilot_attempt_limit_exceeded");
          for (const attempt of attempts.docs) transaction.delete(attempt.ref);
          if (owner.exists && ownerSchema.parse(owner.data()).runId === run.id)
            transaction.delete(this.ownerRef(run.ownerId));
          if (
            operation.exists &&
            ownerSchema.parse(operation.data()).runId === run.id
          )
            transaction.delete(operationRef);
          transaction.delete(document.ref);
          return true;
        },
      );
      if (removed) deleted++;
    }
    return deleted;
  }
  async cleanupExpiredSources(): Promise<number> {
    const snapshot = await this.firestore
      .collection("pilotSearchRuns")
      .limit(100)
      .get();
    let changed = 0;
    for (const document of snapshot.docs) {
      const didChange = await this.firestore.runTransaction(
        async (transaction) => {
          const run = pilotRunSchema.parse(
            (await transaction.get(document.ref)).data(),
          );
          const next = minimizeExpiredPilotSources(run, this.now());
          if (
            JSON.stringify(run.seeds) === JSON.stringify(next.seeds) &&
            JSON.stringify(run.checkpoint) === JSON.stringify(next.checkpoint)
          )
            return false;
          transaction.set(document.ref, next);
          return true;
        },
      );
      if (didChange) changed++;
    }
    return changed;
  }
  async deleteOwner(ownerId: string) {
    const profile = await this.profileRef(ownerId).get();
    if (
      profile.exists &&
      decodeProfileState(profile.data(), ownerId).lifecycle === "active"
    )
      throw new Error("pilot_owner_deletion_fence_required");
    await this.cleanupPrivateHistory(ownerId);
  }
  async finish(
    id: string,
    fence: string,
    status: "completed" | "limited" | "failed",
    reason: string | null,
  ) {
    // Finalization may fence an owner-deleted/changed profile without reading its facts.
    await this.firestore.runTransaction(async (transaction) => {
      const run = pilotRunSchema.parse(
        (await transaction.get(this.runRef(id))).data(),
      );
      if (run.status !== "running" || run.fence !== fence) return;
      transaction.set(
        this.runRef(id),
        pilotRunSchema.parse({
          ...run,
          status,
          reason,
          fence: null,
          checkpoint: null,
          seeds: [],
          updatedAt: this.now().toISOString(),
        }),
      );
    });
  }
}
