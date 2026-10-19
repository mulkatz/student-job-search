import { randomUUID } from "node:crypto";
import {
  chmodSync,
  closeSync,
  fsyncSync,
  linkSync,
  lstatSync,
  mkdirSync,
  openSync,
  readFileSync,
  renameSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { join, resolve } from "node:path";
import { z } from "zod";
import {
  assertBudget,
  berlinDate,
  manifestHash,
  observationStatus,
  usage,
  validateState,
  windowEnd,
} from "./ledger.js";
import {
  configSchema,
  type Manifest,
  manifestSchema,
  requestSchema,
  type State,
} from "./schema.js";

const optInSchema = z.strictObject({ liveOptIn: z.literal(true) });
const settlementSchema = z.discriminatedUnion("outcome", [
  z.strictObject({
    outcome: z.enum(["succeeded", "failed"]),
    actualCostMicroEuro: z
      .number()
      .int()
      .nonnegative()
      .max(Number.MAX_SAFE_INTEGER),
  }),
  z.strictObject({ outcome: z.literal("ambiguous") }),
]);

export class ExperimentStore {
  readonly directory: string;
  readonly statePath: string;
  readonly lockPath: string;
  readonly manifest: Manifest;

  constructor(projectRoot: string, manifestInput: unknown) {
    this.directory = join(resolve(projectRoot), ".local", "g3");
    this.statePath = join(this.directory, "state.json");
    this.lockPath = join(this.directory, "writer.lock");
    this.manifest = manifestSchema.parse(manifestInput);
  }

  private ensurePrivateDirectory(create: boolean): void {
    for (const directory of [resolve(this.directory, ".."), this.directory]) {
      if (create) mkdirSync(directory, { recursive: true, mode: 0o700 });
      if (!lstatSync(directory).isDirectory())
        throw new Error("Private state directories must not be symlinks.");
    }
  }

  read(): State {
    this.ensurePrivateDirectory(false);
    if (!lstatSync(this.statePath).isFile())
      throw new Error("Private state must be a regular file.");
    return validateState(
      JSON.parse(readFileSync(this.statePath, "utf8")),
      this.manifest,
    );
  }

  private atomicWrite(state: State, initialize: boolean): void {
    const temporary = join(this.directory, `state-${randomUUID()}.tmp`);
    const fd = openSync(temporary, "wx", 0o600);
    try {
      writeFileSync(fd, `${JSON.stringify(state, null, 2)}\n`);
      fsyncSync(fd);
    } finally {
      closeSync(fd);
    }
    if (initialize) {
      linkSync(temporary, this.statePath); // Atomic, exclusive installation; never overwrite an existing run.
      unlinkSync(temporary);
    } else renameSync(temporary, this.statePath);
    const directoryFd = openSync(this.directory, "r");
    try {
      fsyncSync(directoryFd);
    } finally {
      closeSync(directoryFd);
    }
  }

  private writeTransaction(update: () => State, initialize = false): State {
    this.ensurePrivateDirectory(initialize);
    chmodSync(this.directory, 0o700);
    let lock: number;
    try {
      lock = openSync(this.lockPath, "wx", 0o600);
    } catch {
      throw new Error(
        "Experiment writer lock exists or is unavailable; reconcile it explicitly before further writes.",
      );
    }
    let writeStarted = false;
    let completed = false;
    try {
      writeFileSync(
        lock,
        "G3 single writer; a crash requires manual reconciliation.\n",
      );
      fsyncSync(lock);
      const state = validateState(update(), this.manifest);
      writeStarted = true;
      this.atomicWrite(state, initialize);
      completed = true;
      return state;
    } finally {
      closeSync(lock);
      // A crash or uncertain filesystem write retains the lock, never a blind retry.
      if (!writeStarted || completed) unlinkSync(this.lockPath);
    }
  }

  initialize(configInput: unknown, now = new Date()): State {
    const config = configSchema.parse(configInput);
    const timestamp = now.toISOString();
    return this.writeTransaction(() => {
      try {
        lstatSync(this.statePath);
        throw new Error(
          "Experiment already initialized; never overwrite its ledger.",
        );
      } catch (error) {
        if (
          !(
            error instanceof Error &&
            "code" in error &&
            error.code === "ENOENT"
          )
        )
          throw error;
      }
      return {
        version: 1,
        manifestHash: manifestHash(this.manifest),
        config,
        createdAt: timestamp,
        updatedAt: timestamp,
        startedAt: null,
        attempts: [],
      };
    }, true);
  }

  private update(
    now: Date,
    change: (state: State, timestamp: string) => void,
  ): State {
    const timestamp = now.toISOString();
    return this.writeTransaction(() => {
      const state = this.read();
      if (timestamp < state.updatedAt)
        throw new Error(
          "Clock moved backwards; reconcile observation timestamps.",
        );
      change(state, timestamp);
      state.updatedAt = timestamp;
      return state;
    });
  }

  reserve(input: unknown, now = new Date()): State {
    const request = requestSchema.parse(input);
    return this.update(now, (state, timestamp) => {
      assertBudget(state);
      const end = windowEnd(state);
      if (end !== null && berlinDate(timestamp) > end)
        throw new Error("Observation window ended; no new attempts.");
      if (state.attempts.some((attempt) => attempt.request.id === request.id))
        throw new Error("Attempt ID already exists; never repeat it.");
      state.attempts.push({
        request,
        reservedAt: timestamp,
        outcome: "reserved",
      });
      assertBudget(state);
    });
  }

  beginLiveAttempt(id: string, optInInput: unknown, now = new Date()): State {
    optInSchema.parse(optInInput);
    return this.update(now, (state, timestamp) => {
      assertBudget(state);
      const attempt = state.attempts.find((entry) => entry.request.id === id);
      if (attempt?.outcome !== "reserved")
        throw new Error("Attempt is not an undispatched reservation.");
      const end = windowEnd(state);
      if (
        berlinDate(attempt.reservedAt) !== berlinDate(timestamp) ||
        (end !== null && berlinDate(timestamp) > end)
      ) {
        throw new Error(
          "Reservation cannot move across calendar days or beyond the window.",
        );
      }
      attempt.dispatchedAt = timestamp;
      attempt.outcome = "dispatched";
      if (state.startedAt === null && attempt.request.branch === "discovery")
        state.startedAt = timestamp;
    });
  }

  settle(id: string, input: unknown, now = new Date()): State {
    const settlement = settlementSchema.parse(input);
    return this.update(now, (state, timestamp) => {
      const attempt = state.attempts.find((entry) => entry.request.id === id);
      if (
        !attempt ||
        (attempt.outcome !== "reserved" && attempt.outcome !== "dispatched")
      ) {
        throw new Error(
          "Attempt is terminal or requires explicit manual reconciliation.",
        );
      }
      attempt.outcome = settlement.outcome;
      attempt.settledAt = timestamp;
      if (settlement.outcome !== "ambiguous")
        attempt.actualCostMicroEuro = settlement.actualCostMicroEuro;
      // Persist unexpected real-cost overruns; the next reservation/dispatch fails closed.
    });
  }

  status(now = new Date()) {
    const state = this.read();
    let budgetOverrun = false;
    try {
      assertBudget(state);
    } catch {
      budgetOverrun = true;
    }
    return {
      version: state.version,
      manifestHash: state.manifestHash,
      usage: usage(state),
      budgetOverrun,
      outstandingAttempts: state.attempts.filter((attempt) =>
        ["reserved", "dispatched", "ambiguous"].includes(attempt.outcome),
      ).length,
      writerReconciliationRequired: (() => {
        try {
          lstatSync(this.lockPath);
          return true;
        } catch (error) {
          if (
            error instanceof Error &&
            "code" in error &&
            error.code === "ENOENT"
          )
            return false;
          throw error;
        }
      })(),
      observation: observationStatus(state, now.toISOString()),
      liveIntegration: "not-implemented",
    };
  }
}
