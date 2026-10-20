import {
  applicationSourceSchema,
  type DiscoveryJob,
  jobIdentity,
  revisionIdentity,
} from "@job-search/discovery";
import {
  type ApplicationContent,
  type ApplicationPackage,
  type ApplicationRecord,
  type ApplicationView,
  applicationPackageSchema,
  applicationPolicy,
  applicationRendererVersion,
} from "./application-schema.js";
import { contentHash, ProfileError } from "./profile-pdf.js";
import {
  currentEvaluatorVersion,
  type ProfileState,
  type ProfileVersion,
} from "./profile-schema.js";

export function applicationSourcePayloadHash(input: unknown): string {
  const { review: _review, ...payload } = applicationSourceSchema.parse(input);
  return contentHash(payload);
}
export function checkedApplicationSource(
  job: DiscoveryJob,
  now: number,
  retained = false,
) {
  const source = job.observation.applicationSource;
  if (!source)
    throw new ProfileError(409, "reviewed_application_source_required");
  const sourceUrl = job.observation.finalUrl ?? job.observation.originalUrl;
  const synthetic = source.review.method === "synthetic_operator_fixture";
  const syntheticHost = (host: string) =>
    /\.(?:example|invalid|example\.test)$/.test(host);
  if (
    source.review.payloadHash !== applicationSourcePayloadHash(source) ||
    source.sourceId !== job.sourceId ||
    source.sourceRecordId !== job.sourceRecordId ||
    source.sourceUrl !== sourceUrl ||
    Date.parse(source.review.reviewedAt) > now ||
    (!retained && Date.parse(source.review.expiresAt) <= now) ||
    (synthetic &&
      (!source.sourceId.startsWith("synthetic") ||
        !syntheticHost(new URL(sourceUrl).hostname) ||
        (source.kind === "email"
          ? !syntheticHost(source.recipient.split("@").at(-1) ?? "")
          : !syntheticHost(new URL(source.url).hostname))))
  )
    throw new ProfileError(503, "application_source_invalid");
  if (source.kind === "email") {
    if (
      source.evidence.url !== sourceUrl ||
      !source.evidence.quote.includes(source.recipient) ||
      !/\b(?:apply|applications?|bewerb\w*)\b/i.test(source.evidence.quote) ||
      /\b(?:privacy|support|questions?|inquir\w*|keine|nicht|not)\b/i.test(
        source.evidence.quote,
      )
    )
      throw new ProfileError(503, "application_source_invalid");
  } else if (
    source.evidence.url !== source.url ||
    source.fields.some(
      (field) =>
        field.evidence.url !== source.url ||
        !field.evidence.quote.includes(field.prompt),
    )
  )
    throw new ProfileError(503, "application_source_invalid");
  return source;
}
export const applicationIdentity = (
  owner: string,
  generation: string,
  jobId: string,
) => contentHash([owner, generation, jobId]);
export function packageContentHash(pkg: ApplicationPackage): string {
  const {
    id: _id,
    contentHash: _hash,
    ...payload
  } = applicationPackageSchema.parse(pkg);
  return contentHash(payload);
}
const categories = {
  working_languages: "working_language",
  skills: "skill",
  employment_preferences: "employment_preference",
  location_preferences: "location_preference",
  weekly_availability: "weekly_availability_hours",
  work_authorization: "work_authorization",
} as const;
function supportedQuestion(
  kind: keyof typeof categories,
  prompt: string,
): boolean {
  const normalized = prompt
    .trim()
    .replace(/[?.:]$/, "")
    .toLowerCase();
  const prompts = {
    working_languages: [
      "which languages do you speak",
      "what are your working languages",
    ],
    skills: ["what are your skills", "which skills do you have"],
    employment_preferences: [
      "what is your preferred employment type",
      "what are your employment preferences",
    ],
    location_preferences: [
      "what are your preferred work locations",
      "what are your location preferences",
    ],
    weekly_availability: [
      "how many hours are you available per week",
      "what is your weekly availability",
    ],
    work_authorization: [
      "what is your work authorization",
      "what work authorization do you hold",
    ],
  };
  return prompts[kind].includes(normalized);
}
export function renderApplication(
  profile: ProfileVersion,
  job: DiscoveryJob,
): { content: ApplicationContent; factIds: string[] } {
  const source = job.observation.applicationSource;
  if (!source || !job.observation.title || !job.observation.employer)
    throw new ProfileError(409, "application_input_unavailable");
  if (source.kind === "email") {
    const labels = {
      working_language: "Working language",
      skill: "Skill",
      employment_preference: "Employment preference",
      location_preference: "Location preference",
      weekly_availability_hours: "Weekly availability (hours)",
    };
    const facts = profile.facts.filter(
      (fact) =>
        fact.category !== "work_authorization" && fact.category !== "other",
    );
    return {
      content: {
        kind: "email",
        subject: `Application for ${job.observation.title.value}`,
        body: `Dear hiring team,\n\nI would like to apply for ${job.observation.title.value} at ${job.observation.employer.value}.\n\nMy background and preferences:\n${facts.map((fact) => `- ${fact.category === "work_authorization" || fact.category === "other" ? "" : labels[fact.category]}: ${fact.value}`).join("\n")}\n\nThank you for considering my application.`,
      },
      factIds: facts.map((fact) => fact.id),
    };
  }
  const fields = source.fields.map((field) => {
    if (
      ["consent", "signature", "declaration"].includes(field.answerKind) ||
      /\b(?:consent|agree|declare|declaration|signature|certify|acknowledge)\b/i.test(
        field.prompt,
      )
    )
      return {
        internalId: field.internalId,
        prompt: field.prompt,
        status: "applicant_action_required" as const,
        answer: null,
        factIds: [],
      };
    const mapping = Object.entries(categories).find(
      ([kind]) => kind === field.answerKind,
    );
    const kind = mapping?.[0];
    const supported =
      kind &&
      (kind === "working_languages" ||
        kind === "skills" ||
        kind === "employment_preferences" ||
        kind === "location_preferences" ||
        kind === "weekly_availability" ||
        kind === "work_authorization") &&
      supportedQuestion(kind, field.prompt);
    const facts = supported
      ? profile.facts.filter((fact) => fact.category === categories[kind])
      : [];
    return {
      internalId: field.internalId,
      prompt: field.prompt,
      status: facts.length ? ("answered" as const) : ("needs_input" as const),
      answer: facts.length ? facts.map((fact) => fact.value).join("\n") : null,
      factIds: facts.map((fact) => fact.id),
    };
  });
  return {
    content: { kind: "questionnaire", fields },
    factIds: [...new Set(fields.flatMap((field) => field.factIds))],
  };
}
export function validateApplicationState(state: ProfileState): void {
  const records = state.applications ?? [];
  if (
    records.length > applicationPolicy.maximumApplications ||
    records.reduce((n, record) => n + record.packages.length, 0) >
      applicationPolicy.maximumVersions ||
    records.reduce((n, record) => n + record.attempts.length, 0) >
      applicationPolicy.maximumAttempts ||
    records.reduce((n, record) => n + record.reviews.length, 0) >
      applicationPolicy.maximumReviews
  )
    throw new ProfileError(409, "application_capacity_reached");
  const operations = records.flatMap((record) =>
    record.attempts.map((attempt) => attempt.operationId),
  );
  if (
    new Set(records.map((record) => record.id)).size !== records.length ||
    new Set(operations).size !== operations.length
  )
    throw new ProfileError(503, "private_record_invalid");
  const invalid = (): never => {
    throw new ProfileError(503, "private_record_invalid");
  };
  for (const record of records) {
    if (
      record.id !==
        applicationIdentity(state.ownerId, state.generation, record.jobId) ||
      Date.parse(record.expiresAt) <= Date.parse(record.createdAt) ||
      Date.parse(record.expiresAt) - Date.parse(record.createdAt) >
        applicationPolicy.retentionMs ||
      (record.currentPackageId !== null &&
        !record.packages.some((pkg) => pkg.id === record.currentPackageId)) ||
      new Set(record.packages.map((pkg) => pkg.id)).size !==
        record.packages.length
    )
      invalid();
    for (const pkg of record.packages) {
      if (
        new Set(pkg.factIds).size !== pkg.factIds.length ||
        (pkg.content.kind === "questionnaire" &&
          new Set(pkg.content.fields.map((field) => field.internalId)).size !==
            pkg.content.fields.length)
      )
        invalid();
      const profile = state.versions.find(
        (version) =>
          version.id === pkg.profileVersionId &&
          version.profileHash === pkg.profileHash,
      );
      const evaluation = state.evaluations.find(
        (value) => value.id === pkg.evaluationId,
      );
      const job = pkg.jobSnapshot;
      checkedApplicationSource(job, Date.parse(pkg.createdAt), true);
      if (
        !profile ||
        !evaluation ||
        pkg.jobId !== record.jobId ||
        job.jobId !== record.jobId ||
        job.jobId !== jobIdentity(job.sourceId, job.sourceRecordId) ||
        job.sourceId !== job.observation.sourceId ||
        job.sourceRecordId !== job.observation.sourceRecordId ||
        job.currentRevisionId !== pkg.jobRevisionId ||
        job.currentRevisionId !== revisionIdentity(job.observation) ||
        pkg.sourceSpecHash !== contentHash(pkg.source) ||
        contentHash(pkg.source) !==
          contentHash(job.observation.applicationSource) ||
        pkg.jobTitle !== job.observation.title?.value ||
        pkg.employer !== job.observation.employer?.value ||
        pkg.originalUrl !== job.observation.originalUrl ||
        evaluation.profileVersionId !== pkg.profileVersionId ||
        evaluation.profileHash !== pkg.profileHash ||
        evaluation.jobId !== record.jobId ||
        evaluation.jobRevisionId !== pkg.jobRevisionId ||
        evaluation.evaluatorVersion !== pkg.evaluatorVersion ||
        pkg.id !== contentHash([record.id, pkg.operationId, pkg.contentHash]) ||
        pkg.contentHash !== packageContentHash(pkg) ||
        Date.parse(pkg.createdAt) <
          Math.max(
            Date.parse(record.createdAt),
            Date.parse(profile.approvedAt),
            Date.parse(evaluation.evaluatedAt),
            Date.parse(job.observation.observedAt),
            Date.parse(pkg.source.review.reviewedAt),
          ) ||
        Date.parse(pkg.expiresAt) <= Date.parse(pkg.createdAt) ||
        Date.parse(pkg.expiresAt) >
          Math.min(
            Date.parse(record.expiresAt),
            Date.parse(profile.expiresAt),
            Date.parse(evaluation.expiresAt),
            Date.parse(pkg.source.review.expiresAt),
            Date.parse(job.observation.retentionUntil),
            Date.parse(pkg.createdAt) + applicationPolicy.retentionMs,
          ) ||
        pkg.factIds.some((id) => !profile.facts.some((fact) => fact.id === id))
      )
        invalid();
      if (!profile || !evaluation)
        throw new ProfileError(503, "private_record_invalid");
      const rendered = renderApplication(profile, job);
      if (
        pkg.origin === "generated" &&
        (pkg.basePackageId !== null ||
          contentHash(pkg.content) !== contentHash(rendered.content) ||
          contentHash(pkg.factIds) !== contentHash(rendered.factIds))
      )
        invalid();
      if (pkg.origin === "applicant_edit") {
        const base = record.packages.find(
          (value) => value.id === pkg.basePackageId,
        );
        if (
          !base ||
          pkg.content.kind !== base.content.kind ||
          contentHash(pkg.factIds) !== contentHash(base.factIds) ||
          pkg.expiresAt !== base.expiresAt ||
          Date.parse(pkg.createdAt) < Date.parse(base.createdAt) ||
          pkg.id === base.id ||
          pkg.profileVersionId !== base.profileVersionId ||
          pkg.profileHash !== base.profileHash ||
          pkg.evaluationId !== base.evaluationId ||
          pkg.jobRevisionId !== base.jobRevisionId ||
          pkg.sourceSpecHash !== base.sourceSpecHash ||
          contentHash(pkg.jobSnapshot) !== contentHash(base.jobSnapshot)
        )
          invalid();
        if (!base) throw new ProfileError(503, "private_record_invalid");
        if (
          pkg.content.kind === "questionnaire" &&
          base.content.kind === "questionnaire" &&
          pkg.content.fields.length !== base.content.fields.length
        )
          invalid();
        if (
          pkg.content.kind === "questionnaire" &&
          base.content.kind === "questionnaire"
        )
          for (const [index, field] of pkg.content.fields.entries()) {
            const original = base.content.fields[index];
            if (
              !original ||
              field.internalId !== original.internalId ||
              field.prompt !== original.prompt ||
              field.status !== original.status ||
              contentHash(field.factIds) !== contentHash(original.factIds) ||
              (original.status !== "answered" && field.answer !== null) ||
              (original.status === "answered" && field.answer === null)
            )
              invalid();
          }
      }
      if (
        !record.attempts.some(
          (attempt) =>
            attempt.packageId === pkg.id &&
            attempt.operationId === pkg.operationId &&
            attempt.kind === (pkg.origin === "generated" ? "generate" : "edit"),
        )
      )
        invalid();
    }
    for (const attempt of record.attempts)
      if (
        Date.parse(attempt.expiresAt) > Date.parse(record.expiresAt) ||
        Date.parse(attempt.expiresAt) <= Date.parse(attempt.createdAt) ||
        (attempt.packageId &&
          !record.packages.some((pkg) => pkg.id === attempt.packageId))
      )
        invalid();
    for (const review of record.reviews)
      if (
        !record.packages.some(
          (pkg) =>
            pkg.id === review.packageId &&
            pkg.contentHash === review.contentHash &&
            Date.parse(review.reviewedAt) >= Date.parse(pkg.createdAt) &&
            Date.parse(review.reviewedAt) < Date.parse(pkg.expiresAt),
        ) ||
        !record.attempts.some(
          (attempt) =>
            attempt.operationId === review.operationId &&
            attempt.kind === "review" &&
            attempt.packageId === review.packageId,
        )
      )
        invalid();
  }
}
export function applicationViews(
  state: ProfileState | null,
  jobs: readonly DiscoveryJob[],
  now: number,
): ApplicationView[] {
  if (state?.lifecycle !== "active") return [];
  return (state.applications ?? [])
    .filter((record) => Date.parse(record.expiresAt) > now)
    .map((record) => {
      const { reviews: _reviews, ...recordView } = record;
      const visiblePackages = record.packages.filter(
        (pkg) => Date.parse(pkg.expiresAt) > now,
      );
      const visibleIds = new Set(visiblePackages.map((pkg) => pkg.id));
      return {
        ...recordView,
        currentPackageId: visibleIds.has(record.currentPackageId ?? "")
          ? record.currentPackageId
          : null,
        attempts: record.attempts.filter(
          (attempt) =>
            Date.parse(attempt.expiresAt) > now &&
            (attempt.packageId === null || visibleIds.has(attempt.packageId)),
        ),
        packages: visiblePackages.map((pkg) => {
          const review =
            record.reviews.findLast(
              (value) =>
                value.packageId === pkg.id &&
                value.contentHash === pkg.contentHash,
            ) ?? null;
          const job = jobs.find((value) => value.jobId === record.jobId);
          const evaluation = state.evaluations.find(
            (value) => value.id === pkg.evaluationId,
          );
          const reasons: string[] = [];
          if (record.currentPackageId !== pkg.id)
            reasons.push("not_current_package");
          if (
            state.activeVersionId !== pkg.profileVersionId ||
            !state.versions.some(
              (profile) =>
                profile.id === pkg.profileVersionId &&
                profile.profileHash === pkg.profileHash &&
                Date.parse(profile.expiresAt) > now,
            )
          )
            reasons.push("profile_changed_or_expired");
          if (
            !job ||
            job.currentRevisionId !== pkg.jobRevisionId ||
            Date.parse(job.observation.retentionUntil) <= now ||
            !job.observation.applicationSource ||
            contentHash(job.observation.applicationSource) !==
              pkg.sourceSpecHash
          )
            reasons.push("source_changed_or_expired");
          else checkedApplicationSource(job, now);
          if (
            !evaluation ||
            Date.parse(evaluation.expiresAt) <= now ||
            evaluation.evaluatorVersion !== currentEvaluatorVersion
          )
            reasons.push("evaluation_changed_or_expired");
          const stale = reasons.length > 0;
          if (evaluation?.eligibility !== "eligible")
            reasons.push("eligibility_not_confirmed");
          if (pkg.origin === "applicant_edit")
            reasons.push("edited_content_not_automatically_grounded");
          if (!review) reasons.push("exact_review_required");
          let status:
            | "ready"
            | "needs_review"
            | "needs_input"
            | "applicant_action_required"
            | "stale"
            | "edited_unverified" = stale
            ? "stale"
            : pkg.origin === "applicant_edit"
              ? "edited_unverified"
              : !review || evaluation?.eligibility !== "eligible"
                ? "needs_review"
                : "ready";
          if (status === "ready" && pkg.content.kind === "questionnaire") {
            if (
              pkg.content.fields.some((field) => field.status === "needs_input")
            )
              status = "needs_input";
            else if (
              pkg.content.fields.some(
                (field) => field.status === "applicant_action_required",
              )
            )
              status = "applicant_action_required";
          }
          const copyableFieldIds =
            !stale &&
            pkg.origin === "generated" &&
            review &&
            evaluation?.eligibility === "eligible"
              ? pkg.content.kind === "email"
                ? ["subject", "body"]
                : pkg.content.fields
                    .filter(
                      (field) =>
                        field.status === "answered" && field.answer !== null,
                    )
                    .map((field) => field.internalId)
              : [];
          return {
            ...pkg,
            review,
            readiness: { status, reasons, copyableFieldIds },
          };
        }),
      };
    });
}
export function newApplicationPackage(
  record: ApplicationRecord,
  profile: ProfileVersion,
  job: DiscoveryJob,
  evaluation: ProfileState["evaluations"][number],
  operationId: string,
  now: number,
): ApplicationPackage {
  const source = checkedApplicationSource(job, now);
  const rendered = renderApplication(profile, job);
  const pkg = applicationPackageSchema.parse({
    id: "0".repeat(64),
    contentHash: "0".repeat(64),
    operationId,
    origin: "generated",
    basePackageId: null,
    ...rendered,
    source,
    jobSnapshot: job,
    jobId: job.jobId,
    jobRevisionId: job.currentRevisionId,
    jobTitle: job.observation.title?.value,
    employer: job.observation.employer?.value,
    originalUrl: job.observation.originalUrl,
    profileVersionId: profile.id,
    profileHash: profile.profileHash,
    evaluationId: evaluation.id,
    evaluatorVersion: evaluation.evaluatorVersion,
    sourceSpecHash: contentHash(source),
    rendererVersion: applicationRendererVersion,
    createdAt: new Date(now).toISOString(),
    expiresAt: new Date(
      Math.min(
        Date.parse(record.expiresAt),
        Date.parse(profile.expiresAt),
        Date.parse(evaluation.expiresAt),
        Date.parse(source.review.expiresAt),
        Date.parse(job.observation.retentionUntil),
        now + applicationPolicy.retentionMs,
      ),
    ).toISOString(),
  });
  pkg.contentHash = packageContentHash(pkg);
  pkg.id = contentHash([record.id, operationId, pkg.contentHash]);
  return pkg;
}
