import type { DiscoveryJob } from "@job-search/discovery";
import type { z } from "zod";
import {
  applicationIdentity,
  applicationViews,
  checkedApplicationSource,
  newApplicationPackage,
  packageContentHash,
} from "./application-domain.js";
import {
  type ApplicationPackage,
  type ApplicationRecord,
  applicationCopySchema,
  applicationEditSchema,
  applicationGenerateSchema,
  applicationPolicy,
  applicationReviewRequestSchema,
  applicationStatusSchema,
  applicationsResponseSchema,
} from "./application-schema.js";
import { contentHash, ProfileError } from "./profile-pdf.js";
import {
  currentEvaluatorVersion,
  type ProfileState,
} from "./profile-schema.js";

interface Context {
  checked(owner: string): Promise<ProfileState | null>;
  change(
    owner: string,
    update: (state: ProfileState | null) => ProfileState,
  ): Promise<ProfileState>;
  newState(owner: string, now: number): ProfileState;
  touch(state: ProfileState, now: number): ProfileState;
  now(): number;
}
type Jobs = () => Promise<readonly DiscoveryJob[]>;
function request<T>(schema: z.ZodType<T>, input: unknown): T {
  const result = schema.safeParse(input);
  if (!result.success) throw new ProfileError(400, "request_schema_invalid");
  return result.data;
}
function active(state: ProfileState | null): ProfileState {
  if (!state) throw new ProfileError(409, "profile_not_created");
  if (state.lifecycle !== "active")
    throw new ProfileError(410, "owner_data_deleted");
  return state;
}
function retry(
  state: ProfileState,
  operationId: string,
  hash: string,
): boolean {
  const attempt = (state.applications ?? [])
    .flatMap((record) => record.attempts)
    .find((value) => value.operationId === operationId);
  if (!attempt) return false;
  if (attempt.requestHash !== hash)
    throw new ProfileError(409, "operation_conflict");
  return true;
}
function parent(
  state: ProfileState,
  id: string,
  now: number,
): ApplicationRecord {
  const record = state.applications?.find(
    (value) => value.id === id && Date.parse(value.expiresAt) > now,
  );
  if (!record) throw new ProfileError(409, "application_unavailable");
  return record;
}
function jobById(
  jobs: readonly DiscoveryJob[],
  id: string,
  now: number,
): DiscoveryJob {
  const job = jobs.find(
    (value) =>
      value.jobId === id && Date.parse(value.observation.retentionUntil) > now,
  );
  if (!job) throw new ProfileError(409, "job_unavailable");
  return job;
}
function makeParent(
  state: ProfileState,
  job: DiscoveryJob,
  now: number,
): ApplicationRecord {
  return {
    id: applicationIdentity(state.ownerId, state.generation, job.jobId),
    jobId: job.jobId,
    revision: 0,
    currentPackageId: null,
    manualStatus: "not_applied",
    createdAt: new Date(now).toISOString(),
    expiresAt: new Date(
      Math.min(
        Date.parse(job.observation.retentionUntil),
        now + applicationPolicy.retentionMs,
      ),
    ).toISOString(),
    attempts: [],
    packages: [],
    reviews: [],
  };
}
function recordAttempt(
  record: ApplicationRecord,
  input: { operationId: string },
  hash: string,
  kind: "generate" | "edit" | "review" | "status",
  packageId: string | null,
  now: number,
) {
  const pkg = record.packages.find((value) => value.id === packageId);
  record.attempts.push({
    operationId: input.operationId,
    requestHash: hash,
    kind,
    packageId,
    createdAt: new Date(now).toISOString(),
    expiresAt: pkg?.expiresAt ?? record.expiresAt,
  });
  record.revision += 1;
}
export function assertApplicationCapacity(state: ProfileState): void {
  const records = state.applications ?? [];
  if (
    records.length > applicationPolicy.maximumApplications ||
    records.reduce((n, record) => n + record.packages.length, 0) >
      applicationPolicy.maximumVersions ||
    records.reduce((n, record) => n + record.attempts.length, 0) >
      applicationPolicy.maximumAttempts ||
    records.reduce((n, record) => n + record.reviews.length, 0) >
      applicationPolicy.maximumReviews ||
    (records.length > 0 &&
      Buffer.byteLength(JSON.stringify(state)) > 700 * 1024)
  )
    throw new ProfileError(409, "application_capacity_reached");
}
export function retainedApplications(
  state: ProfileState,
  now: number,
): ApplicationRecord[] {
  return (state.applications ?? [])
    .filter((record) => Date.parse(record.expiresAt) > now)
    .map((record) => {
      const packages = record.packages.filter(
        (pkg) => Date.parse(pkg.expiresAt) > now,
      );
      const ids = new Set(packages.map((pkg) => pkg.id));
      return {
        ...record,
        packages,
        currentPackageId: ids.has(record.currentPackageId ?? "")
          ? record.currentPackageId
          : null,
        attempts: record.attempts.filter(
          (attempt) =>
            Date.parse(attempt.expiresAt) > now &&
            (attempt.packageId === null || ids.has(attempt.packageId)),
        ),
        reviews: record.reviews.filter((review) => ids.has(review.packageId)),
      };
    });
}
export function createApplicationOperations(context: Context) {
  const { checked, change, now, touch } = context;
  const applications = async (owner: string, getJobs: Jobs) => {
    const jobs = await getJobs();
    return applicationsResponseSchema.parse({
      applications: applicationViews(await checked(owner), jobs, now()),
    });
  };
  const generateApplication = async (
    owner: string,
    raw: unknown,
    getJobs: Jobs,
  ) => {
    const input = request(applicationGenerateSchema, raw);
    const hash = contentHash(["generate", input]);
    const jobs = await getJobs();
    await change(owner, (value) => {
      const state = active(value);
      if (retry(state, input.operationId, hash)) return state;
      const currentTime = now();
      const job = jobById(jobs, input.jobId, currentTime);
      if (
        job.currentRevisionId !== input.expectedJobRevisionId ||
        state.activeVersionId !== input.expectedActiveVersionId
      )
        throw new ProfileError(409, "application_inputs_changed");
      const profile = state.versions.find(
        (version) =>
          version.id === state.activeVersionId &&
          Date.parse(version.expiresAt) > currentTime,
      );
      const evaluation = state.evaluations.findLast(
        (result) =>
          result.jobId === job.jobId &&
          result.jobRevisionId === job.currentRevisionId &&
          result.profileVersionId === profile?.id &&
          result.profileHash === profile?.profileHash &&
          result.evaluatorVersion === currentEvaluatorVersion &&
          Date.parse(result.expiresAt) > currentTime,
      );
      if (!profile || !evaluation)
        throw new ProfileError(409, "current_evaluation_required");
      if (evaluation.eligibility !== "eligible")
        throw new ProfileError(
          409,
          evaluation.eligibility === "blocked"
            ? "confirmed_blocker"
            : "eligibility_needs_review",
        );
      checkedApplicationSource(job, currentTime);
      state.applications ??= [];
      let record = state.applications.find(
        (record) => record.jobId === job.jobId,
      );
      if (record && Date.parse(record.expiresAt) <= currentTime)
        throw new ProfileError(410, "application_expired");
      if (!record) {
        record = makeParent(state, job, currentTime);
        state.applications.push(record);
      }
      const effectiveCurrentPackageId = record.packages.some(
        (pkg) =>
          pkg.id === record.currentPackageId &&
          Date.parse(pkg.expiresAt) > currentTime,
      )
        ? record.currentPackageId
        : null;
      if (effectiveCurrentPackageId !== input.expectedCurrentPackageId)
        throw new ProfileError(409, "application_revision_conflict");
      const pkg = newApplicationPackage(
        record,
        profile,
        job,
        evaluation,
        input.operationId,
        currentTime,
      );
      record.packages.push(pkg);
      record.currentPackageId = pkg.id;
      recordAttempt(record, input, hash, "generate", pkg.id, currentTime);
      return touch(state, currentTime);
    });
    return applications(owner, getJobs);
  };
  const editApplication = async (
    owner: string,
    raw: unknown,
    getJobs: Jobs,
  ) => {
    const input = request(applicationEditSchema, raw);
    const hash = contentHash(["edit", input]);
    await change(owner, (value) => {
      const state = active(value);
      if (retry(state, input.operationId, hash)) return state;
      const record = parent(state, input.applicationId, now());
      if (
        record.revision !== input.expectedRevision ||
        record.currentPackageId !== input.basePackageId
      )
        throw new ProfileError(409, "application_revision_conflict");
      const base = record.packages.find(
        (pkg) =>
          pkg.id === input.basePackageId && Date.parse(pkg.expiresAt) > now(),
      );
      if (!base) throw new ProfileError(409, "package_unavailable");
      const pkg: ApplicationPackage = {
        ...base,
        id: "0".repeat(64),
        contentHash: "0".repeat(64),
        operationId: input.operationId,
        origin: "applicant_edit",
        basePackageId: base.id,
        content: input.content,
        createdAt: new Date(now()).toISOString(),
      };
      if (
        pkg.content.kind !== base.content.kind ||
        (pkg.content.kind === "questionnaire" &&
          base.content.kind === "questionnaire" &&
          (pkg.content.fields.length !== base.content.fields.length ||
            pkg.content.fields.some((field, index) => {
              const old =
                base.content.kind === "questionnaire"
                  ? base.content.fields[index]
                  : undefined;
              return (
                !old ||
                field.internalId !== old.internalId ||
                field.prompt !== old.prompt ||
                field.status !== old.status ||
                contentHash(field.factIds) !== contentHash(old.factIds) ||
                (old.status === "answered"
                  ? field.answer === null
                  : field.answer !== null)
              );
            })))
      )
        throw new ProfileError(400, "application_edit_structure_invalid");
      pkg.contentHash = packageContentHash(pkg);
      pkg.id = contentHash([record.id, input.operationId, pkg.contentHash]);
      record.packages.push(pkg);
      record.currentPackageId = pkg.id;
      recordAttempt(record, input, hash, "edit", pkg.id, now());
      return touch(state, now());
    });
    return applications(owner, getJobs);
  };
  const reviewApplication = async (
    owner: string,
    raw: unknown,
    getJobs: Jobs,
  ) => {
    const input = request(applicationReviewRequestSchema, raw);
    const hash = contentHash(["review", input]);
    const jobs = await getJobs();
    await change(owner, (value) => {
      const state = active(value);
      if (retry(state, input.operationId, hash)) return state;
      const record = parent(state, input.applicationId, now());
      const pkg = record.packages.find(
        (pkg) =>
          pkg.id === input.packageId &&
          pkg.contentHash === input.expectedContentHash &&
          Date.parse(pkg.expiresAt) > now(),
      );
      const view = applicationViews(state, jobs, now())
        .find((view) => view.id === record.id)
        ?.packages.find((view) => view.id === pkg?.id);
      if (!pkg || !view || view.readiness.status === "stale")
        throw new ProfileError(409, "package_inputs_changed");
      record.reviews.push({
        operationId: input.operationId,
        packageId: pkg.id,
        contentHash: pkg.contentHash,
        reviewedAt: new Date(now()).toISOString(),
      });
      recordAttempt(record, input, hash, "review", pkg.id, now());
      return touch(state, now());
    });
    return applications(owner, getJobs);
  };
  const setApplicationStatus = async (
    owner: string,
    raw: unknown,
    getJobs: Jobs,
  ) => {
    const input = request(applicationStatusSchema, raw);
    const hash = contentHash(["status", input]);
    const jobs = await getJobs();
    await change(owner, (value) => {
      const state =
        value === null ? context.newState(owner, now()) : active(value);
      if (retry(state, input.operationId, hash)) return state;
      state.applications ??= [];
      let record: ApplicationRecord;
      if ("applicationId" in input)
        record = parent(state, input.applicationId, now());
      else {
        const job = jobById(jobs, input.jobId, now());
        if (state.applications.some((record) => record.jobId === job.jobId))
          throw new ProfileError(409, "application_revision_conflict");
        record = makeParent(state, job, now());
        state.applications.push(record);
      }
      jobById(jobs, record.jobId, now());
      if (record.revision !== input.expectedRevision)
        throw new ProfileError(409, "application_revision_conflict");
      record.manualStatus = input.status;
      recordAttempt(record, input, hash, "status", null, now());
      return touch(state, now());
    });
    return applications(owner, getJobs);
  };
  const copyApplication = async (
    owner: string,
    raw: unknown,
    getJobs: Jobs,
  ) => {
    const input = request(applicationCopySchema, raw);
    const first = active(await checked(owner));
    const jobs = await getJobs();
    const state = active(await checked(owner));
    if (
      first.generation !== state.generation ||
      first.revision !== state.revision
    )
      throw new ProfileError(409, "application_inputs_changed");
    const pkg = applicationViews(state, jobs, now())
      .find((view) => view.id === input.applicationId)
      ?.packages.find(
        (pkg) =>
          pkg.id === input.packageId &&
          pkg.contentHash === input.expectedContentHash,
      );
    if (!pkg?.readiness.copyableFieldIds.includes(input.fieldId))
      throw new ProfileError(409, "package_not_copyable");
    const text =
      pkg.content.kind === "email"
        ? input.fieldId === "subject"
          ? pkg.content.subject
          : pkg.content.body
        : pkg.content.fields.find((field) => field.internalId === input.fieldId)
            ?.answer;
    if (!text) throw new ProfileError(409, "package_not_copyable");
    return {
      text,
      packageId: pkg.id,
      contentHash: pkg.contentHash,
      fieldId: input.fieldId,
    };
  };
  return {
    applications,
    generateApplication,
    editApplication,
    reviewApplication,
    setApplicationStatus,
    copyApplication,
  };
}
