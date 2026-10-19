import { createHash } from "node:crypto";
import { z } from "zod";

export const promptVersion = "g3-model-v1";
export const evaluatorVersion = "g3-score-v1";
const id = z.string().regex(/^[a-zA-Z0-9_-]{1,80}$/);
export const factValueSchema = z.union([
  z.string().min(1).max(2000),
  z.number().finite(),
  z.boolean(),
]);
const factSchema = z.strictObject({ id, field: id, value: factValueSchema });
const pending = z.strictObject({ status: z.literal("pending") });
const syntheticEmail = z
  .email()
  .refine(
    (value) => value.toLowerCase().endsWith(".invalid"),
    "Use a synthetic .invalid address.",
  );
const syntheticUrl = z.url().refine((value) => {
  const url = new URL(value);
  return (
    url.protocol === "https:" &&
    url.hostname.endsWith(".invalid") &&
    !url.username &&
    !url.password
  );
}, "Use a synthetic HTTPS .invalid URL.");
export const channelSchema = z.discriminatedUnion("kind", [
  z.strictObject({
    kind: z.literal("email"),
    value: syntheticEmail,
    verification: z.literal("synthetic_fixture"),
    evidenceRef: z.string().min(1).max(300),
  }),
  z.strictObject({
    kind: z.literal("ats"),
    value: syntheticUrl,
    verification: z.literal("synthetic_fixture"),
    evidenceRef: z.string().min(1).max(300),
  }),
  z.strictObject({ kind: z.literal("unknown") }),
]);

const proposalText = z
  .string()
  .min(1)
  .max(30_000)
  .refine((value) => value.trim().length > 0, "Proposal text cannot be blank.");
export const packageProposalSchema = z.discriminatedUnion("kind", [
  z.strictObject({
    kind: z.literal("email"),
    subject: proposalText,
    body: proposalText,
    claimFactIds: z.array(id).min(1).max(30),
    channel: channelSchema,
  }),
  z.strictObject({
    kind: z.literal("questionnaire"),
    answers: z
      .array(
        z.discriminatedUnion("status", [
          z.strictObject({
            fieldId: id,
            status: z.literal("proposed"),
            text: proposalText,
            claimFactIds: z.array(id).min(1).max(30),
          }),
          z.strictObject({
            fieldId: id,
            status: z.enum(["needs_input", "applicant_action_required"]),
          }),
        ]),
      )
      .min(1)
      .max(12),
    channel: channelSchema,
  }),
]);
export function packageProposalHash(input: unknown): string {
  return createHash("sha256")
    .update(JSON.stringify(packageProposalSchema.parse(input)))
    .digest("hex");
}
const packageFormatSchema = z.discriminatedUnion("kind", [
  z.strictObject({ kind: z.literal("email") }),
  z.strictObject({
    kind: z.literal("questionnaire"),
    fields: z
      .array(
        z.strictObject({
          id,
          prompt: z.string().min(1).max(2000),
          required: z.boolean(),
          sourceQuote: z.string().min(1).max(2000),
          answerPolicy: z.enum([
            "approved_facts",
            "needs_input",
            "applicant_action_required",
          ]),
          factIds: z.array(id).max(30),
        }),
      )
      .min(1)
      .max(12),
  }),
]);

export const modelCorpusSchema = z.strictObject({
  version: z.literal(1),
  synthetic: z.literal(true),
  approval: pending,
  profiles: z
    .array(
      z.strictObject({
        id,
        ownerId: id,
        candidateId: id,
        version: z.literal(1),
        approval: pending,
        facts: z.array(factSchema).min(1).max(30),
      }),
    )
    .length(3),
  documents: z
    .array(
      z.strictObject({
        id,
        profileId: id,
        kind: z.enum(["text", "scan_only", "malformed"]),
        fileName: z.string().regex(/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,79}\.pdf$/),
        pages: z
          .array(
            z.strictObject({
              heading: z.string().max(200),
              lines: z.array(z.string().max(2000)).max(40),
            }),
          )
          .max(10),
        expectedOutcome: z.enum(["extracted", "needs_review", "parse_failed"]),
        expectedFacts: z
          .array(
            z.strictObject({
              factId: id,
              page: z.number().int().positive(),
              quote: z.string().min(1).max(2000),
            }),
          )
          .max(30),
      }),
    )
    .length(5),
  jobs: z
    .array(
      z.strictObject({
        id,
        profileId: id,
        rawText: z.string().trim().min(1).max(30_000),
        expectedDecision: z.enum(["eligible", "blocked", "needs_review"]),
        decisiveEvidence: z
          .array(
            z.strictObject({
              field: id,
              status: z.enum(["confirmed", "unknown", "conflicting"]),
              value: factValueSchema.optional(),
              quote: z.string().min(1).max(2000).optional(),
            }),
          )
          .min(1)
          .max(20),
        channel: channelSchema,
        injectionMarker: z.string().min(1).max(300).optional(),
      }),
    )
    .length(20),
  packages: z
    .array(
      z.strictObject({
        id,
        jobId: id,
        profileId: id,
        factIds: z.array(id).min(1).max(30),
        format: packageFormatSchema,
      }),
    )
    .length(5),
});
export type ModelCorpus = z.infer<typeof modelCorpusSchema>;

function unique(values: string[], label: string): void {
  if (new Set(values).size !== values.length)
    throw new Error(`Duplicate ${label}.`);
}

export function validateModelCorpus(input: unknown): ModelCorpus {
  const corpus = modelCorpusSchema.parse(input);
  for (const [label, rows] of [
    ["profile", corpus.profiles],
    ["document", corpus.documents],
    ["job", corpus.jobs],
    ["package", corpus.packages],
  ] as const)
    unique(
      rows.map((row) => row.id),
      label,
    );
  unique(
    corpus.documents.map((document) => document.fileName),
    "document filename",
  );
  unique(
    corpus.profiles.map((profile) => profile.ownerId),
    "synthetic owner",
  );
  unique(
    corpus.profiles.map((profile) => profile.candidateId),
    "synthetic candidate",
  );
  for (const profile of corpus.profiles)
    unique(
      profile.facts.map((fact) => fact.id),
      "profile fact",
    );
  const profileFor = (profileId: string) => {
    const profile = corpus.profiles.find((entry) => entry.id === profileId);
    if (!profile) throw new Error("Unknown profile reference.");
    return profile;
  };
  const textDocuments = corpus.documents.filter(
    (document) => document.kind === "text",
  );
  if (
    textDocuments.length !== 3 ||
    corpus.documents.filter((document) => document.kind === "scan_only")
      .length !== 1 ||
    corpus.documents.filter((document) => document.kind === "malformed")
      .length !== 1 ||
    new Set(textDocuments.map((document) => document.profileId)).size !== 3
  )
    throw new Error(
      "Require three textual profiles, one scan and one malformed document.",
    );
  for (const document of corpus.documents) {
    const profile = profileFor(document.profileId);
    unique(
      document.expectedFacts.map((fact) => fact.factId),
      "expected fact",
    );
    if (document.kind === "text") {
      if (
        document.expectedOutcome !== "extracted" ||
        document.pages.length === 0 ||
        document.expectedFacts.length !== profile.facts.length
      )
        throw new Error("Text documents require positive extraction evidence.");
    } else if (
      document.expectedOutcome !==
        (document.kind === "scan_only" ? "needs_review" : "parse_failed") ||
      document.expectedFacts.length !== 0 ||
      (document.kind === "malformed" && document.pages.length !== 0)
    )
      throw new Error("Invalid failure/review document expectation.");
    for (const expected of document.expectedFacts) {
      const page = document.pages[expected.page - 1];
      if (
        !profile.facts.some((fact) => fact.id === expected.factId) ||
        !page ||
        ![page.heading, ...page.lines].join("\n").includes(expected.quote)
      )
        throw new Error("Expected fact lacks a valid profile/page quote.");
    }
  }
  for (const [decision, count] of [
    ["eligible", 10],
    ["blocked", 5],
    ["needs_review", 5],
  ] as const)
    if (
      corpus.jobs.filter((job) => job.expectedDecision === decision).length !==
      count
    )
      throw new Error("Require a 10/5/5 labeled job sample.");
  if (
    !["email", "ats", "unknown"].every((kind) =>
      corpus.jobs.some((job) => job.channel.kind === kind),
    ) ||
    !corpus.jobs.some((job) => job.injectionMarker !== undefined)
  )
    throw new Error("Include channel variety and injection cases.");
  for (const job of corpus.jobs) {
    profileFor(job.profileId);
    if (
      job.channel.kind !== "unknown" &&
      !job.rawText.includes(job.channel.value)
    )
      throw new Error(
        "Synthetic application channel is absent from source text.",
      );
    if (
      job.injectionMarker !== undefined &&
      !job.rawText.includes(job.injectionMarker)
    )
      throw new Error("Injection marker absent from source text.");
    for (const evidence of job.decisiveEvidence) {
      if (
        (evidence.status === "confirmed" &&
          (evidence.value === undefined || evidence.quote === undefined)) ||
        (evidence.status === "unknown" && evidence.value !== undefined) ||
        (evidence.quote !== undefined && !job.rawText.includes(evidence.quote))
      )
        throw new Error("Invalid decisive source evidence.");
    }
  }
  if (
    corpus.packages.filter((item) => item.format.kind === "email").length !== 2
  )
    throw new Error("Require two email and three questionnaire proposals.");
  for (const item of corpus.packages) {
    const profile = profileFor(item.profileId);
    const job = corpus.jobs.find((entry) => entry.id === item.jobId);
    unique(item.factIds, "package fact");
    if (
      !job ||
      job.profileId !== profile.id ||
      job.expectedDecision !== "eligible" ||
      job.channel.kind === "unknown" ||
      item.factIds.some(
        (factId) => !profile.facts.some((fact) => fact.id === factId),
      )
    )
      throw new Error("Invalid package/profile/fact/channel reference.");
    if (item.format.kind === "email" && job.channel.kind !== "email")
      throw new Error("Email proposals require a synthetic email route.");
    if (item.format.kind === "questionnaire") {
      unique(
        item.format.fields.map((field) => field.id),
        "questionnaire field",
      );
      for (const field of item.format.fields) {
        unique(field.factIds, "field fact");
        if (
          !job.rawText.includes(field.sourceQuote) ||
          field.prompt !== field.sourceQuote ||
          field.factIds.some((factId) => !item.factIds.includes(factId)) ||
          (field.answerPolicy === "approved_facts"
            ? field.factIds.length === 0
            : field.factIds.length !== 0)
        )
          throw new Error(
            "Invalid questionnaire source/fact/policy reference.",
          );
      }
    }
  }
  return corpus;
}

export function corpusHash(corpus: ModelCorpus): string {
  return createHash("sha256").update(JSON.stringify(corpus)).digest("hex");
}

export const operatorApprovalSchema = z.strictObject({
  version: z.literal(1),
  corpusHash: z.string().regex(/^[a-f0-9]{64}$/),
  attestation: z.literal("operator-reviewed-synthetic-facts"),
  profiles: z
    .array(
      z.strictObject({
        profileId: id,
        profileVersion: z.literal(1),
        factIds: z.array(id).min(1).max(30),
        approvedAt: z.iso.datetime(),
      }),
    )
    .min(1)
    .max(3),
});
export function validateOperatorApproval(corpus: ModelCorpus, input: unknown) {
  const approval = operatorApprovalSchema.parse(input);
  if (approval.corpusHash !== corpusHash(corpus))
    throw new Error("Stale operator approval corpus hash.");
  unique(
    approval.profiles.map((profile) => profile.profileId),
    "approved profile",
  );
  for (const approved of approval.profiles) {
    const profile = corpus.profiles.find(
      (entry) => entry.id === approved.profileId,
    );
    unique(approved.factIds, "approved fact");
    if (
      !profile ||
      profile.version !== approved.profileVersion ||
      approved.factIds.some(
        (factId) => !profile.facts.some((fact) => fact.id === factId),
      )
    )
      throw new Error("Invalid approved profile/version/fact reference.");
  }
  return approval;
}
