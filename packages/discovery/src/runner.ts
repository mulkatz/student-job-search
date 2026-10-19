import { randomUUID } from "node:crypto";
import { z } from "zod";
import {
  type DiscoveryRun,
  type DiscoveryState,
  ingestObservation,
  pruneExpired,
  type SourceProgress,
} from "./model.js";
import type { DiscoveryRepository } from "./repository.js";
import { type NormalizedObservation, observationSchema } from "./schema.js";

export type AdapterContext = {
  now: Date;
  signal: AbortSignal;
  reserveRequest: (origin?: string) => Promise<void>;
};
export type DiscoveryAdapter = {
  sourceId: string;
  version: string;
  step: (
    cursor: string | null,
    context: AdapterContext,
  ) => Promise<{
    observations: NormalizedObservation[];
    nextCursor: string | null;
    done: boolean;
  }>;
};
export class SourceFailure extends Error {
  constructor(
    readonly code:
      | "source_unavailable"
      | "source_blocked"
      | "source_policy_unresolved",
    readonly retryAt: string | null = null,
  ) {
    super(code);
  }
}
const boundsSchema = z.strictObject({
  maxStepsPerSource: z.number().int().min(1).max(100),
  maxRequestsPerSource: z.number().int().min(1).max(1000),
  maxDurationMs: z.number().int().min(1).max(60000),
});
const stepSchema = z
  .strictObject({
    observations: z.array(observationSchema).max(10),
    nextCursor: z.string().min(1).max(8192).nullable(),
    done: z.boolean(),
  })
  .superRefine((value, context) => {
    if (value.done !== (value.nextCursor === null))
      context.addIssue({
        code: "custom",
        message: "Terminal pages have no next cursor",
      });
  });
export function berlinDay(now: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Berlin",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}
function progress(adapter: DiscoveryAdapter): SourceProgress {
  return {
    sourceId: adapter.sourceId,
    adapterVersion: adapter.version,
    cursor: null,
    status: "pending",
    attempts: 0,
    inFlight: false,
    attemptFence: null,
    requestReservations: [],
    error: null,
    retryAt: null,
  };
}
/** Explicit operator recovery after confirming the old worker is stopped; fences stale completions. */
export function recoverRun(
  repository: DiscoveryRepository,
  expectedRunId: string,
  expectedFence: string,
  now = new Date(),
): void {
  repository.transact((state) => {
    const run = state.runs.find((entry) => entry.runId === expectedRunId);
    if (run?.status !== "running" || run.fence !== expectedFence)
      throw new Error("no_active_run_to_recover");
    if (now.getTime() < Date.parse(run.updatedAt))
      throw new Error("run_clock_backwards");
    run.fence = null;
    run.status = "interrupted";
    run.updatedAt = now.toISOString();
    for (const source of run.sources)
      if (source.inFlight) {
        source.inFlight = false;
        source.attemptFence = null;
        source.status = "failed";
        source.error = "interrupted_attempt";
      }
  });
}
export async function runDiscovery(input: {
  repository: DiscoveryRepository;
  adapters: readonly DiscoveryAdapter[];
  bounds: z.infer<typeof boundsSchema>;
  now?: () => Date;
}): Promise<DiscoveryRun> {
  const { repository, adapters } = input;
  const bounds = boundsSchema.parse(input.bounds);
  if (
    adapters.length === 0 ||
    adapters.length > 100 ||
    new Set(adapters.map((adapter) => adapter.sourceId)).size !==
      adapters.length ||
    adapters.some(
      (adapter) =>
        !/^[a-zA-Z0-9_-]{1,160}$/.test(adapter.sourceId) ||
        !adapter.version ||
        adapter.version.length > 100,
    )
  )
    throw new Error("invalid_adapters");
  const now = input.now ?? (() => new Date());
  const started = now();
  const wallStarted = performance.now();
  const elapsed = () =>
    Math.max(
      now().getTime() - started.getTime(),
      performance.now() - wallStarted,
    );
  const day = berlinDay(started);
  const fence = randomUUID();
  const runId = repository.transact((state) => {
    if (state.runs.some((run) => run.status === "running"))
      throw new Error("run_overlap");
    pruneExpired(state, started);
    let run = state.runs.find((entry) => entry.day === day);
    if (!run) {
      run = {
        runId: randomUUID(),
        day,
        maxStepsPerSource: bounds.maxStepsPerSource,
        maxRequestsPerSource: bounds.maxRequestsPerSource,
        fence,
        startedAt: started.toISOString(),
        updatedAt: started.toISOString(),
        status: "running",
        sources: adapters.map((adapter) => ({
          ...progress(adapter),
          retryAt: state.cooldowns[adapter.sourceId] ?? null,
        })),
      };
      state.runs.push(run);
    } else {
      if (
        run.maxStepsPerSource !== bounds.maxStepsPerSource ||
        run.maxRequestsPerSource !== bounds.maxRequestsPerSource
      )
        throw new Error("daily_bounds_changed");
      if (
        run.sources.length !== adapters.length ||
        run.sources.some(
          (source) =>
            !adapters.some(
              (adapter) =>
                adapter.sourceId === source.sourceId &&
                adapter.version === source.adapterVersion,
            ),
        )
      )
        throw new Error("daily_adapter_contract_changed");
      run.fence = fence;
      run.status = "running";
      run.updatedAt = started.toISOString();
    }
    return run.runId;
  });
  const mutate = <T>(
    change: (run: DiscoveryRun, timestamp: string, state: DiscoveryState) => T,
  ): T =>
    repository.transact((state) => {
      const run = state.runs.find((entry) => entry.runId === runId);
      if (run?.status !== "running" || run.fence !== fence)
        throw new Error("run_fence_lost");
      const current = now();
      if (current.getTime() < Date.parse(run.updatedAt))
        throw new Error("run_clock_backwards");
      run.updatedAt = current.toISOString();
      return change(run, run.updatedAt, state);
    });
  for (const adapter of adapters) {
    while (true) {
      const source = mutate((run) => {
        const source = run.sources.find(
          (entry) => entry.sourceId === adapter.sourceId,
        );
        if (!source) throw new Error("source_missing");
        const current = now();
        if (
          source.status === "completed" ||
          source.attempts >= bounds.maxStepsPerSource ||
          (source.retryAt && Date.parse(source.retryAt) > current.getTime()) ||
          berlinDay(current) !== day ||
          elapsed() >= bounds.maxDurationMs
        )
          return null;
        source.attempts++;
        source.inFlight = true;
        source.attemptFence = randomUUID();
        source.status = "running";
        return structuredClone(source);
      });
      if (!source) break;
      const controller = new AbortController();
      let timer: ReturnType<typeof setTimeout> | undefined;
      try {
        const timeout = new Promise<never>((_resolve, reject) => {
          timer = setTimeout(
            () => {
              controller.abort();
              reject(new Error("source_deadline_reached"));
            },
            Math.max(1, bounds.maxDurationMs - elapsed()),
          );
        });
        const result = stepSchema.parse(
          await Promise.race([
            timeout,
            adapter.step(source.cursor, {
              now: now(),
              signal: controller.signal,
              reserveRequest: async (origin) => {
                mutate((run, timestamp, state) => {
                  const active = run.sources.find(
                    (entry) => entry.sourceId === adapter.sourceId,
                  );
                  if (
                    controller.signal.aborted ||
                    !active?.inFlight ||
                    active.attemptFence !== source.attemptFence ||
                    active.requestReservations.length >=
                      bounds.maxRequestsPerSource ||
                    berlinDay(new Date(timestamp)) !== day ||
                    elapsed() >= bounds.maxDurationMs
                  )
                    throw new Error("request_bound_reached");
                  if (origin !== undefined) {
                    const url = new URL(origin);
                    if (
                      url.origin !== origin ||
                      !["https:", "http:"].includes(url.protocol)
                    )
                      throw new Error("invalid_request_origin");
                    const owner = state.originOwners[origin];
                    if (owner && owner !== adapter.sourceId)
                      throw new Error("source_origin_already_owned");
                    state.originOwners[origin] = adapter.sourceId;
                  }
                  active.requestReservations.push({
                    reservationId: randomUUID(),
                    reservedAt: timestamp,
                  });
                });
              },
            }),
          ]),
        );
        if (!result.done && result.nextCursor === source.cursor)
          throw new Error("cursor_did_not_advance");
        if (
          result.observations.some(
            (observation) =>
              observation.sourceId !== adapter.sourceId ||
              Date.parse(observation.observedAt) > now().getTime(),
          )
        )
          throw new Error("source_identity_mismatch");
        repository.transact((state) => {
          const run = state.runs.find((entry) => entry.runId === runId);
          if (!run || run.fence !== fence || run.status !== "running")
            throw new Error("run_fence_lost");
          const active = run.sources.find(
            (entry) => entry.sourceId === adapter.sourceId,
          );
          if (!active?.inFlight || active.attemptFence !== source.attemptFence)
            throw new Error("source_attempt_missing");
          for (const observation of result.observations)
            ingestObservation(state, observation);
          active.cursor = result.nextCursor;
          active.inFlight = false;
          active.attemptFence = null;
          active.status = result.done ? "completed" : "pending";
          active.error = null;
          active.retryAt = null;
          run.updatedAt = now().toISOString();
        });
        if (result.done) break;
      } catch (error) {
        mutate((run, _timestamp, state) => {
          const active = run.sources.find(
            (entry) => entry.sourceId === adapter.sourceId,
          );
          if (!active) throw new Error("source_missing");
          active.inFlight = false;
          active.attemptFence = null;
          active.status = "failed";
          active.error =
            error instanceof SourceFailure
              ? error.code
              : "source_attempt_failed";
          active.retryAt =
            error instanceof SourceFailure ? error.retryAt : null;
          if (active.retryAt) {
            const existing = state.cooldowns[adapter.sourceId];
            if (!existing || Date.parse(existing) < Date.parse(active.retryAt))
              state.cooldowns[adapter.sourceId] = active.retryAt;
          }
        });
        break;
      } finally {
        if (timer) clearTimeout(timer);
        controller.abort();
      }
    }
  }
  mutate((run) => {
    run.status = run.sources.every((source) => source.status === "completed")
      ? "completed"
      : "partial";
    run.fence = null;
  });
  const run = repository.read().runs.find((entry) => entry.runId === runId);
  if (!run) throw new Error("run_missing");
  return run;
}
