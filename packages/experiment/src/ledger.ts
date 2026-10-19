import { createHash } from "node:crypto";
import {
  type Attempt,
  branches,
  type Manifest,
  type State,
  stateSchema,
} from "./schema.js";

export function manifestHash(manifest: Manifest): string {
  return createHash("sha256").update(JSON.stringify(manifest)).digest("hex");
}

const berlinFormatter = new Intl.DateTimeFormat("sv-SE", {
  timeZone: "Europe/Berlin",
});
export function berlinDate(timestamp: string): string {
  return berlinFormatter.format(new Date(timestamp));
}
function addDays(date: string, days: number): string {
  return new Date(Date.parse(`${date}T00:00:00Z`) + days * 86_400_000)
    .toISOString()
    .slice(0, 10);
}
export function windowEnd(state: State): string | null {
  return state.startedAt === null
    ? null
    : addDays(berlinDate(state.startedAt), 6);
}
export function effectiveCost(attempt: Attempt): number {
  return attempt.actualCostMicroEuro ?? attempt.request.upperCostMicroEuro;
}
function effectiveTokens(attempt: Attempt) {
  return {
    input:
      attempt.actualModelUsage?.inputTokens ?? attempt.request.upperInputTokens,
    output: attempt.actualModelUsage
      ? attempt.actualModelUsage.candidateTokens +
        attempt.actualModelUsage.thoughtTokens
      : attempt.request.upperOutputTokens,
  };
}
export function tokenOverrun(state: State): boolean {
  const counts = usage(state);
  return (
    counts.effectiveInputTokens > 500_000 ||
    counts.effectiveOutputTokens > 100_000 ||
    state.attempts.some((attempt) => {
      const tokens = effectiveTokens(attempt);
      return (
        tokens.input > attempt.request.upperInputTokens ||
        tokens.output > attempt.request.upperOutputTokens
      );
    })
  );
}
export function assertNoTokenOverrun(state: State): void {
  if (tokenOverrun(state))
    throw new Error("Observed model token overrun requires reconciliation.");
}
export function usage(state: State) {
  const costMicroEuro = Object.fromEntries(
    branches.map((branch) => [
      branch,
      state.attempts
        .filter((attempt) => attempt.request.branch === branch)
        .reduce((sum, attempt) => sum + effectiveCost(attempt), 0),
    ]),
  );
  return {
    attempts: Object.fromEntries(
      ["search", "structured", "http", "llm", "gmail"].map((kind) => [
        kind,
        state.attempts.filter((attempt) => attempt.request.kind === kind)
          .length,
      ]),
    ),
    upperInputTokens: state.attempts.reduce(
      (sum, attempt) => sum + attempt.request.upperInputTokens,
      0,
    ),
    upperOutputTokens: state.attempts.reduce(
      (sum, attempt) => sum + attempt.request.upperOutputTokens,
      0,
    ),
    effectiveInputTokens: state.attempts.reduce(
      (sum, attempt) => sum + effectiveTokens(attempt).input,
      0,
    ),
    effectiveOutputTokens: state.attempts.reduce(
      (sum, attempt) => sum + effectiveTokens(attempt).output,
      0,
    ),
    upperRecords: state.attempts.reduce(
      (sum, attempt) => sum + attempt.request.upperRecords,
      0,
    ),
    costMicroEuro,
  };
}
export function assertResourceCaps(
  state: State,
  preserveObservedOverruns = false,
): void {
  const counts = usage(state);
  const wholeCaps = { search: 100, structured: 100, http: 200, llm: 100 };
  for (const [kind, cap] of Object.entries(wholeCaps)) {
    if ((counts.attempts[kind] ?? 0) > cap)
      throw new Error(`Whole-experiment ${kind} cap reached.`);
  }
  for (const date of new Set(
    state.attempts.map((attempt) => berlinDate(attempt.reservedAt)),
  )) {
    for (const [kind, cap] of Object.entries({
      search: 40,
      http: 40,
      llm: 30,
    })) {
      if (
        state.attempts.filter(
          (attempt) =>
            attempt.request.kind === kind &&
            berlinDate(attempt.reservedAt) === date,
        ).length > cap
      ) {
        throw new Error(`Daily ${kind} cap reached.`);
      }
    }
  }
  // Validate admission bounds without discarding an unexpected observed overrun.
  // Reserve/dispatch use actual effective totals and separately block any overrun.
  const input = preserveObservedOverruns
    ? state.attempts.reduce(
        (sum, attempt) =>
          sum +
          Math.min(
            effectiveTokens(attempt).input,
            attempt.request.upperInputTokens,
          ),
        0,
      )
    : counts.effectiveInputTokens;
  const output = preserveObservedOverruns
    ? state.attempts.reduce(
        (sum, attempt) =>
          sum +
          Math.min(
            effectiveTokens(attempt).output,
            attempt.request.upperOutputTokens,
          ),
        0,
      )
    : counts.effectiveOutputTokens;
  if (
    input > 500_000 ||
    output > 100_000 ||
    counts.upperRecords > 400 ||
    new Set(
      state.attempts
        .map((attempt) => attempt.request.boardId)
        .filter((id) => id !== undefined),
    ).size > 5
  ) {
    throw new Error("Token, record or initial-board cap reached.");
  }
}
export function assertBudget(state: State): void {
  const costs = usage(state).costMicroEuro;
  for (const branch of branches) {
    if ((costs[branch] ?? 0) > state.config.allocationsMicroEuro[branch]) {
      throw new Error(`Budget exhausted or overrun: ${branch}.`);
    }
  }
}
export function validateState(input: unknown, manifest: Manifest): State {
  const state = stateSchema.parse(input);
  if (state.manifestHash !== manifestHash(manifest))
    throw new Error("Frozen manifest changed; do not reset the experiment.");
  if (
    new Set(state.attempts.map((attempt) => attempt.request.id)).size !==
      state.attempts.length ||
    state.updatedAt < state.createdAt
  ) {
    throw new Error("Invalid ledger identity or timestamps.");
  }
  const discoveryDispatches = state.attempts
    .filter(
      (attempt) =>
        attempt.request.branch === "discovery" &&
        attempt.dispatchedAt !== undefined,
    )
    .map((attempt) => attempt.dispatchedAt)
    .filter((timestamp) => timestamp !== undefined)
    .sort();
  if (state.startedAt !== (discoveryDispatches[0] ?? null))
    throw new Error("Invalid discovery start clock.");
  let gmailBlocked = false;
  let previousReservedAt = state.createdAt;
  for (const attempt of state.attempts) {
    if (
      attempt.reservedAt < previousReservedAt ||
      attempt.reservedAt > state.updatedAt ||
      (attempt.dispatchedAt !== undefined &&
        (attempt.dispatchedAt > state.updatedAt ||
          berlinDate(attempt.dispatchedAt) !==
            berlinDate(attempt.reservedAt))) ||
      (attempt.settledAt !== undefined &&
        attempt.settledAt > state.updatedAt) ||
      (attempt.request.queryId !== undefined &&
        !manifest.queries.some((query) => query.id === attempt.request.queryId))
    ) {
      throw new Error("Invalid ledger dates or query reference.");
    }
    previousReservedAt = attempt.reservedAt;
    if (attempt.request.kind === "gmail") {
      if (gmailBlocked)
        throw new Error(
          "Gmail creation requires reconciliation or has already succeeded.",
        );
      gmailBlocked = attempt.outcome !== "failed";
    }
    const end = windowEnd(state);
    if (end !== null && berlinDate(attempt.reservedAt) > end)
      throw new Error("Attempt outside the observation window.");
  }
  assertResourceCaps(state, true);
  return state;
}
export function observationStatus(state: State, now: string) {
  const days = [
    ...new Set(
      state.attempts
        .filter(
          (attempt) =>
            attempt.request.branch === "discovery" &&
            attempt.dispatchedAt !== undefined,
        )
        .map((attempt) =>
          berlinDate(attempt.dispatchedAt ?? attempt.reservedAt),
        ),
    ),
  ].sort();
  const end = windowEnd(state);
  const today = berlinDate(now);
  const next =
    state.startedAt === null
      ? null
      : days.includes(today)
        ? addDays(today, 1)
        : today;
  return {
    startedAt: state.startedAt,
    endBerlinDate: end,
    discoveryAttemptDays: days,
    requiredCalendarDays: 7,
    missedBerlinDates:
      state.startedAt === null
        ? []
        : Array.from({ length: 7 }, (_, index) =>
            addDays(berlinDate(state.startedAt ?? state.createdAt), index),
          ).filter((date) => date < today && !days.includes(date)),
    nextDueBerlinDate:
      end !== null && next !== null && next <= end ? next : null,
    window:
      end === null ? "not-started" : today > end ? "elapsed" : "incomplete",
    benchmark: "not-evaluated",
  };
}
