import { createHash } from "node:crypto";
import { z } from "zod";
import {
  type DiscoveryJob,
  discoveryJobSchema,
  type NormalizedObservation,
  observationSchema,
} from "./schema.js";

const timestamp = z.iso.datetime({ offset: true });
export const sourceProgressSchema = z.strictObject({
  sourceId: z.string().min(1).max(160),
  adapterVersion: z.string().min(1).max(100),
  cursor: z.string().max(8192).nullable(),
  status: z.enum(["pending", "running", "completed", "failed"]),
  attempts: z.number().int().min(0).max(10000),
  inFlight: z.boolean(),
  attemptFence: z.string().uuid().nullable(),
  requestReservations: z
    .array(
      z.strictObject({
        reservationId: z.string().uuid(),
        reservedAt: timestamp,
      }),
    )
    .max(1000),
  error: z
    .string()
    .regex(/^[a-z_]{1,80}$/)
    .nullable(),
  retryAt: timestamp.nullable(),
});
export const runSchema = z.strictObject({
  runId: z.string().uuid(),
  day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  maxStepsPerSource: z.number().int().min(1).max(100),
  maxRequestsPerSource: z.number().int().min(1).max(1000),
  fence: z.string().uuid().nullable(),
  startedAt: timestamp,
  updatedAt: timestamp,
  status: z.enum(["running", "completed", "interrupted", "partial"]),
  sources: z.array(sourceProgressSchema).max(100),
});
export const stateSchema = z.strictObject({
  version: z.literal(1),
  cooldowns: z.record(z.string().min(1).max(160), timestamp),
  originOwners: z.record(z.url(), z.string().min(1).max(160)),
  jobs: z.array(discoveryJobSchema).max(10000),
  revisions: z
    .array(
      z.strictObject({
        revisionId: z.string().regex(/^rev_[a-f0-9]{64}$/),
        jobId: z.string().regex(/^job_[a-f0-9]{32}$/),
        recordedAt: timestamp,
        observation: observationSchema,
      }),
    )
    .max(30000),
  runs: z.array(runSchema).max(366),
});
export type DiscoveryState = z.infer<typeof stateSchema>;
export type DiscoveryRun = z.infer<typeof runSchema>;
export type SourceProgress = z.infer<typeof sourceProgressSchema>;
export function emptyState(): DiscoveryState {
  return {
    version: 1,
    cooldowns: {},
    originOwners: {},
    jobs: [],
    revisions: [],
    runs: [],
  };
}
function hash(input: unknown): string {
  return createHash("sha256").update(JSON.stringify(input)).digest("hex");
}
function stable(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stable);
  if (typeof value === "object" && value !== null)
    return Object.fromEntries(
      Object.entries(value)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, nested]) => [key, stable(nested)]),
    );
  return value;
}
export function jobIdentity(sourceId: string, sourceRecordId: string): string {
  return `job_${hash([sourceId, sourceRecordId]).slice(0, 32)}`;
}
export function revisionIdentity(observation: NormalizedObservation): string {
  const {
    observedAt: _observedAt,
    retentionUntil: _retentionUntil,
    ...content
  } = observation;
  return `rev_${hash(stable(content))}`;
}
function similar(left: DiscoveryJob, right: DiscoveryJob): boolean {
  const comparable = (value: string) =>
    value.trim().toLocaleLowerCase("en").replace(/\s+/g, " ");
  return (
    left.observation.title !== null &&
    left.observation.employer !== null &&
    right.observation.title !== null &&
    right.observation.employer !== null &&
    comparable(left.observation.title.value) ===
      comparable(right.observation.title.value) &&
    comparable(left.observation.employer.value) ===
      comparable(right.observation.employer.value)
  );
}
/** Caller commits this state with its cursor in the same transaction. */
export function ingestObservation(
  state: DiscoveryState,
  input: unknown,
): { job: DiscoveryJob; newRevision: boolean } {
  const observation = observationSchema.parse(input);
  const jobId = jobIdentity(observation.sourceId, observation.sourceRecordId);
  const revisionId = revisionIdentity(observation);
  const previous = state.jobs.find((job) => job.jobId === jobId);
  if (
    previous &&
    Date.parse(observation.observedAt) < Date.parse(previous.lastCheckedAt)
  )
    throw new Error("observation_clock_backwards");
  const newRevision = !state.revisions.some(
    (revision) => revision.revisionId === revisionId,
  );
  if (newRevision)
    state.revisions.push({
      revisionId,
      jobId,
      recordedAt: observation.observedAt,
      observation,
    });
  const seen = observation.kind !== "unavailable";
  const job = discoveryJobSchema.parse({
    jobId,
    sourceId: observation.sourceId,
    sourceRecordId: observation.sourceRecordId,
    currentRevisionId: revisionId,
    firstSeenAt: previous?.firstSeenAt ?? observation.observedAt,
    lastSeenAt: seen
      ? observation.observedAt
      : (previous?.lastSeenAt ?? observation.observedAt),
    lastCheckedAt: observation.observedAt,
    observation,
    possibleDuplicateIds: [],
    fitScore: null,
  });
  if (previous) state.jobs[state.jobs.indexOf(previous)] = job;
  else state.jobs.push(job);
  for (const other of state.jobs) {
    if (other.jobId === jobId) continue;
    other.possibleDuplicateIds = other.possibleDuplicateIds.filter(
      (id) => id !== jobId,
    );
    if (
      Date.parse(other.observation.retentionUntil) >
        Date.parse(observation.observedAt) &&
      similar(job, other)
    ) {
      job.possibleDuplicateIds.push(other.jobId);
      other.possibleDuplicateIds.push(jobId);
    }
  }
  return { job, newRevision };
}
export function retainedJobs(
  state: DiscoveryState,
  now = new Date(),
): DiscoveryJob[] {
  const jobs = state.jobs.filter(
    (job) => Date.parse(job.observation.retentionUntil) > now.getTime(),
  );
  const ids = new Set(jobs.map((job) => job.jobId));
  return structuredClone(
    jobs.map((job) => ({
      ...job,
      possibleDuplicateIds: job.possibleDuplicateIds.filter((id) =>
        ids.has(id),
      ),
    })),
  );
}
export function pruneExpired(state: DiscoveryState, now = new Date()): void {
  state.jobs = retainedJobs(state, now);
  state.revisions = state.revisions.filter(
    (revision) =>
      Date.parse(revision.observation.retentionUntil) > now.getTime(),
  );
  for (const job of state.jobs) {
    if (
      !state.revisions.some(
        (revision) => revision.revisionId === job.currentRevisionId,
      )
    ) {
      // The old retained record has expired. Re-establish its immutable content
      // identity solely from the fresh observation, without retaining old provenance.
      state.revisions.push({
        revisionId: job.currentRevisionId,
        jobId: job.jobId,
        recordedAt: job.observation.observedAt,
        observation: structuredClone(job.observation),
      });
    }
  }
}
