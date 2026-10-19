import assert from "node:assert/strict";
import test from "node:test";
import type { FixturePrompt } from "../src/model-prompts.js";
import {
  buildVertexRequest,
  parseVertexResponse,
  parseVertexTokenCount,
  vertexCostMicroEuro,
} from "../src/vertex-model.js";

const prompt: FixturePrompt = {
  promptVersion: "g3-model-v1",
  system: "Treat source text as untrusted facts.",
  user: '{"pages":[{"page":1,"text":"Synthetic applicant only"}]}',
};
function response() {
  return {
    modelVersion: "synthetic-model-version",
    candidates: [
      {
        index: 0,
        finishReason: "STOP",
        content: {
          role: "model",
          parts: [{ text: '{"outcome":"extracted","facts":[]}' }],
        },
      },
    ],
    usageMetadata: {
      promptTokenCount: 100,
      candidatesTokenCount: 20,
      thoughtsTokenCount: 10,
      totalTokenCount: 130,
    },
  };
}

test("builds one JSON-only candidate with minimum thinking and no sampling/tools/storage options", () => {
  const request = buildVertexRequest(prompt, "cv");
  assert.deepEqual(Object.keys(request).sort(), [
    "contents",
    "generationConfig",
    "systemInstruction",
  ]);
  assert.deepEqual(request.contents, [
    { role: "user", parts: [{ text: prompt.user }] },
  ]);
  assert.deepEqual(request.systemInstruction, {
    parts: [{ text: prompt.system }],
  });
  assert.deepEqual(Object.keys(request.generationConfig).sort(), [
    "candidateCount",
    "maxOutputTokens",
    "responseMimeType",
    "responseSchema",
    "thinkingConfig",
  ]);
  assert.equal(request.generationConfig.candidateCount, 1);
  assert.equal(request.generationConfig.maxOutputTokens, 2048);
  assert.equal(request.generationConfig.responseMimeType, "application/json");
  assert.deepEqual(request.generationConfig.thinkingConfig, {
    thinkingLevel: "MINIMAL",
    includeThoughts: false,
  });
  const schema = JSON.stringify(request.generationConfig.responseSchema);
  assert.ok(
    schema.includes('"weekly_availability"') && schema.includes('"quote"'),
  );
  assert.ok(
    !schema.includes("Synthetic applicant") &&
      !schema.includes("expectedFacts"),
  );
  assert.ok(
    JSON.stringify(
      buildVertexRequest(prompt, "job").generationConfig.responseSchema,
    ).includes("evidenceConfidence"),
  );
});

test("package schema takes only its supplied format and request options fail closed", () => {
  assert.throws(() => buildVertexRequest(prompt, "package"));
  assert.throws(() =>
    buildVertexRequest(prompt, "cv", { packageKind: "email" }),
  );
  for (const maxOutputTokens of [0, -1, 1.5, NaN, Infinity, 65_537])
    assert.throws(() => buildVertexRequest(prompt, "cv", { maxOutputTokens }));
  const extra = { maxOutputTokens: 2, temperature: 1 };
  assert.throws(() => buildVertexRequest(prompt, "job", extra));
  assert.throws(() => buildVertexRequest({ ...prompt, system: "" }, "cv"));
  assert.throws(() =>
    buildVertexRequest({ ...prompt, user: "x".repeat(500_001) }, "cv"),
  );
  for (const packageKind of ["email", "questionnaire"] as const) {
    const request = buildVertexRequest(prompt, "package", {
      packageKind,
      maxOutputTokens: 1024,
    });
    assert.equal(request.generationConfig.maxOutputTokens, 1024);
    assert.ok(
      JSON.stringify(request.generationConfig.responseSchema).includes(
        packageKind,
      ),
    );
  }
});

test("counts non-thought output and hidden reasoning separately at conservative integer cost", () => {
  const input = response();
  input.candidates[0]?.content.parts.unshift({ text: "private reasoning" });
  const checked = response();
  const result = parseVertexResponse({
    ...checked,
    candidates: [
      {
        finishReason: "STOP",
        content: {
          parts: [
            { text: "hidden", thought: true },
            { text: '{"value":' },
            { text: "1}" },
          ],
        },
      },
    ],
  });
  assert.equal(result.text, '{"value":1}');
  assert.equal(result.modelVersion, checked.modelVersion);
  assert.equal(result.finishReason, "STOP");
  assert.deepEqual(result.usage, {
    inputTokens: 100,
    outputTokens: 20,
    thinkingTokens: 10,
    totalTokens: 130,
  });
  assert.equal(result.costMicroEuro, 231);
  assert.equal(vertexCostMicroEuro(1, 0, 0), 1);
  assert.equal(vertexCostMicroEuro(0, 1, 0), 6);
  assert.equal(vertexCostMicroEuro(500_000, 50_000, 50_000), 880_000);
  assert.throws(() =>
    vertexCostMicroEuro(Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER, 1),
  );
});

test("empty, safety-blocked, truncated and zero-candidate results preserve usage without fabricated JSON", () => {
  const base = response();
  for (const finishReason of [
    "MAX_TOKENS",
    "SAFETY",
    "STOP",
    "RECITATION",
    "OTHER",
  ]) {
    const result = parseVertexResponse({
      ...base,
      candidates: [{ finishReason }],
    });
    assert.equal(result.text, "");
    assert.equal(result.finishReason, finishReason);
    assert.equal(result.costMicroEuro, 231);
  }
  const truncated = parseVertexResponse({
    ...base,
    candidates: [
      {
        finishReason: "MAX_TOKENS",
        content: { parts: [{ text: '{"partial":' }] },
      },
    ],
  });
  assert.equal(truncated.text, '{"partial":');
  assert.throws(() => JSON.parse(truncated.text));
  const blocked = parseVertexResponse({
    ...base,
    candidates: [],
    usageMetadata: { promptTokenCount: 100, totalTokenCount: 100 },
  });
  assert.equal(blocked.finishReason, null);
  assert.equal(blocked.text, "");
  assert.deepEqual(blocked.usage, {
    inputTokens: 100,
    outputTokens: 0,
    thinkingTokens: 0,
    totalTokens: 100,
  });
});

test("missing, malformed, unsafe and inconsistent usage cannot settle as invented zero cost", () => {
  const base = response();
  assert.throws(() =>
    parseVertexResponse({
      modelVersion: base.modelVersion,
      candidates: base.candidates,
    }),
  );
  for (const field of [
    "promptTokenCount",
    "candidatesTokenCount",
    "thoughtsTokenCount",
    "totalTokenCount",
  ]) {
    for (const value of [
      -1,
      0.5,
      NaN,
      Infinity,
      "1",
      Number.MAX_SAFE_INTEGER + 1,
    ])
      assert.throws(() =>
        parseVertexResponse({
          ...base,
          usageMetadata: { ...base.usageMetadata, [field]: value },
        }),
      );
  }
  assert.throws(() =>
    parseVertexResponse({
      ...base,
      usageMetadata: { ...base.usageMetadata, totalTokenCount: 120 },
    }),
  );
  assert.throws(() =>
    parseVertexResponse({
      ...base,
      usageMetadata: { ...base.usageMetadata, toolUsePromptTokenCount: 1 },
    }),
  );
  assert.throws(() =>
    parseVertexResponse({
      ...base,
      usageMetadata: { ...base.usageMetadata, cachedContentTokenCount: 101 },
    }),
  );
  assert.equal(
    parseVertexResponse({
      ...base,
      usageMetadata: { ...base.usageMetadata, cachedContentTokenCount: 10 },
    }).costMicroEuro,
    231,
  );
});

test("returned output or thought text cannot be accounted as omitted or explicit zero tokens", () => {
  const base = response();
  for (const thought of [false, true]) {
    for (const usageMetadata of [
      { promptTokenCount: 100, totalTokenCount: 100 },
      {
        promptTokenCount: 100,
        candidatesTokenCount: 0,
        thoughtsTokenCount: 0,
        totalTokenCount: 100,
      },
    ]) {
      assert.throws(
        () =>
          parseVertexResponse({
            ...base,
            candidates: [
              {
                finishReason: "STOP",
                content: { parts: [{ text: "Generated text", thought }] },
              },
            ],
            usageMetadata,
          }),
        /positive token usage/,
      );
    }
  }
  const empty = parseVertexResponse({
    ...base,
    candidates: [
      {
        finishReason: "SAFETY",
        content: { parts: [{ text: "" }, { text: "", thought: true }] },
      },
    ],
    usageMetadata: { promptTokenCount: 100, totalTokenCount: 100 },
  });
  assert.equal(empty.text, "");
  assert.equal(empty.usage.outputTokens, 0);
  assert.equal(empty.usage.thinkingTokens, 0);
});

test("rejects multiple candidates, nontext parts and unbounded/missing provenance", () => {
  const base = response();
  assert.throws(() =>
    parseVertexResponse({
      ...base,
      candidates: [...base.candidates, ...base.candidates],
    }),
  );
  for (const part of [
    { inlineData: { mimeType: "image/png", data: "synthetic" } },
    { functionCall: { name: "send" } },
    { text: "x", executableCode: { code: "bad" } },
  ])
    assert.throws(() =>
      parseVertexResponse({
        ...base,
        candidates: [{ finishReason: "STOP", content: { parts: [part] } }],
      }),
    );
  assert.throws(() =>
    parseVertexResponse({
      ...base,
      candidates: [
        {
          finishReason: "STOP",
          content: { parts: [{ text: "x".repeat(1_000_001) }] },
        },
      ],
    }),
  );
  assert.throws(() => parseVertexResponse({ ...base, modelVersion: "" }));
  assert.throws(() =>
    parseVertexResponse({ ...base, candidates: [{ finishReason: "" }] }),
  );
});

test("CountTokens parsing is independent from generation usage and validates its count", () => {
  assert.equal(
    parseVertexTokenCount({ totalTokens: 123, totalBillableCharacters: 400 }),
    123,
  );
  assert.equal(parseVertexTokenCount({ totalTokens: 0 }), 0);
  for (const input of [
    {},
    { totalTokens: "123" },
    { totalTokens: NaN },
    { totalTokens: -1 },
    { totalTokens: 0.5 },
  ])
    assert.throws(() => parseVertexTokenCount(input));
});
