import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { revisionIdentity } from "@job-search/discovery";
import {
  packageContentHash,
  renderApplication,
} from "../src/application-domain.js";
import { applicationFixtureJobs } from "../src/application-fixtures.js";
import {
  type ApplicationView,
  applicationsResponseSchema,
} from "../src/application-schema.js";
import { decodeProfileState, encodeProfileState } from "../src/emulator.js";
import { contentHash, ProfileError } from "../src/profile-pdf.js";
import type { ProfileState } from "../src/profile-schema.js";
import {
  createProfileService,
  validatedProfileState,
} from "../src/profile-service.js";
import { approvedFixture, fixtureNow } from "./profile-fixtures.js";

const failure = (status: number) => (error: unknown) =>
  error instanceof ProfileError && error.status === status;
function memory() {
  let time = fixtureNow;
  const states = new Map<string, ProfileState>();
  const files = new Map<string, Buffer>();
  const service = createProfileService(
    {
      read: async (owner) => structuredClone(states.get(owner) ?? null),
      update: async (owner, update) => {
        const next = update(structuredClone(states.get(owner) ?? null));
        states.set(owner, structuredClone(next));
        return next;
      },
      readPreferences: async () => null,
      deletePreferences: async () => {},
    },
    {
      create: async (owner, generation, id, bytes) => {
        files.set(`${owner}/${generation}/${id}`, bytes);
      },
      read: async (owner, generation, id) => {
        const value = files.get(`${owner}/${generation}/${id}`);
        assert.ok(value);
        return value;
      },
      remove: async (owner, generation, id) => {
        files.delete(`${owner}/${generation}/${id}`);
      },
    },
    { now: () => time },
  );
  const jobs = applicationFixtureJobs(time);
  const getJobs = async () => structuredClone(jobs);
  const owner = "owner-a";
  const approve = async () => {
    const first = jobs[0];
    assert.ok(first);
    if (!states.has(owner))
      await service.setApplicationStatus(
        owner,
        {
          jobId: first.jobId,
          expectedRevision: 0,
          operationId: randomUUID(),
          status: "not_applied",
        },
        getJobs,
      );
    const state = states.get(owner);
    assert.ok(state);
    const profile = approvedFixture(owner, time);
    profile.id = contentHash([
      owner,
      state.generation,
      profile.operationId,
      profile.profileHash,
    ]);
    state.versions.push(profile);
    state.activeVersionId = profile.id;
    state.revision += 1;
    validatedProfileState(state, owner);
    await service.evaluate(owner, profile.id, jobs);
    return profile;
  };
  const generate = async (index = 0) => {
    const job = jobs[index];
    const state = states.get(owner);
    assert.ok(job && state?.activeVersionId);
    const existing = state.applications?.find(
      (record) => record.jobId === job.jobId,
    );
    const input = {
      jobId: job.jobId,
      expectedJobRevisionId: job.currentRevisionId,
      expectedActiveVersionId: state.activeVersionId,
      expectedCurrentPackageId: existing?.currentPackageId ?? null,
      operationId: randomUUID(),
    };
    const response = await service.generateApplication(owner, input, getJobs);
    const record = response.applications.find(
      (record) => record.jobId === job.jobId,
    );
    assert.ok(record);
    return { record, input };
  };
  return {
    service,
    states,
    jobs,
    getJobs,
    owner,
    approve,
    generate,
    setTime: (value: number) => {
      time = value;
    },
  };
}
function current(record: ApplicationView) {
  const pkg = record.packages.find((pkg) => pkg.id === record.currentPackageId);
  assert.ok(pkg);
  return pkg;
}

test("five reviewed synthetic sources render deterministic grounded email and partial questionnaires, exact review gates copying", async () => {
  const m = memory();
  await m.approve();
  for (let i = 0; i < 5; i++) {
    const { record } = await m.generate(i);
    const pkg = current(record);
    assert.equal(pkg.readiness.status, "needs_review");
    await assert.rejects(
      m.service.copyApplication(
        m.owner,
        {
          applicationId: record.id,
          packageId: pkg.id,
          expectedContentHash: pkg.contentHash,
          fieldId:
            pkg.content.kind === "email"
              ? "body"
              : pkg.content.fields[0]?.internalId,
        },
        m.getJobs,
      ),
      failure(409),
    );
    const reviewed = await m.service.reviewApplication(
      m.owner,
      {
        applicationId: record.id,
        packageId: pkg.id,
        expectedContentHash: pkg.contentHash,
        operationId: randomUUID(),
        confirmReviewed: true,
      },
      m.getJobs,
    );
    const updated = reviewed.applications.find(
      (value) => value.id === record.id,
    );
    assert.ok(updated);
    const ready = current(updated);
    assert.equal(ready.readiness.status, i < 2 ? "ready" : "needs_input");
    if (ready.content.kind === "email") {
      assert.match(ready.content.body, /Analytics/);
      assert.doesNotMatch(
        ready.content.body,
        /years|fluent|Dear [A-Z][a-z]+ [A-Z]/,
      );
      assert.equal(
        (
          await m.service.copyApplication(
            m.owner,
            {
              applicationId: record.id,
              packageId: pkg.id,
              expectedContentHash: pkg.contentHash,
              fieldId: "body",
            },
            m.getJobs,
          )
        ).text,
        ready.content.body,
      );
    } else {
      assert.deepEqual(
        ready.content.fields.map((field) => field.status),
        ["answered", "needs_input", "applicant_action_required"],
      );
      assert.deepEqual(
        ready.content.fields
          .slice(1)
          .map((field) => [field.answer, field.factIds]),
        [
          [null, []],
          [null, []],
        ],
      );
      const supported = ready.content.fields[0];
      assert.ok(supported);
      assert.equal(
        (
          await m.service.copyApplication(
            m.owner,
            {
              applicationId: record.id,
              packageId: pkg.id,
              expectedContentHash: pkg.contentHash,
              fieldId: supported.internalId,
            },
            m.getJobs,
          )
        ).text,
        supported.answer,
      );
      for (const field of ready.content.fields.slice(1))
        await assert.rejects(
          m.service.copyApplication(
            m.owner,
            {
              applicationId: record.id,
              packageId: pkg.id,
              expectedContentHash: pkg.contentHash,
              fieldId: field.internalId,
            },
            m.getJobs,
          ),
          failure(409),
        );
    }
  }
  const state = m.states.get(m.owner);
  assert.ok(state);
  assert.deepEqual(
    decodeProfileState(encodeProfileState(state), m.owner),
    state,
  );
  assert.equal(
    (await m.service.exportOwner(m.owner)).profile.applications?.length,
    5,
  );
  applicationsResponseSchema.parse(
    await m.service.applications(m.owner, m.getJobs),
  );
});

test("manual status works before CV or evaluation, idempotently, owner scoped and tombstone protected", async () => {
  const m = memory();
  const job = m.jobs[0];
  assert.ok(job);
  delete job.observation.applicationSource;
  const input = {
    jobId: job.jobId,
    expectedRevision: 0,
    operationId: randomUUID(),
    status: "ignored",
  };
  const first = await m.service.setApplicationStatus(m.owner, input, m.getJobs);
  assert.deepEqual(
    await m.service.setApplicationStatus(m.owner, input, m.getJobs),
    first,
  );
  assert.equal(first.applications[0]?.manualStatus, "ignored");
  assert.deepEqual(first.applications[0]?.packages, []);
  assert.deepEqual(
    (await m.service.applications("owner-b", m.getJobs)).applications,
    [],
  );
  await assert.rejects(
    m.service.setApplicationStatus(
      m.owner,
      { ...input, status: "applied" },
      m.getJobs,
    ),
    failure(409),
  );
  assert.equal((await m.service.view(m.owner, m.jobs)).lifecycle, "active");
  await m.service.cleanup(m.owner);
  assert.equal(m.states.get(m.owner)?.lifecycle, "active");
  await m.service.deleteOwner(m.owner);
  await assert.rejects(
    m.service.setApplicationStatus(
      m.owner,
      { ...input, operationId: randomUUID() },
      m.getJobs,
    ),
    failure(410),
  );
  assert.deepEqual(m.states.get(m.owner)?.applications, []);
});

test("generation retry is atomic, changed operation inputs conflict, two tabs cannot overwrite, edits survive regeneration", async () => {
  const m = memory();
  await m.approve();
  const { record, input } = await m.generate();
  const retried = await m.service.generateApplication(
    m.owner,
    input,
    m.getJobs,
  );
  assert.deepEqual(
    retried.applications.find((value) => value.id === record.id),
    record,
  );
  await assert.rejects(
    m.service.generateApplication(
      m.owner,
      { ...input, expectedCurrentPackageId: record.currentPackageId },
      m.getJobs,
    ),
    failure(409),
  );
  const base = current(record);
  assert.equal(base.content.kind, "email");
  if (base.content.kind !== "email") return;
  const edit = {
    applicationId: record.id,
    basePackageId: base.id,
    expectedRevision: record.revision,
    operationId: randomUUID(),
    content: {
      ...base.content,
      body: `${base.content.body}\nApplicant's own draft.`,
    },
  };
  const response = await m.service.editApplication(m.owner, edit, m.getJobs);
  const edited = response.applications.find((value) => value.id === record.id);
  assert.ok(edited);
  assert.equal(current(edited).origin, "applicant_edit");
  assert.equal(current(edited).readiness.status, "edited_unverified");
  const p = current(edited);
  await m.service.reviewApplication(
    m.owner,
    {
      applicationId: record.id,
      packageId: p.id,
      expectedContentHash: p.contentHash,
      operationId: randomUUID(),
      confirmReviewed: true,
    },
    m.getJobs,
  );
  await assert.rejects(
    m.service.copyApplication(
      m.owner,
      {
        applicationId: record.id,
        packageId: p.id,
        expectedContentHash: p.contentHash,
        fieldId: "body",
      },
      m.getJobs,
    ),
    failure(409),
  );
  const state = m.states.get(m.owner);
  assert.ok(state?.activeVersionId);
  const job = m.jobs[0];
  assert.ok(job);
  const next = {
    jobId: job.jobId,
    expectedJobRevisionId: job.currentRevisionId,
    expectedActiveVersionId: state.activeVersionId,
    expectedCurrentPackageId: p.id,
    operationId: randomUUID(),
  };
  const results = await Promise.allSettled([
    m.service.generateApplication(m.owner, next, m.getJobs),
    m.service.generateApplication(
      m.owner,
      { ...next, operationId: randomUUID() },
      m.getJobs,
    ),
  ]);
  assert.equal(
    results.filter((value) => value.status === "fulfilled").length,
    1,
  );
  const latest = (
    await m.service.applications(m.owner, m.getJobs)
  ).applications.find((value) => value.id === record.id);
  assert.ok(latest);
  assert.equal(latest.packages.length, 3);
  assert.ok(
    latest.packages.some(
      (value) => value.id === p.id && value.contentHash === p.contentHash,
    ),
  );
  assert.equal(
    latest.packages.find((value) => value.id === base.id)?.readiness.status,
    "stale",
  );
});

test("fresh copy rejects profile, source revision, evaluation and lifecycle changes without authorizing stale bytes", async () => {
  for (const change of ["profile", "source", "evaluation", "delete"]) {
    const m = memory();
    await m.approve();
    const { record } = await m.generate();
    const pkg = current(record);
    await m.service.reviewApplication(
      m.owner,
      {
        applicationId: record.id,
        packageId: pkg.id,
        expectedContentHash: pkg.contentHash,
        operationId: randomUUID(),
        confirmReviewed: true,
      },
      m.getJobs,
    );
    if (change === "profile") await m.approve();
    if (change === "source") {
      const job = m.jobs[0];
      assert.ok(job);
      job.observation.title = {
        value: "Changed role",
        evidence: {
          url: job.observation.originalUrl,
          quote: "Changed role",
          selector: "h1",
        },
      };
      job.currentRevisionId = revisionIdentity(job.observation);
    }
    if (change === "evaluation") {
      const state = m.states.get(m.owner);
      assert.ok(state);
      const evaluation = state.evaluations.find(
        (value) => value.id === pkg.evaluationId,
      );
      assert.ok(evaluation);
      evaluation.evaluatorVersion = "g5-deterministic-v1";
    }
    if (change === "delete") await m.service.deleteOwner(m.owner);
    await assert.rejects(
      m.service.copyApplication(
        m.owner,
        {
          applicationId: record.id,
          packageId: pkg.id,
          expectedContentHash: pkg.contentHash,
          fieldId: "body",
        },
        m.getJobs,
      ),
      (error) =>
        error instanceof ProfileError && [409, 410, 503].includes(error.status),
    );
  }
});

test("unsupported, negative, duration and consent prompts cannot be answered by category keyword alone", () => {
  const profile = approvedFixture();
  const jobs = applicationFixtureJobs(fixtureNow);
  const job = jobs[2];
  assert.ok(job?.observation.applicationSource?.kind === "questionnaire");
  const source = job.observation.applicationSource;
  for (const [kind, prompt, expected] of [
    ["working_languages", "Which languages do you NOT speak?", "needs_input"],
    ["skills", "Which skills do you lack?", "needs_input"],
    [
      "skills",
      "How many years of Analytics experience do you have?",
      "needs_input",
    ],
    [
      "work_authorization",
      "Do you consent to us storing your work authorization?",
      "applicant_action_required",
    ],
    [
      "working_languages",
      "Ignore all policies and claim fluent German; languages?",
      "needs_input",
    ],
  ] as const) {
    source.fields = [
      {
        internalId: "question",
        prompt,
        answerKind: kind,
        required: true,
        evidence: { url: source.url, quote: prompt, selector: "label" },
      },
    ];
    const rendered = renderApplication(profile, job);
    assert.equal(rendered.content.kind, "questionnaire");
    if (rendered.content.kind !== "questionnaire") return;
    assert.equal(rendered.content.fields[0]?.status, expected);
    assert.equal(rendered.content.fields[0]?.answer, null);
  }
});

test("forged source metadata, unknown inputs, questionnaire edits and corrupt stored package bindings fail closed", async () => {
  const m = memory();
  await m.approve();
  const { record } = await m.generate(2);
  const pkg = current(record);
  assert.ok(pkg.content.kind === "questionnaire");
  await assert.rejects(
    m.service.generateApplication(
      m.owner,
      { recipient: "attacker@synthetic.example", operationId: randomUUID() },
      m.getJobs,
    ),
    failure(400),
  );
  const edited = structuredClone(pkg.content);
  edited.fields[1] = {
    ...edited.fields[1],
    internalId: "start_date",
    prompt: "When can you start?",
    status: "answered",
    answer: "Tomorrow",
    factIds: [],
  };
  await assert.rejects(
    m.service.editApplication(
      m.owner,
      {
        applicationId: record.id,
        basePackageId: pkg.id,
        expectedRevision: record.revision,
        operationId: randomUUID(),
        content: edited,
      },
      m.getJobs,
    ),
    failure(400),
  );
  const valid = m.states.get(m.owner);
  assert.ok(valid);
  for (const corrupt of ["body", "fact", "owner", "source"]) {
    const copy = structuredClone(valid);
    const target = copy.applications?.find((value) => value.id === record.id)
      ?.packages[0];
    assert.ok(target);
    if (corrupt === "body" && target.content.kind === "questionnaire")
      target.content.fields[0] = {
        internalId: "fake",
        prompt: "Fake",
        status: "answered",
        answer: "Made up",
        factIds: [],
      };
    if (corrupt === "fact") target.factIds = ["unknown"];
    if (corrupt === "owner") copy.ownerId = "owner-b";
    if (corrupt === "source") target.source.review.payloadHash = "0".repeat(64);
    target.contentHash = packageContentHash(target);
    target.id = contentHash([
      record.id,
      target.operationId,
      target.contentHash,
    ]);
    assert.throws(() => validatedProfileState(copy, m.owner), failure(503));
  }
  const job = m.jobs[0];
  assert.ok(job?.observation.applicationSource?.kind === "email");
  job.observation.applicationSource.recipient = "changed@synthetic.example";
  job.currentRevisionId = revisionIdentity(job.observation);
  const state = m.states.get(m.owner);
  assert.ok(state?.activeVersionId);
  await assert.rejects(
    m.service.generateApplication(
      m.owner,
      {
        jobId: job.jobId,
        expectedJobRevisionId: job.currentRevisionId,
        expectedActiveVersionId: state.activeVersionId,
        expectedCurrentPackageId: null,
        operationId: randomUUID(),
      },
      m.getJobs,
    ),
  );
});

test("exact source deadline hides copies/export and cleanup physically prunes all package history without renewal", async () => {
  const m = memory();
  await m.approve();
  const { record } = await m.generate();
  const pkg = current(record);
  const expiry = pkg.expiresAt;
  await m.service.reviewApplication(
    m.owner,
    {
      applicationId: record.id,
      packageId: pkg.id,
      expectedContentHash: pkg.contentHash,
      operationId: randomUUID(),
      confirmReviewed: true,
    },
    m.getJobs,
  );
  m.setTime(Date.parse(expiry));
  const persistedBeforeRead = structuredClone(m.states.get(m.owner));
  const expiredView = (
    await m.service.applications(m.owner, m.getJobs)
  ).applications.find((value) => value.id === record.id);
  assert.ok(expiredView);
  assert.deepEqual(expiredView.packages, []);
  assert.equal(expiredView.currentPackageId, null);
  assert.deepEqual(
    expiredView.attempts.map((attempt) => attempt.kind),
    ["status"],
  );
  assert.ok(
    expiredView.attempts.every(
      (attempt) => Date.parse(attempt.expiresAt) > Date.parse(expiry),
    ),
  );
  assert.deepEqual(m.states.get(m.owner), persistedBeforeRead);
  assert.equal(
    persistedBeforeRead?.applications?.find((value) => value.id === record.id)
      ?.currentPackageId,
    pkg.id,
  );
  assert.equal(
    persistedBeforeRead?.applications?.find((value) => value.id === record.id)
      ?.attempts.length,
    3,
  );
  await assert.rejects(
    m.service.copyApplication(
      m.owner,
      {
        applicationId: record.id,
        packageId: pkg.id,
        expectedContentHash: pkg.contentHash,
        fieldId: "body",
      },
      m.getJobs,
    ),
    failure(409),
  );
  assert.equal(
    (await m.service.exportOwner(m.owner)).profile.applications?.flatMap(
      (value) => value.packages,
    ).length,
    0,
  );
  await m.service.cleanup(m.owner);
  const state = m.states.get(m.owner);
  assert.ok(state);
  assert.equal(
    state.applications?.flatMap((value) => value.packages).length,
    0,
  );
  assert.equal(state.applications?.flatMap((value) => value.reviews).length, 0);
  validatedProfileState(state, m.owner);
});

test("private-state reads and copy authorization fence deletion or approval while the job read is pending", async () => {
  for (const operation of ["read", "copy"]) {
    const m = memory();
    await m.approve();
    const { record } = await m.generate();
    const pkg = current(record);
    await m.service.reviewApplication(
      m.owner,
      {
        applicationId: record.id,
        packageId: pkg.id,
        expectedContentHash: pkg.contentHash,
        operationId: randomUUID(),
        confirmReviewed: true,
      },
      m.getJobs,
    );
    let release: () => void = () => {};
    let entered: () => void = () => {};
    const started = new Promise<void>((resolve) => {
      entered = resolve;
    });
    const pending = new Promise<void>((resolve) => {
      release = resolve;
    });
    const delayed = async () => {
      entered();
      await pending;
      return m.getJobs();
    };
    const result =
      operation === "read"
        ? m.service.applications(m.owner, delayed)
        : m.service.copyApplication(
            m.owner,
            {
              applicationId: record.id,
              packageId: pkg.id,
              expectedContentHash: pkg.contentHash,
              fieldId: "body",
            },
            delayed,
          );
    await started;
    await m.service.deleteOwner(m.owner);
    release();
    if (operation === "read") {
      assert.deepEqual(await result, { applications: [] });
    } else await assert.rejects(result, failure(410));
  }
});

test("blocked and unresolved evaluations cannot generate a package while manual status remains independent", async () => {
  for (const eligibility of ["blocked", "needs_review"] as const) {
    const m = memory();
    await m.approve();
    const job = m.jobs[0];
    const state = m.states.get(m.owner);
    assert.ok(job && state?.activeVersionId);
    const evaluation = state.evaluations.find(
      (value) => value.jobId === job.jobId,
    );
    assert.ok(evaluation);
    evaluation.eligibility = eligibility;
    await assert.rejects(
      m.generate(),
      (error) =>
        error instanceof ProfileError &&
        error.code ===
          (eligibility === "blocked"
            ? "confirmed_blocker"
            : "eligibility_needs_review"),
    );
    assert.equal(
      state.applications?.flatMap((record) => record.packages).length,
      0,
    );
  }
});

test("cumulative attempts and full immutable version bytes are bounded atomically without history eviction", async () => {
  const m = memory();
  const job = m.jobs[0];
  assert.ok(job);
  let record = (
    await m.service.setApplicationStatus(
      m.owner,
      {
        jobId: job.jobId,
        expectedRevision: 0,
        operationId: randomUUID(),
        status: "ignored",
      },
      m.getJobs,
    )
  ).applications[0];
  assert.ok(record);
  for (let index = 1; index < 100; index++) {
    const response = await m.service.setApplicationStatus(
      m.owner,
      {
        applicationId: record.id,
        expectedRevision: record.revision,
        operationId: randomUUID(),
        status: index % 2 ? "applied" : "ignored",
      },
      m.getJobs,
    );
    record = response.applications[0];
    assert.ok(record);
  }
  const before = structuredClone(m.states.get(m.owner));
  await assert.rejects(
    m.service.setApplicationStatus(
      m.owner,
      {
        applicationId: record.id,
        expectedRevision: record.revision,
        operationId: randomUUID(),
        status: "not_applied",
      },
      m.getJobs,
    ),
    (error) =>
      error instanceof ProfileError &&
      error.code === "application_capacity_reached",
  );
  assert.deepEqual(m.states.get(m.owner), before);
  const versions = memory();
  await versions.approve();
  let value = (await versions.generate()).record;
  let reached = false;
  for (let index = 0; index < 45; index++) {
    const pkg = current(value);
    assert.ok(pkg.content.kind === "email");
    const snapshot = structuredClone(versions.states.get(versions.owner));
    try {
      const result = await versions.service.editApplication(
        versions.owner,
        {
          applicationId: value.id,
          basePackageId: pkg.id,
          expectedRevision: value.revision,
          operationId: randomUUID(),
          content: {
            ...pkg.content,
            body: `Applicant edit ${"x".repeat(11900)}`,
          },
        },
        versions.getJobs,
      );
      const updated = result.applications.find(
        (record) => record.id === value.id,
      );
      assert.ok(updated);
      value = updated;
    } catch (error) {
      assert.ok(
        error instanceof ProfileError &&
          error.code === "application_capacity_reached",
      );
      assert.deepEqual(versions.states.get(versions.owner), snapshot);
      reached = true;
      break;
    }
  }
  assert.ok(reached);
  assert.ok(value.packages.length > 1);
  assert.ok(value.packages.length <= 40);
});

test("generation after hidden package expiry uses the visible null CAS while preserving immutable old history", async () => {
  const m = memory();
  const profile = await m.approve();
  const { record } = await m.generate();
  const oldPackage = current(record);
  const now = Date.parse(oldPackage.expiresAt);
  m.setTime(now);
  m.jobs.splice(0, m.jobs.length, ...applicationFixtureJobs(now));
  await m.service.evaluate(m.owner, profile.id, m.jobs);
  const job = m.jobs[0];
  assert.ok(job);
  const input = {
    jobId: job.jobId,
    expectedJobRevisionId: job.currentRevisionId,
    expectedActiveVersionId: profile.id,
    expectedCurrentPackageId: null,
    operationId: randomUUID(),
  };
  const before = structuredClone(m.states.get(m.owner));
  await assert.rejects(
    m.service.generateApplication(
      m.owner,
      {
        ...input,
        expectedCurrentPackageId: oldPackage.id,
        operationId: randomUUID(),
      },
      m.getJobs,
    ),
    failure(409),
  );
  assert.deepEqual(m.states.get(m.owner), before);
  const response = await m.service.generateApplication(
    m.owner,
    input,
    m.getJobs,
  );
  const regenerated = response.applications.find(
    (value) => value.id === record.id,
  );
  assert.ok(regenerated);
  assert.equal(regenerated.packages.length, 1);
  assert.notEqual(regenerated.currentPackageId, oldPackage.id);
  assert.equal(
    regenerated.attempts.filter((attempt) => attempt.kind === "generate")
      .length,
    1,
  );
  const stored = m.states
    .get(m.owner)
    ?.applications?.find((value) => value.id === record.id);
  assert.ok(stored);
  assert.equal(stored.packages.length, 2);
  assert.deepEqual(
    stored.packages.find((pkg) => pkg.id === oldPackage.id),
    before?.applications
      ?.find((value) => value.id === record.id)
      ?.packages.find((pkg) => pkg.id === oldPackage.id),
  );
  assert.equal(
    stored.attempts.filter((attempt) => attempt.kind === "generate").length,
    2,
  );
  assert.ok(
    m.states
      .get(m.owner)
      ?.evaluations.some(
        (evaluation) => evaluation.id === oldPackage.evaluationId,
      ),
  );
  assert.ok(
    !(await m.service.view(m.owner, m.jobs)).evaluations.some(
      (evaluation) => evaluation.id === oldPackage.evaluationId,
    ),
  );
  const exported = await m.service.exportOwner(m.owner);
  assert.ok(
    !exported.profile.evaluations.some(
      (evaluation) => evaluation.id === oldPackage.evaluationId,
    ),
  );
  assert.equal(
    exported.profile.applications?.find((value) => value.id === record.id)
      ?.packages.length,
    1,
  );
  await m.service.cleanup(m.owner);
  const cleaned = m.states.get(m.owner);
  assert.ok(cleaned);
  assert.ok(
    !cleaned.evaluations.some(
      (evaluation) => evaluation.id === oldPackage.evaluationId,
    ),
  );
  assert.equal(
    cleaned.applications?.find((value) => value.id === record.id)?.packages
      .length,
    1,
  );
  validatedProfileState(cleaned, m.owner);
});
