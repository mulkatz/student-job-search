import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  corpusHash,
  validateModelCorpus,
  validateOperatorApproval,
} from "../src/model-corpus.js";
import {
  buildRemediationRequest,
  validateRemediationOutput,
} from "../src/model-remediation.js";
import {
  buildPackageRepairRequest,
  packageRepairOutputSchema,
} from "../src/package-remediation.js";

const corpus = validateModelCorpus(
  JSON.parse(
    readFileSync(
      new URL("../../../../experiments/g3/model-corpus.json", import.meta.url),
      "utf8",
    ),
  ),
);
const now = new Date("2026-10-19T12:00:00.000Z");
const approval = validateOperatorApproval(corpus, {
  version: 1,
  corpusHash: corpusHash(corpus),
  attestation: "operator-reviewed-synthetic-facts",
  profiles: corpus.profiles.map((profile) => ({
    profileId: profile.id,
    profileVersion: 1,
    factIds: profile.facts.map((fact) => fact.id),
    approvedAt: "2026-10-18T12:00:00.000Z",
  })),
});

function validOutput() {
  return {
    jobs: corpus.jobs.map((job) => ({
      id: job.id,
      output: {
        decision: job.expectedDecision,
        fitScore: 50,
        evidenceConfidence: 0.7,
      },
    })),
    packages: corpus.packages.map((item) => {
      const job = corpus.jobs.find((entry) => entry.id === item.jobId);
      assert.ok(job);
      return {
        id: item.id,
        output:
          item.format.kind === "email"
            ? {
                kind: "email" as const,
                subject: "Synthetic application",
                body: "Synthetic fixture text requiring semantic review.",
                claimFactIds: item.factIds.slice(0, 1),
                channel: structuredClone(job.channel),
              }
            : {
                kind: "questionnaire" as const,
                answers: item.format.fields.map((field) =>
                  field.answerPolicy === "approved_facts"
                    ? {
                        fieldId: field.id,
                        status: "proposed" as const,
                        text: "Synthetic fixture text requiring semantic review.",
                        claimFactIds: field.factIds.slice(0, 1),
                      }
                    : { fieldId: field.id, status: field.answerPolicy },
                ),
                channel: structuredClone(job.channel),
              },
      };
    }),
  };
}

test("batched remediation requires approved facts without sending oracle decisions or answer policies", () => {
  assert.throws(() => buildRemediationRequest(corpus, undefined, now));
  const future = structuredClone(approval);
  for (const profile of future.profiles)
    profile.approvedAt = "2026-10-20T12:00:00.000Z";
  assert.throws(() => buildRemediationRequest(corpus, future, now));
  const request = buildRemediationRequest(corpus, approval, now);
  const body = JSON.stringify(request.payload);
  assert.ok(!body.includes('"expectedDecision"'));
  assert.ok(!body.includes('"answerPolicy"'));
  assert.ok(!body.includes("Synthetic fixture text requiring semantic review"));
  assert.ok(body.includes("approvedFacts"));
  assert.ok(body.includes("sourceQuote"));
  assert.ok(body.includes("Contradictory decisive source clauses"));
  assert.equal(request.payload.generationConfig.candidateCount, 1);
  assert.equal(request.payload.generationConfig.maxOutputTokens, 16_384);
  assert.equal(
    request.payload.generationConfig.responseMimeType,
    "application/json",
  );
});

test("batch identities cannot omit, duplicate or substitute cases even with valid individual outputs", () => {
  assert.equal(
    validateRemediationOutput(corpus, validOutput()).jobs.length,
    20,
  );
  const duplicate = validOutput();
  assert.ok(duplicate.jobs[0] && duplicate.jobs[1]);
  duplicate.jobs[1].id = duplicate.jobs[0].id;
  assert.throws(() => validateRemediationOutput(corpus, duplicate));
  const omitted = validOutput();
  omitted.packages.pop();
  assert.throws(() => validateRemediationOutput(corpus, omitted));
  const other = validOutput();
  assert.ok(other.jobs[0]);
  other.jobs[0].id = "unknown-case";
  assert.throws(() => validateRemediationOutput(corpus, other));
});

test("cross-field facts and changed channels are rejected independently of model prose", () => {
  const bad = validOutput();
  const questionnaire = bad.packages.find((item) => item.id === "package-02");
  assert.ok(questionnaire?.output.kind === "questionnaire");
  const experience = questionnaire.output.answers.find(
    (answer) => answer.fieldId === "experience",
  );
  assert.ok(experience?.status === "proposed");
  experience.claimFactIds = ["alpha-skill"];
  assert.throws(() => validateRemediationOutput(corpus, bad));
  const channel = validOutput();
  const email = channel.packages.find((item) => item.id === "package-01");
  assert.ok(email?.output.channel.kind === "email");
  email.output.channel.value = "invented@employer.example.invalid";
  assert.throws(() => validateRemediationOutput(corpus, channel));
});

test("action and missing-answer states cannot smuggle proposed text or unbounded model scores", () => {
  const value = validOutput();
  const questionnaire = value.packages.find((item) => item.id === "package-04");
  assert.ok(questionnaire?.output.kind === "questionnaire");
  const questionnaireOutput = questionnaire.output;
  const consent = questionnaireOutput.answers.find(
    (answer) => answer.fieldId === "consent",
  );
  assert.ok(consent);
  assert.throws(() =>
    validateRemediationOutput(corpus, {
      ...value,
      packages: value.packages.map((item) =>
        item.id === questionnaire.id
          ? {
              ...item,
              output: {
                ...questionnaireOutput,
                answers: [
                  ...questionnaireOutput.answers.filter(
                    (answer) => answer.fieldId !== consent.fieldId,
                  ),
                  { ...consent, text: "I agree" },
                ],
              },
            }
          : item,
      ),
    }),
  );
  assert.ok(value.jobs[0]);
  value.jobs[0].output.evidenceConfidence = 1.01;
  assert.throws(() => validateRemediationOutput(corpus, value));
});

test("package repair schema requires the references missing in the observed failed generation", () => {
  const source = validOutput();
  const request = buildPackageRepairRequest(
    corpus,
    approval,
    { packages: source.packages },
    now,
  );
  const schema = JSON.stringify(
    request.payload.generationConfig.responseSchema,
  );
  assert.ok(
    schema.includes('"required":["fieldId","status","text","claimFactIds"]'),
  );
  assert.ok(
    schema.includes('"required":["kind","value","verification","evidenceRef"]'),
  );
  const system = request.payload.systemInstruction.parts[0]?.text;
  assert.ok(system);
  assert.ok(system.includes("final applicant-facing copy only"));
  assert.ok(system.includes("References belong exclusively"));
  assert.ok(!JSON.stringify(request.payload).includes('"expectedDecision"'));
  assert.ok(!JSON.stringify(request.payload).includes('"answerPolicy"'));
  assert.equal(request.payload.generationConfig.candidateCount, 1);
  assert.equal(request.payload.generationConfig.maxOutputTokens, 8192);
});

test("package repair binds all prior case identities without accepting partial or unexplained new cases", () => {
  const value = validOutput();
  assert.equal(
    packageRepairOutputSchema.parse({ packages: value.packages }).packages
      .length,
    5,
  );
  assert.throws(() =>
    buildPackageRepairRequest(
      corpus,
      undefined,
      { packages: value.packages },
      now,
    ),
  );
  const wrong = structuredClone(value.packages);
  assert.ok(wrong[0] && wrong[1]);
  wrong[1].id = wrong[0].id;
  assert.throws(() =>
    buildPackageRepairRequest(corpus, approval, { packages: wrong }, now),
  );
  assert.throws(() =>
    buildPackageRepairRequest(
      corpus,
      approval,
      { packages: value.packages.slice(1) },
      now,
    ),
  );
  assert.throws(() =>
    buildPackageRepairRequest(
      corpus,
      approval,
      { packages: value.packages },
      new Date("2026-10-17T12:00:00.000Z"),
    ),
  );
});
