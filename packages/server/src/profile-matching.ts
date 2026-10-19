import type { DiscoveryJob } from "@job-search/discovery";
import type { z } from "zod";
import { contentHash, ProfileError } from "./profile-pdf.js";
import {
  assessmentSuggestionSchema,
  type evaluationReasonSchema,
  type PrivateEvaluation,
  type ProfileFact,
  type ProfileVersion,
  privateEvaluationSchema,
} from "./profile-schema.js";

type Reason = z.infer<typeof evaluationReasonSchema>;
const normalized = (value: string) =>
  value.trim().toLowerCase().replace(/[_-]+/g, " ").replace(/\s+/g, " ");
function format(value: string): string | undefined {
  return new Map([
    ["part time", "part_time"],
    ["teilzeit", "part_time"],
    ["working student", "working_student"],
    ["werkstudent", "working_student"],
    ["minijob", "minijob"],
    ["mini job", "minijob"],
    ["short term", "short_term"],
    ["temporary", "short_term"],
    ["full time", "full_time"],
    ["freelance", "freelance"],
  ]).get(normalized(value));
}
export type AssessmentHook = {
  version: string;
  promptVersion: string;
  modelVersion: string;
  assess(input: {
    facts: Pick<ProfileFact, "id" | "category" | "value">[];
    title: string | null;
    deterministic: Pick<
      PrivateEvaluation,
      "eligibility" | "fitScore" | "evidenceConfidence"
    >;
  }): Promise<unknown>;
};

/** Eligibility gates run first; optional assessments cannot upgrade a hard/unknown gate. */
export async function evaluateProfileJob(
  profile: ProfileVersion,
  job: DiscoveryJob,
  now: number,
  hook?: AssessmentHook,
): Promise<PrivateEvaluation> {
  const observation = job.observation;
  if (
    Date.parse(profile.expiresAt) <= now ||
    Date.parse(observation.retentionUntil) <= now
  )
    throw new ProfileError(410, "evaluation_input_expired");
  const reasons: Reason[] = [];
  const facts = (category: ProfileFact["category"]) =>
    profile.facts.filter((fact) => fact.category === category);
  const add = (
    code: Reason["code"],
    outcome: Reason["outcome"],
    jobField: Reason["jobField"],
    quote: string | null,
    related: ProfileFact[] = [],
  ) =>
    reasons.push({
      code,
      outcome,
      jobField,
      quote,
      factIds: related.map((fact) => fact.id),
    });
  if (observation.kind !== "vacancy_detail")
    add("not_a_vacancy", "unknown", "kind", null);
  if (!observation.expiresAt)
    add("freshness_unknown", "unknown", "expiresAt", null);
  else if (Date.parse(observation.expiresAt) <= now)
    add("expired_posting", "blocked", "expiresAt", observation.expiresAt);
  else
    add(
      "supported_conditions",
      "supported",
      "expiresAt",
      observation.expiresAt,
    );

  const languages = facts("working_language");
  if (!languages.some((fact) => normalized(fact.value) === "english"))
    add(
      "profile_language_unknown",
      "unknown",
      "englishAccepted",
      null,
      languages,
    );
  else if (observation.englishAccepted.status === "unknown")
    add("language_unknown", "unknown", "englishAccepted", null, languages);
  else
    add(
      observation.englishAccepted.value
        ? "supported_conditions"
        : "language_incompatible",
      observation.englishAccepted.value ? "supported" : "blocked",
      "englishAccepted",
      observation.englishAccepted.evidence.quote,
      languages,
    );

  const preferences = facts("location_preference");
  const berlin = preferences.some((fact) =>
    ["berlin", "berlin on site", "berlin hybrid"].includes(
      normalized(fact.value),
    ),
  );
  const remote = preferences.some((fact) =>
    ["remote from germany", "germany remote"].includes(normalized(fact.value)),
  );
  const location = observation.location?.value ?? "";
  if (!berlin && !remote)
    add(
      "profile_preferences_unknown",
      "unknown",
      "location",
      null,
      preferences,
    );
  else if (
    /\bremote\b/i.test(location) &&
    observation.remoteFromGermany.status === "confirmed" &&
    !observation.remoteFromGermany.value
  )
    add(
      "germany_remote_incompatible",
      "blocked",
      "remoteFromGermany",
      observation.remoteFromGermany.evidence.quote,
      preferences,
    );
  else if (
    berlin &&
    /\bberlin\b/i.test(location) &&
    !/\bremote\b/i.test(location)
  )
    add(
      "supported_conditions",
      "supported",
      "location",
      observation.location?.evidence.quote ?? null,
      preferences,
    );
  else if (
    remote &&
    observation.remoteFromGermany.status === "confirmed" &&
    observation.remoteFromGermany.value
  )
    add(
      "supported_conditions",
      "supported",
      "remoteFromGermany",
      observation.remoteFromGermany.evidence.quote,
      preferences,
    );
  else if (/\bremote\b/i.test(location) && remote) {
    if (observation.remoteFromGermany.status === "unknown")
      add(
        "germany_remote_unknown",
        "unknown",
        "remoteFromGermany",
        null,
        preferences,
      );
    else
      add(
        "germany_remote_incompatible",
        "blocked",
        "remoteFromGermany",
        observation.remoteFromGermany.evidence.quote,
        preferences,
      );
  } else if (/^[^,]+,\s*[^,]+$/.test(location) && !/\bremote\b/i.test(location))
    add(
      "location_incompatible",
      "blocked",
      "location",
      observation.location?.evidence.quote ?? null,
      preferences,
    );
  else add("location_unknown", "unknown", "location", null, preferences);

  const employment = facts("employment_preference");
  const preferred = employment
    .map((fact) => format(fact.value))
    .filter((value) => value !== undefined);
  const actual = observation.employmentType
    ? format(observation.employmentType.value)
    : undefined;
  if (!preferred.length)
    add(
      "profile_preferences_unknown",
      "unknown",
      "employmentType",
      null,
      employment,
    );
  else if (!actual)
    add(
      "employment_unknown",
      "unknown",
      "employmentType",
      observation.employmentType?.evidence.quote ?? null,
      employment,
    );
  else
    add(
      preferred.includes(actual)
        ? "supported_conditions"
        : "employment_incompatible",
      preferred.includes(actual) ? "supported" : "blocked",
      "employmentType",
      observation.employmentType?.evidence.quote ?? null,
      employment,
    );

  const availability = facts("weekly_availability_hours");
  const declaredHours = [
    ...new Set(
      availability.map((fact) =>
        /^\d+(?:\.\d+)?$/.test(fact.value.trim()) ? Number(fact.value) : NaN,
      ),
    ),
  ];
  const available =
    declaredHours.length === 1 &&
    Number.isFinite(declaredHours[0]) &&
    (declaredHours[0] ?? -1) >= 0 &&
    (declaredHours[0] ?? 169) <= 168
      ? declaredHours[0]
      : undefined;
  if (available === undefined)
    add(
      "profile_availability_unknown",
      "unknown",
      "weeklyHours",
      null,
      availability,
    );
  else if (observation.weeklyHours?.status !== "confirmed")
    add("hours_unknown", "unknown", "weeklyHours", null, availability);
  else if (observation.weeklyHours.minimum > available)
    add(
      "hours_incompatible",
      "blocked",
      "weeklyHours",
      observation.weeklyHours.evidence.quote,
      availability,
    );
  else if (observation.weeklyHours.maximum > available)
    add(
      "hours_range_unknown",
      "unknown",
      "weeklyHours",
      observation.weeklyHours.evidence.quote,
      availability,
    );
  else
    add(
      "supported_conditions",
      "supported",
      "weeklyHours",
      observation.weeklyHours.evidence.quote,
      availability,
    );

  const authorization = facts("work_authorization");
  const declarations = [
    ...new Set(authorization.map((fact) => normalized(fact.value))),
  ];
  const declaration = declarations.length === 1 ? declarations[0] : undefined;
  if (
    !declaration ||
    ![
      "employee work in germany",
      "not permitted employee work in germany",
    ].includes(declaration)
  )
    add(
      "profile_authorization_unknown",
      "unknown",
      "workAuthorization",
      null,
      authorization,
    );
  else if (observation.workAuthorization?.status !== "confirmed")
    add(
      "authorization_unknown",
      "unknown",
      "workAuthorization",
      null,
      authorization,
    );
  else if (
    observation.workAuthorization.requirement === "additional_restrictions"
  )
    add(
      "additional_authorization_restrictions",
      "unknown",
      "workAuthorization",
      observation.workAuthorization.evidence.quote,
      authorization,
    );
  else
    add(
      declaration === "employee work in germany"
        ? "supported_conditions"
        : "authorization_incompatible",
      declaration === "employee work in germany" ? "supported" : "blocked",
      "workAuthorization",
      observation.workAuthorization.evidence.quote,
      authorization,
    );

  const eligibility = reasons.some((reason) => reason.outcome === "blocked")
    ? "blocked"
    : reasons.some((reason) => reason.outcome === "unknown")
      ? "needs_review"
      : "eligible";
  const decisive = reasons.filter(
    (reason) => reason.outcome !== "informational",
  );
  const evidenceConfidence =
    decisive.filter((reason) => reason.outcome !== "unknown").length /
    decisive.length;
  const titleWords = new Set(
    normalized(observation.title?.value ?? "")
      .split(/[^\p{L}\p{N}]+/u)
      .filter(Boolean),
  );
  const skills = facts("skill");
  const overlaps = skills.filter((fact) => {
    const words = normalized(fact.value)
      .split(/[^\p{L}\p{N}]+/u)
      .filter(Boolean);
    return words.length > 0 && words.every((word) => titleWords.has(word));
  });
  add(
    overlaps.length ? "title_skill_overlap" : "no_title_skill_overlap",
    "informational",
    "title",
    observation.title?.evidence.quote ?? null,
    overlaps,
  );
  let fitScore =
    eligibility === "eligible"
      ? 50 + Math.round((50 * overlaps.length) / Math.max(skills.length, 1))
      : null;
  let confidence = evidenceConfidence;
  const assessment = hook
    ? privateEvaluationSchema.shape.assessment.unwrap().parse({
        version: hook.version,
        promptVersion: hook.promptVersion,
        modelVersion: hook.modelVersion,
      })
    : undefined;
  if (hook) {
    const suggestion = assessmentSuggestionSchema.parse(
      await hook.assess({
        facts: profile.facts
          .filter((fact) => fact.category === "skill")
          .map(({ id, category, value }) => ({ id, category, value })),
        title: observation.title?.value ?? null,
        deterministic: { eligibility, fitScore, evidenceConfidence },
      }),
    );
    if (eligibility === "eligible") fitScore = suggestion.fitScore;
    confidence = Math.min(confidence, suggestion.evidenceConfidence);
  }
  return privateEvaluationSchema.parse({
    id: contentHash([
      profile.ownerId,
      profile.id,
      profile.profileHash,
      job.jobId,
      job.currentRevisionId,
      "g5-deterministic-v1",
      assessment ?? null,
    ]),
    ownerId: profile.ownerId,
    jobId: job.jobId,
    jobRevisionId: job.currentRevisionId,
    profileVersionId: profile.id,
    profileHash: profile.profileHash,
    evaluatorVersion: "g5-deterministic-v1",
    ...(assessment ? { assessment } : {}),
    eligibility,
    fitScore,
    evidenceConfidence: confidence,
    reasons,
    evaluatedAt: new Date(now).toISOString(),
    expiresAt: new Date(
      Math.min(
        now + 7 * 86_400_000,
        Date.parse(profile.expiresAt),
        Date.parse(observation.retentionUntil),
        observation.expiresAt && Date.parse(observation.expiresAt) > now
          ? Date.parse(observation.expiresAt)
          : Infinity,
      ),
    ).toISOString(),
  });
}
