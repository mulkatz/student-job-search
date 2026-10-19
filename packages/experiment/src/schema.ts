import { z } from "zod";

export const branches = ["discovery", "extraction", "model", "gmail"] as const;
export const kinds = ["search", "structured", "http", "llm", "gmail"] as const;
export const integer = z
  .number()
  .int()
  .nonnegative()
  .max(Number.MAX_SAFE_INTEGER);
const identifier = z.string().regex(/^[a-zA-Z0-9_-]{1,80}$/);

export const manifestSchema = z
  .strictObject({
    version: z.literal(1),
    queries: z
      .array(
        z.strictObject({
          id: identifier,
          stream: z.enum(["berlin", "germany_remote"]),
          query: z.string().trim().min(1).max(500),
        }),
      )
      .length(20),
  })
  .superRefine((manifest, context) => {
    if (
      new Set(manifest.queries.map((query) => query.id)).size !== 20 ||
      new Set(manifest.queries.map((query) => query.query.trim().toLowerCase()))
        .size !== 20 ||
      manifest.queries.filter((query) => query.stream === "berlin").length !==
        10
    ) {
      context.addIssue({
        code: "custom",
        message: "Require twenty unique queries, ten per stream.",
      });
    }
  });

export const configSchema = z
  .strictObject({
    version: z.literal(1),
    allocationsMicroEuro: z.strictObject({
      discovery: integer,
      extraction: integer,
      model: integer,
      gmail: integer,
    }),
  })
  .refine(
    (config) =>
      Object.values(config.allocationsMicroEuro).reduce(
        (sum, value) => sum + value,
        0,
      ) <= 5_000_000,
    "Allocations must fit within EUR 5.",
  );

export const requestSchema = z
  .strictObject({
    id: identifier,
    branch: z.enum(branches),
    kind: z.enum(kinds),
    upperCostMicroEuro: integer,
    upperInputTokens: integer,
    upperOutputTokens: integer,
    upperRecords: integer,
    queryId: identifier.optional(),
    boardId: identifier.optional(),
  })
  .superRefine((request, context) => {
    const compatible =
      request.kind === "search" || request.kind === "structured"
        ? request.branch === "discovery"
        : request.kind === "http"
          ? request.branch === "discovery" || request.branch === "extraction"
          : request.branch === (request.kind === "llm" ? "model" : "gmail");
    if (
      !compatible ||
      (request.kind === "search") !== (request.queryId !== undefined) ||
      (request.kind === "structured") !== (request.boardId !== undefined) ||
      (request.kind !== "llm" &&
        (request.upperInputTokens !== 0 || request.upperOutputTokens !== 0))
    ) {
      context.addIssue({
        code: "custom",
        message: "Invalid operation dimensions or branch.",
      });
    }
  });

const timestamp = z.iso.datetime({ precision: 3 });
export const attemptSchema = z
  .strictObject({
    request: requestSchema,
    reservedAt: timestamp,
    dispatchedAt: timestamp.optional(),
    outcome: z.enum([
      "reserved",
      "dispatched",
      "succeeded",
      "failed",
      "ambiguous",
    ]),
    settledAt: timestamp.optional(),
    actualCostMicroEuro: integer.optional(),
  })
  .superRefine((attempt, context) => {
    const terminal =
      attempt.outcome === "succeeded" || attempt.outcome === "failed";
    if (
      terminal !== (attempt.actualCostMicroEuro !== undefined) ||
      (terminal || attempt.outcome === "ambiguous") !==
        (attempt.settledAt !== undefined) ||
      (attempt.outcome === "reserved" && attempt.dispatchedAt !== undefined) ||
      ((attempt.outcome === "dispatched" || attempt.outcome === "succeeded") &&
        attempt.dispatchedAt === undefined) ||
      (attempt.dispatchedAt !== undefined &&
        attempt.dispatchedAt < attempt.reservedAt) ||
      (attempt.settledAt !== undefined &&
        attempt.settledAt < (attempt.dispatchedAt ?? attempt.reservedAt)) ||
      (attempt.dispatchedAt === undefined &&
        terminal &&
        attempt.actualCostMicroEuro !== 0)
    ) {
      context.addIssue({
        code: "custom",
        message: "Inconsistent attempt lifecycle.",
      });
    }
  });

export const stateSchema = z.strictObject({
  version: z.literal(1),
  manifestHash: z.string().regex(/^[a-f0-9]{64}$/),
  config: configSchema,
  createdAt: timestamp,
  updatedAt: timestamp,
  startedAt: timestamp.nullable(),
  attempts: z.array(attemptSchema),
});
export type Manifest = z.infer<typeof manifestSchema>;
export type ExperimentConfig = z.infer<typeof configSchema>;
export type Request = z.infer<typeof requestSchema>;
export type Attempt = z.infer<typeof attemptSchema>;
export type State = z.infer<typeof stateSchema>;
