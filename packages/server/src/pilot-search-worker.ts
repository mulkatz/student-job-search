import { pathToFileURL } from "node:url";
import {
  type AdapterContext,
  createBraveSearchAdapter,
  createCareerTraversalAdapter,
  type DiscoveryAdapter,
  type DiscoveryJob,
  emptyState,
  ingestObservation,
  type NormalizedObservation,
  SourceFailure,
} from "@job-search/discovery";
import type { PublicFetcherOptions } from "@job-search/experiment";
import { deleteApp } from "firebase-admin/app";
import { z } from "zod";
import { decodeSharedJob, encodeSharedJob } from "./firebase-adapter.js";
import {
  hashPilot,
  type PilotRun,
  type PilotSearchConfig,
  pilotRunSchema,
  pilotSearchBounds,
  pilotSearchConfig,
  pilotSearchSources,
  pilotSourcePermission,
} from "./pilot-search-schema.js";
import { PilotSearchStore } from "./pilot-search-store.js";
import { createProductionServices } from "./production.js";

/** Conservative deduplication: one canonical URL and one title/employer/location tuple. */
export function pilotOpportunityKeys(
  observation: NormalizedObservation,
): string[] {
  const url = new URL(observation.finalUrl ?? observation.originalUrl);
  url.hash = "";
  for (const key of [...url.searchParams.keys()])
    if (/^(?:utm_|fbclid$|gclid$)/i.test(key)) url.searchParams.delete(key);
  const keys = [hashPilot(url.href)];
  if (observation.title && observation.employer)
    keys.push(
      hashPilot(
        [
          observation.title.value,
          observation.employer.value,
          observation.location?.value ?? "",
        ].map((part) => part.trim().toLowerCase().replace(/\s+/g, " ")),
      ),
    );
  return keys;
}
export function potentialPilotJob(
  observation: NormalizedObservation,
  now: Date,
): DiscoveryJob | null {
  if (
    observation.kind !== "vacancy_detail" ||
    !observation.title ||
    !observation.employer ||
    Date.parse(observation.retentionUntil) <= now.getTime() ||
    (observation.expiresAt &&
      Date.parse(observation.expiresAt) <= now.getTime())
  )
    return null;
  // Discovery is unreviewed. The application channel cannot be approved by fetching.
  const state = emptyState();
  return ingestObservation(state, observation).job;
}
export function pilotTraversalSeeds(
  seeds: readonly NormalizedObservation[],
): NormalizedObservation[] {
  const groups = new Map<string, NormalizedObservation[]>();
  for (const seed of seeds) {
    const provenance = seed.discoveryProvenance;
    const key =
      provenance?.kind === "brave_search_result"
        ? provenance.queryRef
        : "other";
    const group = groups.get(key) ?? [];
    group.push(seed);
    groups.set(key, group);
  }
  const result: NormalizedObservation[] = [];
  for (let index = 0; index < 10 && result.length < 64; index++)
    for (const group of groups.values()) {
      const seed = group[index];
      if (
        seed &&
        result.length < 64 &&
        !result.some((entry) => entry.originalUrl === seed.originalUrl)
      )
        result.push(seed);
    }
  return result;
}
export async function commitPilotSearchStep(
  store: PilotSearchStore,
  runId: string,
  fence: string,
  adapter: DiscoveryAdapter,
  result: Awaited<ReturnType<DiscoveryAdapter["step"]>>,
): Promise<void> {
  await store.mutate(runId, fence, async (value, transaction) => {
    const candidates = result.observations
      .map((observation) => potentialPilotJob(observation, store.now()))
      .filter((job): job is DiscoveryJob => job !== null);
    const existing = candidates.length
      ? await transaction.getAll(
          ...candidates.map((job) =>
            store.firestore.doc(`sharedJobs/${job.jobId}`),
          ),
        )
      : [];
    const previous = new Map(
      existing
        .filter((snapshot) => snapshot.exists)
        .map((snapshot) => [
          snapshot.id,
          decodeSharedJob(snapshot.data(), snapshot.id, store.now().getTime()),
        ]),
    );
    if (
      value.observations + result.observations.length >
      pilotSearchBounds.observations
    )
      throw new Error("observation_limit_reached");
    if (
      value.paidAttempt &&
      value.paidAttempt.attemptId !== result.completedPaidAttemptId
    )
      throw new Error("paid_attempt_reconciliation_required");
    if (result.completedPaidAttemptId) value.paidAttempt = null;
    value.observations += result.observations.length;
    for (const observation of result.observations) {
      if (
        observation.sourceId !== adapter.sourceId ||
        Date.parse(observation.observedAt) > store.now().getTime()
      )
        throw new Error("source_identity_mismatch");
      if (observation.kind === "search_lead" && value.seeds.length < 64) {
        const provenance = observation.discoveryProvenance;
        if (
          provenance?.kind === "brave_search_result" &&
          value.seeds.filter(
            (seed) =>
              seed.discoveryProvenance?.kind === "brave_search_result" &&
              seed.discoveryProvenance.queryRef === provenance.queryRef,
          ).length < 3 &&
          JSON.stringify(value.seeds).length +
            JSON.stringify(observation).length <
            200_000
        )
          value.seeds.push(observation);
      }
      let job = potentialPilotJob(observation, store.now());
      if (!job || value.displayedJobs >= 30) continue;
      const prior = previous.get(job.jobId);
      if (prior) {
        const state = emptyState();
        state.jobs.push(prior);
        job = ingestObservation(state, observation).job;
      }
      const keys = pilotOpportunityKeys(observation);
      if (keys.some((key) => value.dedupKeys.includes(key))) continue;
      value.jobIds.push(job.jobId);
      value.dedupKeys.push(...keys);
      value.displayedJobs++;
      transaction.set(store.firestore.doc(`sharedJobs/${job.jobId}`), {
        ...encodeSharedJob(job),
        retentionUntilEpochMs: Date.parse(observation.retentionUntil),
      });
    }
    if (adapter.sourceId === pilotSearchSources.search)
      value.searchCursor = result.nextCursor;
    else {
      value.traversalCursor = result.nextCursor;
      value.checkpoint = result.checkpoint ?? null;
    }
  });
}

export async function runPilotSearch(input: {
  store: PilotSearchStore;
  runId: string;
  ownerId: string;
  config: PilotSearchConfig;
  apiKey: string;
  evaluate?: (
    ownerId: string,
    versionId: string,
    jobs: DiscoveryJob[],
  ) => Promise<void>;
  searchFetch?: typeof fetch;
  publicFetch?: Pick<PublicFetcherOptions, "resolve" | "transport">;
}): Promise<void> {
  const { store } = input;
  const claimed = await store.claim(input.runId, input.ownerId);
  if (!claimed) return; // Repeated Cloud Run delivery never replays a paid search.
  let run: PilotRun = claimed;
  const fence = run.fence;
  if (!fence) throw new Error("pilot_fence_missing");
  const signal = AbortSignal.timeout(pilotSearchBounds.durationMs);
  let stoppedReason: string | null = null;
  const mutate = async <T>(change: (value: PilotRun) => T) =>
    store.mutate(run.id, fence, (value) => change(value));
  const refresh = async () => {
    run = pilotRunSchema.parse((await store.runRef(input.runId).get()).data());
    return run;
  };
  const context = (
    sourceId: string,
    stepSignal: AbortSignal,
  ): AdapterContext => ({
    now: store.now(),
    currentTime: store.now,
    signal: stepSignal,
    ...(run.checkpoint ? { checkpoint: run.checkpoint } : {}),
    ...(run.paidAttempt
      ? { paidAttempt: { ...run.paidAttempt, startedAt: run.updatedAt } }
      : {}),
    reserveRequest: async (origin, interval) => {
      if (!origin) throw new Error("request_origin_required");
      await store.reserve(
        run.id,
        fence,
        origin,
        sourceId,
        interval ?? 1000,
        stepSignal,
      );
    },
    confirmDispatch: (origin) =>
      store.confirm(run.id, fence, origin, sourceId, 1000, stepSignal),
    beginPaidAttempt: async (attempt) => {
      await store.mutate(run.id, fence, (value, transaction) => {
        stepSignal.throwIfAborted();
        if (value.paidAttempt)
          throw new Error("paid_attempt_reconciliation_required");
        if (value.searchRequests >= pilotSearchBounds.searchRequests)
          throw new Error("search_limit_reached");
        value.searchRequests++;
        value.paidAttempt = attempt;
        transaction.create(
          store
            .runRef(run.id)
            .collection("paidAttempts")
            .doc(attempt.attemptId),
          {
            ...attempt,
            status: "reserved",
            reservedAt: store.now().toISOString(),
            upperCostMicroEuro: 10_000,
          },
        );
      });
    },
  });
  const step = async (adapter: DiscoveryAdapter, cursor: string | null) => {
    const controller = new AbortController();
    const stepSignal = AbortSignal.any([
      signal,
      controller.signal,
      AbortSignal.timeout(12_000),
    ]);
    try {
      return await adapter.step(cursor, context(adapter.sourceId, stepSignal));
    } finally {
      controller.abort();
    }
  };
  const commitStep = async (
    adapter: DiscoveryAdapter,
    result: Awaited<ReturnType<DiscoveryAdapter["step"]>>,
  ) => {
    await commitPilotSearchStep(store, run.id, fence, adapter, result);
    await refresh();
  };
  const failure = async (error: unknown, sourceId: string) => {
    if (error instanceof SourceFailure && error.retryAt)
      await store.cooldown(sourceId, error.retryAt);
    if (
      error instanceof SourceFailure &&
      error.code === "source_search_reconciliation_required"
    )
      return "paid_attempt_reconciliation_required";
    if (signal.aborted) return "duration_limit_reached";
    if (
      error instanceof Error &&
      [
        "http_limit_reached",
        "search_limit_reached",
        "observation_limit_reached",
        "source_cooldown_active",
        "paid_attempt_reconciliation_required",
      ].includes(error.message)
    )
      return error.message;
    return error instanceof SourceFailure
      ? error.code
      : "worker_operation_failed";
  };
  try {
    const search = createBraveSearchAdapter({
      sourceId: pilotSearchSources.search,
      access: input.config.access,
      manifest: run.manifest,
      pages: run.manifest.queries.map((query) => ({
        queryId: query.id,
        offset: 0,
      })),
      apiKey: input.apiKey,
      liveOptIn: true,
      beforeRequest: async () => {},
      afterAttempt: async (summary) => {
        // A successful completion is cleared only atomically with its observations.
        await store.mutate(run.id, fence, (value, transaction) => {
          if (value.paidAttempt?.attemptId !== summary.attemptId)
            throw new Error("paid_attempt_identity_mismatch");
          transaction.set(
            store
              .runRef(run.id)
              .collection("paidAttempts")
              .doc(summary.attemptId),
            {
              ...summary,
              finishedAt: store.now().toISOString(),
              upperCostMicroEuro: 10_000,
            },
          );
        });
        if (summary.reason === "rate_limited")
          await store.cooldown(
            pilotSearchSources.search,
            new Date(store.now().getTime() + 60_000).toISOString(),
          );
      },
      ...(input.searchFetch ? { fetchImpl: input.searchFetch } : {}),
    });
    while (
      run.searchRequests < 20 &&
      run.httpRequests < 120 &&
      run.observations < 300
    ) {
      try {
        const result = await step(search, run.searchCursor);
        await commitStep(search, result);
        if (result.done) break;
      } catch (error) {
        stoppedReason = await failure(error, search.sourceId);
        await refresh();
        break;
      }
    }
    if (run.paidAttempt) {
      await store.finish(
        run.id,
        fence,
        "limited",
        stoppedReason ?? "paid_attempt_reconciliation_required",
      );
      return;
    }
    const seeds = pilotTraversalSeeds(run.seeds);
    if (seeds.length) {
      const traversal = createCareerTraversalAdapter({
        sourceId: pilotSearchSources.web,
        sourcePolicyRef:
          "docs/adr/0005-bounded-experiment-and-public-fetch-policy.md",
        seeds,
        limits: {
          maxDepth: 2,
          maxLinksPerPage: 10,
          maxPending: 64,
          maxVisited: 120,
        },
        fetchOptions: {
          liveOptIn: true,
          sourcePolicy: async (url) => pilotSourcePermission(url),
          beforeRequest: async () => {},
          timeoutMs: 10_000,
          ...input.publicFetch,
        },
      });
      if (traversal.initialCheckpoint)
        await mutate((value) => {
          value.checkpoint = traversal.initialCheckpoint ?? null;
        });
      await refresh();
      while (
        run.checkpoint &&
        run.displayedJobs < 30 &&
        run.httpRequests < 120 &&
        run.observations < 300
      ) {
        const firstTarget = run.checkpoint.pending[0]?.url;
        try {
          const result = await step(traversal, run.traversalCursor);
          await commitStep(traversal, result);
          if (result.done) break;
        } catch (error) {
          stoppedReason = await failure(error, traversal.sourceId);
          await refresh();
          if (
            signal.aborted ||
            run.httpRequests >= 120 ||
            stoppedReason === "http_limit_reached" ||
            stoppedReason === "source_cooldown_active"
          )
            break;
          // Skip one failed public target, never repeat a paid request.
          await mutate((value) => {
            if (
              value.checkpoint &&
              value.checkpoint.pending[0]?.url === firstTarget
            )
              value.checkpoint.pending.shift();
          });
          await refresh();
        }
      }
    }
    if (input.evaluate && run.jobIds.length) {
      const snapshots = await store.firestore.getAll(
        ...run.jobIds.map((id) => store.firestore.doc(`sharedJobs/${id}`)),
      );
      await input.evaluate(
        run.ownerId,
        run.profileVersionId,
        snapshots.map((snapshot) =>
          decodeSharedJob(snapshot.data(), snapshot.id, store.now().getTime()),
        ),
      );
    }
    await store.finish(
      run.id,
      fence,
      run.displayedJobs >= 30 ? "completed" : "limited",
      run.displayedJobs >= 30
        ? null
        : (stoppedReason ??
            (run.httpRequests >= 120
              ? "http_limit_reached"
              : "insufficient_verified_details")),
    );
  } catch (error) {
    await store.finish(
      run.id,
      fence,
      "failed",
      await failure(error, pilotSearchSources.web),
    );
  }
}
async function main() {
  const config = pilotSearchConfig(process.env);
  if (!config || process.env.JOB_SEARCH_WORKER !== "pilot-search")
    throw new Error("pilot_worker_explicit_configuration_required");
  const runId = z.string().uuid().parse(process.env.JOB_SEARCH_RUN_ID);
  const ownerId = z
    .string()
    .regex(/^[A-Za-z0-9_-]{1,128}$/)
    .parse(process.env.JOB_SEARCH_RUN_OWNER);
  const apiKey = z.string().min(1).max(4096).parse(process.env.BRAVE_API_KEY);
  const services = createProductionServices();
  try {
    await runPilotSearch({
      store: new PilotSearchStore(services.firestore),
      runId,
      ownerId,
      config,
      apiKey,
      evaluate: (owner, version, jobs) =>
        services.profiles.evaluate(owner, version, jobs),
    });
  } finally {
    await services.firestore.terminate();
    await deleteApp(services.app);
  }
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  main().catch(() => {
    console.error(
      "Private pilot worker failed; inspect the durable run status.",
    );
    process.exitCode = 1;
  });
}
