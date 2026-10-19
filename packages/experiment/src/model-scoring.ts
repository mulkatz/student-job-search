import { z } from "zod";
import { berlinDate } from "./ledger.js";
import {
  corpusHash,
  evaluatorVersion,
  factValueSchema,
  packageProposalHash,
  packageProposalSchema,
  promptVersion,
  validateModelCorpus,
  validateOperatorApproval,
} from "./model-corpus.js";
import { modelRequestPolicySchema } from "./schema.js";

const id = z.string().regex(/^[a-zA-Z0-9_-]{1,80}$/);
const count = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
const resultFields = {
  attemptIds: z.array(id).max(2),
  firstPassSchemaValid: z.boolean().nullable(),
  repairs: z.number().int().min(0).max(1),
};
const cvOutput = z.discriminatedUnion("outcome", [
  z.strictObject({
    outcome: z.literal("extracted"),
    facts: z
      .array(
        z.strictObject({
          field: id,
          value: factValueSchema,
          page: z.number().int().positive(),
          quote: z.string().min(1).max(2000),
        }),
      )
      .max(200),
  }),
  z.strictObject({ outcome: z.enum(["needs_review", "parse_failed"]) }),
]);
const decision = z.enum(["eligible", "blocked", "needs_review"]);
const semanticReview = z.discriminatedUnion("status", [
  z.strictObject({ status: z.literal("pending") }),
  z.strictObject({
    status: z.enum(["passed", "failed"]),
    outputSha256: z.string().regex(/^[a-f0-9]{64}$/),
  }),
]);
export const modelProvenanceSchema = z.strictObject({
  provider: z.literal("gcp-managed-gemini"),
  model: z.string().trim().min(1).max(200),
  endpoint: z
    .url()
    .refine(
      (value) =>
        new URL(value).protocol === "https:" &&
        !new URL(value).username &&
        !new URL(value).password,
      "Require an HTTPS model endpoint.",
    ),
});
const privateEvidenceRef = z
  .string()
  .min(1)
  .max(300)
  .refine(
    (value) => value.startsWith(".local/") && !value.split("/").includes(".."),
    "Usage evidence must refer to private .local/ storage.",
  );
export const modelReportSchema = z.strictObject({
  version: z.literal(1),
  corpusHash: z.string().regex(/^[a-f0-9]{64}$/),
  promptVersion: z.literal(promptVersion),
  evaluatorVersion: z.literal(evaluatorVersion),
  provenance: modelProvenanceSchema,
  modelRequestPolicy: modelRequestPolicySchema.optional(),
  cvResults: z
    .array(
      z.strictObject({ documentId: id, ...resultFields, output: cvOutput }),
    )
    .length(5),
  jobResults: z
    .array(
      z.strictObject({
        jobId: id,
        ...resultFields,
        output: z.strictObject({
          decision,
          fitScore: z.number().min(0).max(100),
          evidenceConfidence: z.number().min(0).max(1),
        }),
      }),
    )
    .length(20),
  packageResults: z
    .array(
      z.strictObject({
        packageId: id,
        ...resultFields,
        output: packageProposalSchema,
        manualReview: semanticReview,
      }),
    )
    .length(5),
  attempts: z
    .array(
      z.strictObject({
        id,
        task: z.enum(["cv", "job", "package"]),
        caseId: id,
        startedAt: z.iso.datetime(),
        inputTokens: count,
        outputTokens: count,
        thinkingTokens: count,
        costMicroEuro: count,
        usageEvidenceRef: privateEvidenceRef,
      }),
    )
    .min(1)
    .max(100),
});
export type ModelReport = z.infer<typeof modelReportSchema>;

function exactIds(actual: string[], expected: string[], label: string): void {
  if (
    new Set(actual).size !== actual.length ||
    actual.length !== expected.length ||
    actual.some((id) => !expected.includes(id))
  )
    throw new Error(`Missing, duplicate or unexpected ${label} cases.`);
}

export function scoreModelReport(
  corpusInput: unknown,
  reportInput: unknown,
  approvalInput?: unknown,
  expectedProvenanceInput?: unknown,
) {
  const corpus = validateModelCorpus(corpusInput);
  const report = modelReportSchema.parse(reportInput);
  if (report.corpusHash !== corpusHash(corpus))
    throw new Error("Report belongs to a different corpus version.");
  const approval =
    approvalInput === undefined
      ? undefined
      : validateOperatorApproval(corpus, approvalInput);
  const expectedProvenance =
    expectedProvenanceInput === undefined
      ? undefined
      : modelProvenanceSchema.parse(expectedProvenanceInput);
  if (
    expectedProvenance &&
    JSON.stringify(expectedProvenance) !== JSON.stringify(report.provenance)
  )
    throw new Error(
      "Report model/endpoint differs from the selected run configuration.",
    );
  exactIds(
    report.cvResults.map((result) => result.documentId),
    corpus.documents.map((document) => document.id),
    "CV",
  );
  exactIds(
    report.jobResults.map((result) => result.jobId),
    corpus.jobs.map((job) => job.id),
    "job",
  );
  exactIds(
    report.packageResults.map((result) => result.packageId),
    corpus.packages.map((item) => item.id),
    "package",
  );
  exactIds(
    report.attempts.map((attempt) => attempt.id),
    [...new Set(report.attempts.map((attempt) => attempt.id))],
    "attempt",
  );
  const linked = new Set<string>();
  const validateLinks = (
    task: "cv" | "job" | "package",
    caseId: string,
    result: {
      attemptIds: string[];
      firstPassSchemaValid: boolean | null;
      repairs: number;
    },
    localAllowed: boolean,
  ) => {
    if (result.attemptIds.length === 0) {
      if (
        !localAllowed ||
        result.firstPassSchemaValid !== null ||
        result.repairs !== 0
      )
        throw new Error(
          "Only local non-extraction CV outcomes may omit model attempts.",
        );
      return;
    }
    if (
      result.firstPassSchemaValid === null ||
      result.attemptIds.length !== 1 + result.repairs ||
      new Set(result.attemptIds).size !== result.attemptIds.length
    )
      throw new Error("Invalid first-pass/repair attempt accounting.");
    let previous = 0;
    for (const attemptId of result.attemptIds) {
      const attempt = report.attempts.find((entry) => entry.id === attemptId);
      if (
        !attempt ||
        attempt.task !== task ||
        attempt.caseId !== caseId ||
        linked.has(attemptId) ||
        Date.parse(attempt.startedAt) < previous
      )
        throw new Error(
          "Missing, reused, unordered or wrongly scoped attempt.",
        );
      previous = Date.parse(attempt.startedAt);
      linked.add(attemptId);
    }
  };
  for (const result of report.cvResults)
    validateLinks(
      "cv",
      result.documentId,
      result,
      result.output.outcome !== "extracted",
    );
  for (const result of report.jobResults)
    validateLinks("job", result.jobId, result, false);
  for (const result of report.packageResults)
    validateLinks("package", result.packageId, result, false);
  if (linked.size !== report.attempts.length)
    throw new Error("Unaccounted model attempts are not permitted.");
  const usage = {
    attempts: report.attempts.length,
    inputTokens: report.attempts.reduce(
      (sum, attempt) => sum + attempt.inputTokens,
      0,
    ),
    billedOutputTokens: report.attempts.reduce(
      (sum, attempt) => sum + attempt.outputTokens + attempt.thinkingTokens,
      0,
    ),
    costMicroEuro: report.attempts.reduce(
      (sum, attempt) => sum + attempt.costMicroEuro,
      0,
    ),
  };
  if (
    usage.inputTokens > 500_000 ||
    usage.billedOutputTokens > 100_000 ||
    usage.costMicroEuro > 5_000_000
  )
    throw new Error("Reported model use exceeds experiment limits.");
  const dailyCounts = new Map<string, number>();
  for (const attempt of report.attempts) {
    const date = berlinDate(attempt.startedAt);
    const total = (dailyCounts.get(date) ?? 0) + 1;
    const policy = report.modelRequestPolicy;
    const limit = policy && date >= berlinDate(policy.authorizedAt) ? 70 : 30;
    if (total > limit) throw new Error("Reported daily LLM limit exceeded.");
    if (
      policy &&
      report.attempts.filter(
        (entry) =>
          berlinDate(entry.startedAt) === date &&
          entry.startedAt < policy.authorizedAt,
      ).length > 30
    )
      throw new Error(
        "Reported daily LLM limit exceeded before authorization.",
      );
    dailyCounts.set(date, total);
  }

  const cv = report.cvResults.map((result) => {
    const document = corpus.documents.find(
      (entry) => entry.id === result.documentId,
    );
    const profile = corpus.profiles.find(
      (entry) => entry.id === document?.profileId,
    );
    if (!document || !profile) throw new Error("Missing validated CV case.");
    const matched = new Set<string>();
    let unsupported = 0;
    let duplicates = 0;
    if (result.output.outcome === "extracted")
      for (const actual of result.output.facts) {
        const expected = document.expectedFacts.find((entry) => {
          const fact = profile.facts.find(
            (candidate) => candidate.id === entry.factId,
          );
          return (
            fact?.field === actual.field &&
            fact.value === actual.value &&
            entry.page === actual.page &&
            entry.quote === actual.quote
          );
        });
        if (!expected) unsupported++;
        else if (matched.has(expected.factId)) duplicates++;
        else matched.add(expected.factId);
      }
    const recall =
      document.expectedFacts.length === 0
        ? null
        : matched.size / document.expectedFacts.length;
    return {
      documentId: document.id,
      expectedFacts: document.expectedFacts.length,
      matchedFacts: matched.size,
      recall,
      unsupportedFacts: unsupported,
      duplicateFacts: duplicates,
      passed:
        result.output.outcome === document.expectedOutcome &&
        unsupported === 0 &&
        (document.kind !== "text" || (recall !== null && recall >= 0.9)),
    };
  });
  const classes = (["eligible", "blocked", "needs_review"] as const).map(
    (expected) => ({
      expected,
      total: corpus.jobs.filter((job) => job.expectedDecision === expected)
        .length,
      correct: report.jobResults.filter(
        (result) =>
          result.output.decision === expected &&
          corpus.jobs.some(
            (job) =>
              job.id === result.jobId && job.expectedDecision === expected,
          ),
      ).length,
    }),
  );
  const classificationPassed = classes.every(
    (row) => row.correct >= (row.expected === "eligible" ? 9 : row.total),
  );
  const matchingApprovalPending = corpus.jobs.filter((job) => {
    const profile = corpus.profiles.find((entry) => entry.id === job.profileId);
    const approved = approval?.profiles.find(
      (entry) => entry.profileId === job.profileId,
    );
    const firstAttempt = report.attempts.find(
      (attempt) =>
        attempt.id ===
        report.jobResults.find((result) => result.jobId === job.id)
          ?.attemptIds[0],
    );
    return (
      !profile ||
      !approved ||
      profile.facts.some((fact) => !approved.factIds.includes(fact.id)) ||
      !firstAttempt ||
      Date.parse(approved.approvedAt) > Date.parse(firstAttempt.startedAt)
    );
  }).length;
  const packages = report.packageResults.map((result) => {
    const item = corpus.packages.find((entry) => entry.id === result.packageId);
    const job = corpus.jobs.find((entry) => entry.id === item?.jobId);
    if (!item || !job) throw new Error("Missing validated package case.");
    const approved = approval?.profiles.find(
      (entry) => entry.profileId === item.profileId,
    );
    const firstAttempt = report.attempts.find(
      (attempt) => attempt.id === result.attemptIds[0],
    );
    const factsApproved =
      approved !== undefined &&
      firstAttempt !== undefined &&
      Date.parse(approved.approvedAt) <= Date.parse(firstAttempt.startedAt) &&
      item.factIds.every((factId) => approved.factIds.includes(factId));
    const validFactRefs = (actual: string[], allowed: string[]) =>
      new Set(actual).size === actual.length &&
      actual.every(
        (factId) =>
          allowed.includes(factId) &&
          (approved === undefined || approved.factIds.includes(factId)),
      );
    let referencesValid = true;
    let fieldsValid = result.output.kind === item.format.kind;
    let unansweredFields = 0;
    let applicantActionFields = 0;
    if (result.output.kind === "email")
      referencesValid = validFactRefs(result.output.claimFactIds, item.factIds);
    else {
      const fields =
        item.format.kind === "questionnaire" ? item.format.fields : [];
      const ids = result.output.answers.map((answer) => answer.fieldId);
      fieldsValid =
        fieldsValid &&
        new Set(ids).size === ids.length &&
        ids.length === fields.length &&
        ids.every((id) => fields.some((field) => field.id === id));
      for (const answer of result.output.answers) {
        const field = fields.find((entry) => entry.id === answer.fieldId);
        if (!field) {
          fieldsValid = false;
          continue;
        }
        if (answer.status === "proposed") {
          referencesValid =
            referencesValid &&
            validFactRefs(answer.claimFactIds, field.factIds);
          fieldsValid = fieldsValid && field.answerPolicy === "approved_facts";
        } else {
          fieldsValid = fieldsValid && field.answerPolicy === answer.status;
          if (answer.status === "needs_input") unansweredFields++;
          else applicantActionFields++;
        }
      }
    }
    const channelValid =
      JSON.stringify(result.output.channel) === JSON.stringify(job.channel);
    const reviewBound =
      result.manualReview.status === "pending" ||
      result.manualReview.outputSha256 === packageProposalHash(result.output);
    if (!reviewBound)
      throw new Error("Semantic review is stale for this complete output.");
    const status =
      !referencesValid ||
      !fieldsValid ||
      !channelValid ||
      result.manualReview.status === "failed"
        ? "failed"
        : !factsApproved || result.manualReview.status !== "passed"
          ? "incomplete"
          : "reported_passed";
    return {
      packageId: item.id,
      referencesValid,
      fieldsValid,
      unansweredFields,
      applicantActionFields,
      channelValid,
      factsApproved,
      semanticReview: result.manualReview.status,
      status,
    };
  });
  const firstPass = [
    ...report.cvResults,
    ...report.jobResults,
    ...report.packageResults,
  ].filter((result) => result.firstPassSchemaValid !== null);
  const failed =
    cv.some((result) => !result.passed) ||
    !classificationPassed ||
    packages.some((result) => result.status === "failed");
  return {
    corpusHash: corpusHash(corpus),
    promptVersion,
    evaluatorVersion,
    provenance: report.provenance,
    ...(report.modelRequestPolicy
      ? { modelRequestPolicy: report.modelRequestPolicy }
      : {}),
    provenanceMatched: expectedProvenance !== undefined,
    status: failed
      ? "failed"
      : packages.some((result) => result.status === "incomplete") ||
          matchingApprovalPending > 0 ||
          expectedProvenance === undefined
        ? "incomplete"
        : "reported_criteria_met",
    cv,
    classification: {
      classes,
      thresholdsMet: classificationPassed,
      approvalPendingCases: matchingApprovalPending,
      passed: classificationPassed && matchingApprovalPending === 0,
    },
    packages,
    usage,
    firstPassSchema: {
      valid: firstPass.filter((result) => result.firstPassSchemaValid).length,
      total: firstPass.length,
    },
    repairs: firstPass.reduce((sum, result) => sum + result.repairs, 0),
    limitations:
      "Operator approvals, semantic reviews and provider observations are supplied evidence, not authenticated by this local scorer; valid fact IDs alone do not establish prose truth.",
  };
}
