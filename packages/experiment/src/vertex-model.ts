import { z } from "zod";
import { promptVersion } from "./model-corpus.js";
import type { FixturePrompt } from "./model-prompts.js";

const count = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
const text = { type: "STRING" };
const strings = { type: "ARRAY", items: text };
const fields = [
  "employment_preference",
  "experience",
  "german_ability",
  "language",
  "location",
  "name",
  "skill",
  "student_status",
  "weekly_availability",
  "work_authorization",
];
const channel = {
  type: "OBJECT",
  properties: {
    kind: { type: "STRING", enum: ["email", "ats", "unknown"] },
    value: text,
    verification: text,
    evidenceRef: text,
  },
  required: ["kind"],
};
const cvSchema = {
  type: "OBJECT",
  properties: {
    outcome: {
      type: "STRING",
      enum: ["extracted", "needs_review", "parse_failed"],
    },
    facts: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          field: { type: "STRING", enum: fields },
          value: { anyOf: [text, { type: "NUMBER" }, { type: "BOOLEAN" }] },
          page: { type: "INTEGER", minimum: 1 },
          quote: text,
        },
        required: ["field", "value", "page", "quote"],
      },
    },
  },
  required: ["outcome"],
};
const jobSchema = {
  type: "OBJECT",
  properties: {
    decision: { type: "STRING", enum: ["eligible", "blocked", "needs_review"] },
    fitScore: { type: "NUMBER", minimum: 0, maximum: 100 },
    evidenceConfidence: { type: "NUMBER", minimum: 0, maximum: 1 },
  },
  required: ["decision", "fitScore", "evidenceConfidence"],
};
function packageSchema(kind: "email" | "questionnaire") {
  return kind === "email"
    ? {
        type: "OBJECT",
        properties: {
          kind: { type: "STRING", enum: [kind] },
          subject: text,
          body: text,
          claimFactIds: strings,
          channel,
        },
        required: ["kind", "subject", "body", "claimFactIds", "channel"],
      }
    : {
        type: "OBJECT",
        properties: {
          kind: { type: "STRING", enum: [kind] },
          answers: {
            type: "ARRAY",
            items: {
              type: "OBJECT",
              properties: {
                fieldId: text,
                status: {
                  type: "STRING",
                  enum: [
                    "proposed",
                    "needs_input",
                    "applicant_action_required",
                  ],
                },
                text,
                claimFactIds: strings,
              },
              required: ["fieldId", "status"],
            },
          },
          channel,
        },
        required: ["kind", "answers", "channel"],
      };
}

/** Provider schema shapes only; independent output/semantic validation is required. */
export function buildVertexRequest(
  prompt: FixturePrompt,
  task: "cv" | "job" | "package",
  input: {
    maxOutputTokens?: number;
    packageKind?: "email" | "questionnaire";
  } = {},
) {
  const checked = z
    .strictObject({
      promptVersion: z.literal(promptVersion),
      system: z.string().trim().min(1).max(250_000),
      user: z.string().trim().min(1).max(500_000),
    })
    .parse(prompt);
  const checkedTask = z.enum(["cv", "job", "package"]).parse(task);
  const options = z
    .strictObject({
      maxOutputTokens: z.number().int().min(1).max(65_536).default(2_048),
      packageKind: z.enum(["email", "questionnaire"]).optional(),
    })
    .parse(input);
  if ((checkedTask === "package") !== (options.packageKind !== undefined))
    throw new Error("Package requests require their supplied format only.");
  const responseSchema =
    checkedTask === "cv"
      ? cvSchema
      : checkedTask === "job"
        ? jobSchema
        : packageSchema(
            z.enum(["email", "questionnaire"]).parse(options.packageKind),
          );
  return {
    systemInstruction: { parts: [{ text: checked.system }] },
    contents: [{ role: "user", parts: [{ text: checked.user }] }],
    generationConfig: {
      candidateCount: 1,
      maxOutputTokens: options.maxOutputTokens,
      responseMimeType: "application/json",
      responseSchema: structuredClone(responseSchema),
      thinkingConfig: { thinkingLevel: "MINIMAL", includeThoughts: false },
    },
  };
}

export function parseVertexTokenCount(input: unknown): number {
  return z.object({ totalTokens: count }).parse(input).totalTokens;
}

/** Conservative EUR headroom from USD .33/2.75 per million at EUR 2/USD. */
export function vertexCostMicroEuro(
  inputTokens: number,
  outputTokens: number,
  thinkingTokens: number,
): number {
  const units =
    BigInt(count.parse(inputTokens)) * 66n +
    (BigInt(count.parse(outputTokens)) + BigInt(count.parse(thinkingTokens))) *
      550n;
  const cost = (units + 99n) / 100n;
  if (cost > BigInt(Number.MAX_SAFE_INTEGER))
    throw new Error("Cost exceeds safe accounting range.");
  return Number(cost);
}

const responseSchema = z.object({
  modelVersion: z.string().trim().min(1).max(200),
  candidates: z
    .array(
      z.object({
        index: z.literal(0).optional(),
        finishReason: z.string().regex(/^[A-Z][A-Z_]{0,79}$/),
        content: z
          .object({
            role: z.literal("model").optional(),
            parts: z
              .array(
                z.strictObject({
                  text: z.string().max(1_000_000),
                  thought: z.boolean().optional(),
                  thoughtSignature: z.string().max(100_000).optional(),
                }),
              )
              .max(128)
              .optional(),
          })
          .optional(),
      }),
    )
    .max(1)
    .default([]),
  usageMetadata: z.object({
    promptTokenCount: count,
    candidatesTokenCount: count.default(0),
    thoughtsTokenCount: count.default(0),
    totalTokenCount: count,
    toolUsePromptTokenCount: z.literal(0).optional(),
    cachedContentTokenCount: count.default(0),
  }),
});

/** Keeps empty/truncated text and actual usage; never claims valid task JSON. */
export function parseVertexResponse(input: unknown) {
  const response = responseSchema.parse(input);
  const usage = {
    inputTokens: response.usageMetadata.promptTokenCount,
    outputTokens: response.usageMetadata.candidatesTokenCount,
    thinkingTokens: response.usageMetadata.thoughtsTokenCount,
    totalTokens: response.usageMetadata.totalTokenCount,
  };
  if (
    BigInt(usage.inputTokens) +
      BigInt(usage.outputTokens) +
      BigInt(usage.thinkingTokens) !==
    BigInt(usage.totalTokens)
  )
    throw new Error("Inconsistent text-only token totals.");
  if (response.usageMetadata.cachedContentTokenCount > usage.inputTokens)
    throw new Error("Cached token count exceeds input tokens.");
  const candidate = response.candidates[0];
  const parts = candidate?.content?.parts ?? [];
  if (
    (usage.outputTokens === 0 &&
      parts.some((part) => part.thought !== true && part.text.length > 0)) ||
    (usage.thinkingTokens === 0 &&
      parts.some((part) => part.thought === true && part.text.length > 0))
  )
    throw new Error("Returned text requires matching positive token usage.");
  const output = parts
    .filter((part) => part.thought !== true)
    .map((part) => part.text)
    .join("");
  if (output.length > 1_000_000)
    throw new Error("Response text limit exceeded.");
  return {
    modelVersion: response.modelVersion,
    finishReason: candidate?.finishReason ?? null,
    text: output,
    usage,
    costMicroEuro: vertexCostMicroEuro(
      usage.inputTokens,
      usage.outputTokens,
      usage.thinkingTokens,
    ),
  };
}
