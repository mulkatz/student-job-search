import type { DiscoveryJob } from "@job-search/discovery";
import type { z } from "zod";
import { contentHash, ProfileError } from "./profile-pdf.js";
import {
  assessmentSuggestionSchema,
  currentEvaluatorVersion,
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
    ["part time employee", "part_time"],
    ["part time employee role", "part_time"],
    ["working student employee", "working_student"],
    ["short term employee", "short_term"],
    ["full time employee", "full_time"],
    ["freelancer", "freelance"],
  ]).get(normalized(value));
}
type Outcome = Reason["outcome"];
function reason(
  code: Reason["code"],
  outcome: Outcome,
  jobField: Reason["jobField"],
  quote: string | null,
  related: ProfileFact[],
): Reason {
  return {
    code,
    outcome,
    jobField,
    quote,
    factIds: [...new Set(related.map((fact) => fact.id))],
  };
}
function combineAlternatives(
  alternatives: Reason[],
  supported: Reason,
): Reason {
  return alternatives.some((alternative) => alternative.outcome === "supported")
    ? supported
    : (alternatives.find((alternative) => alternative.outcome === "unknown") ??
        alternatives[0] ??
        supported);
}
function combineRequirements(
  requirements: Reason[],
  supported: Reason,
): Reason {
  return (
    requirements.find((requirement) => requirement.outcome === "blocked") ??
    requirements.find((requirement) => requirement.outcome === "unknown") ??
    supported
  );
}
const languageAliases = new Map([
  ["en", "english"],
  ["eng", "english"],
  ["de", "german"],
  ["deu", "german"],
  ["deutsch", "german"],
  ["ru", "russian"],
  ["rus", "russian"],
  ["russisch", "russian"],
  ["fr", "french"],
  ["fra", "french"],
  ["français", "french"],
  ["francais", "french"],
  ["es", "spanish"],
  ["spa", "spanish"],
  ["español", "spanish"],
]);
const languageName = (value: string) =>
  languageAliases.get(normalized(value)) ?? normalized(value);
const cefr = new Map([
  ["A1", 0],
  ["A2", 1],
  ["B1", 2],
  ["B2", 3],
  ["C1", 4],
  ["C2", 5],
]);
type LanguageClaim = {
  language: string;
  ability: "yes" | "no" | "unknown";
  level: number | undefined;
  fluent: boolean;
  fact: ProfileFact;
};
function languageClaims(facts: ProfileFact[]): LanguageClaim[] {
  return facts.flatMap((fact) =>
    fact.value
      .split(/\s*(?:,|;|\band\b)\s*/i)
      .filter(Boolean)
      .map((value): LanguageClaim => {
        const denied =
          /^(?:no|not spoken:)\s+(.+)$/i.exec(value) ??
          /^(.+?)(?:\s*[:(-]\s*|\s+)(?:not spoken|not proficient|no ability|none)\)?$/i.exec(
            value,
          );
        if (denied?.[1])
          return {
            language: languageName(denied[1]),
            ability: "no",
            level: undefined,
            fluent: false,
            fact,
          };
        const uncertain =
          /^(.+?)(?:\s*[:(-]\s*|\s+)(?:unknown|not assessed|unconfirmed|basic|beginner|conversational)\)?$/i.exec(
            value,
          );
        if (uncertain?.[1])
          return {
            language: languageName(uncertain[1]),
            ability: "unknown",
            level: undefined,
            fluent: false,
            fact,
          };
        const qualified =
          /^(.+?)(?:\s*[:(-]\s*|\s+)(A1|A2|B1|B2|C1|C2|fluent|native(?: speaker)?)\)?$/i.exec(
            value,
          );
        return {
          language: languageName(qualified?.[1] ?? value),
          ability: "yes",
          level: qualified?.[2]
            ? cefr.get(qualified[2].toUpperCase())
            : undefined,
          fluent: qualified?.[2]?.toLowerCase() === "fluent",
          fact,
        };
      }),
  );
}
function languageGate(
  observation: DiscoveryJob["observation"],
  facts: ProfileFact[],
): Reason {
  const source = observation.languageRequirements;
  const supported = reason(
    "supported_conditions",
    "supported",
    "languageRequirements",
    source && source.status !== "unknown"
      ? source.evidence.quote
      : observation.englishAccepted.status === "confirmed"
        ? observation.englishAccepted.evidence.quote
        : null,
    facts,
  );
  if (source?.status === "conflicting")
    return reason(
      "language_requirements_conflicting",
      "unknown",
      "languageRequirements",
      source.evidence.quote,
      facts,
    );
  const claims = languageClaims(facts);
  const check = (
    language: string,
    minimum: string | null,
    quote: string,
  ): Reason => {
    const relevant = claims.filter(
      (claim) => claim.language === languageName(language),
    );
    const related = relevant.map((claim) => claim.fact);
    if (!relevant.length)
      return reason(
        "profile_language_unknown",
        "unknown",
        "languageRequirements",
        quote,
        related,
      );
    const levels = new Set(
      relevant.flatMap((claim) =>
        claim.level === undefined ? [] : [claim.level],
      ),
    );
    const abilities = new Set(relevant.map((claim) => claim.ability));
    if (
      abilities.has("unknown") ||
      (abilities.has("yes") && abilities.has("no")) ||
      levels.size > 1
    )
      return reason(
        "language_requirements_conflicting",
        "unknown",
        "languageRequirements",
        quote,
        related,
      );
    if (abilities.has("no"))
      return reason(
        "language_incompatible",
        "blocked",
        "languageRequirements",
        quote,
        related,
      );
    if (minimum === "fluent")
      return reason(
        relevant.some((claim) => claim.fluent)
          ? "supported_conditions"
          : "language_proficiency_unknown",
        relevant.some((claim) => claim.fluent) ? "supported" : "unknown",
        "languageRequirements",
        quote,
        related,
      );
    const required = minimum ? cefr.get(minimum) : undefined;
    if (required !== undefined) {
      const actual = relevant.find((claim) => claim.level !== undefined)?.level;
      return reason(
        actual === undefined
          ? "language_proficiency_unknown"
          : actual < required
            ? "language_incompatible"
            : "supported_conditions",
        actual === undefined
          ? "unknown"
          : actual < required
            ? "blocked"
            : "supported",
        "languageRequirements",
        quote,
        related,
      );
    }
    return reason(
      "supported_conditions",
      "supported",
      "languageRequirements",
      quote,
      related,
    );
  };
  if (source?.status === "complete") {
    const contradictsEnglish =
      observation.englishAccepted.status === "confirmed" &&
      !observation.englishAccepted.value &&
      source.alternatives.some((set) =>
        set.some(
          (requirement) => languageName(requirement.language) === "english",
        ),
      );
    const alternatives = source.alternatives.map((set) =>
      combineRequirements(
        set.map((requirement) =>
          contradictsEnglish && languageName(requirement.language) === "english"
            ? reason(
                "language_requirements_conflicting",
                "unknown",
                "languageRequirements",
                requirement.evidence.quote,
                facts,
              )
            : check(
                requirement.language,
                requirement.minimumLevel,
                requirement.evidence.quote,
              ),
        ),
        supported,
      ),
    );
    return combineAlternatives(alternatives, supported);
  }
  // A legacy acceptance flag is not a complete inventory of required languages.
  const legacy = observation.englishAccepted;
  const explicitEnglishAlone =
    legacy.status === "confirmed" &&
    legacy.value &&
    /^English is the only (?:required )?(?:working )?language(?:[.;]\s*No (?:other|additional) languages? (?:are )?required)?[.!]?$/i.test(
      legacy.evidence.quote.trim(),
    );
  if (
    source === undefined &&
    explicitEnglishAlone &&
    legacy.status === "confirmed"
  )
    return check("English", null, legacy.evidence.quote);
  return reason(
    "language_requirements_incomplete",
    "unknown",
    "languageRequirements",
    source?.status === "unknown" || legacy.status === "unknown"
      ? null
      : legacy.evidence.quote,
    facts,
  );
}
const countryAliases = new Map([
  ["germany", "DE"],
  ["deutschland", "DE"],
  ["united states", "US"],
  ["united states of america", "US"],
  ["usa", "US"],
  ["united kingdom", "GB"],
  ["uk", "GB"],
  ["great britain", "GB"],
  ["france", "FR"],
  ["spain", "ES"],
  ["netherlands", "NL"],
  ["poland", "PL"],
  ["russia", "RU"],
  ["austria", "AT"],
  ["switzerland", "CH"],
  ["canada", "CA"],
  ["australia", "AU"],
  ["italy", "IT"],
  ["portugal", "PT"],
  ["ireland", "IE"],
  ["belgium", "BE"],
  ["sweden", "SE"],
  ["denmark", "DK"],
  ["norway", "NO"],
  ["finland", "FI"],
  ["ukraine", "UA"],
]);
const supportedCountries = new Set(countryAliases.values());
function country(value: string): string | undefined {
  return (
    countryAliases.get(normalized(value)) ??
    (supportedCountries.has(value.trim().toUpperCase())
      ? value.trim().toUpperCase()
      : undefined)
  );
}
type PlacePreference = {
  mode: "on_site" | "hybrid" | "local" | "remote";
  city?: string;
  country: string;
};
function place(value: string): PlacePreference | undefined {
  const remote =
    /^(?:remote from|remote in)\s+(.+)$/i.exec(value.trim()) ??
    /^(.+?)\s+remote$/i.exec(value.trim());
  if (remote?.[1]) {
    const code = country(remote[1]);
    return code ? { mode: "remote", country: code } : undefined;
  }
  const local = /^(?:(on[ -]site|hybrid)\s+(?:in\s+)?)?(.+?),\s*([^,]+)$/i.exec(
    value.trim(),
  );
  if (
    local?.[2] &&
    local[3] &&
    !/^(?:not|outside|near|around|except)\s/i.test(local[2])
  ) {
    const code = country(local[3]);
    return code
      ? {
          mode: local[1]
            ? normalized(local[1]) === "hybrid"
              ? "hybrid"
              : "on_site"
            : "local",
          city: normalized(local[2]),
          country: code,
        }
      : undefined;
  }
  const code = country(value);
  return code ? { mode: "local", country: code } : undefined;
}
function locationGate(
  observation: DiscoveryJob["observation"],
  facts: ProfileFact[],
): Reason {
  const parsed = facts.map((fact) => place(fact.value));
  const preferences = parsed.filter((preference) => preference !== undefined);
  const incomplete = preferences.length !== parsed.length;
  const unknown = (quote: string | null) =>
    reason("location_unknown", "unknown", "workArrangements", quote, facts);
  if (!preferences.length)
    return reason(
      "profile_preferences_unknown",
      "unknown",
      "workArrangements",
      null,
      facts,
    );
  const exclusions = facts.flatMap((fact) => {
    const match = /^(?:not|outside|except)\s+(.+)$/i.exec(fact.value.trim());
    if (!match?.[1]) return [];
    return [{ place: place(match[1]) }];
  });
  const conflicts = (city: string | undefined, code: string) =>
    exclusions.some(
      (entry) =>
        !entry.place ||
        (entry.place.country === code &&
          (!entry.place.city || entry.place.city === city)),
    );
  const source = observation.workArrangements;
  const check = (
    arrangement:
      | {
          mode: "on_site" | "hybrid";
          city: string;
          countryCode: string;
          evidence: { quote: string };
        }
      | {
          mode: "remote";
          allowedCountries: string[];
          evidence: { quote: string };
        },
  ): Reason => {
    if (arrangement.mode === "remote") {
      if (
        exclusions.some(
          (entry) =>
            !entry.place ||
            (!entry.place.city &&
              arrangement.allowedCountries.includes(entry.place.country)),
        )
      )
        return unknown(arrangement.evidence.quote);
      if (
        arrangement.allowedCountries.some(
          (code) => !supportedCountries.has(code),
        )
      )
        return unknown(arrangement.evidence.quote);
      if (
        arrangement.allowedCountries.includes("DE") &&
        observation.remoteFromGermany.status === "confirmed" &&
        !observation.remoteFromGermany.value
      )
        return unknown(arrangement.evidence.quote);
      if (
        preferences.some(
          (preference) =>
            preference.mode === "remote" &&
            arrangement.allowedCountries.includes(preference.country),
        )
      )
        return reason(
          "supported_conditions",
          "supported",
          "workArrangements",
          arrangement.evidence.quote,
          facts,
        );
    } else {
      if (
        !supportedCountries.has(arrangement.countryCode) ||
        /^(?:not|outside|near|around|except)\s/i.test(arrangement.city)
      )
        return unknown(arrangement.evidence.quote);
      if (conflicts(normalized(arrangement.city), arrangement.countryCode))
        return unknown(arrangement.evidence.quote);
      if (
        preferences.some(
          (preference) =>
            preference.mode !== "remote" &&
            (preference.mode === "local" ||
              preference.mode === arrangement.mode) &&
            preference.country === arrangement.countryCode &&
            (!preference.city ||
              preference.city === normalized(arrangement.city)),
        )
      )
        return reason(
          "supported_conditions",
          "supported",
          "workArrangements",
          arrangement.evidence.quote,
          facts,
        );
    }
    return incomplete
      ? unknown(arrangement.evidence.quote)
      : reason(
          "location_incompatible",
          "blocked",
          "workArrangements",
          arrangement.evidence.quote,
          facts,
        );
  };
  if (source?.status === "conflicting") return unknown(source.evidence.quote);
  if (
    source?.status === "complete" &&
    observation.remoteFromGermany.status === "confirmed" &&
    observation.remoteFromGermany.value &&
    !source.arrangements.some(
      (arrangement) =>
        arrangement.mode === "remote" &&
        arrangement.allowedCountries.includes("DE"),
    )
  )
    return unknown(source.evidence.quote);
  if (source?.status === "complete")
    return combineAlternatives(
      source.arrangements.map(check),
      reason(
        "supported_conditions",
        "supported",
        "workArrangements",
        source.evidence.quote,
        facts,
      ),
    );
  if (source?.status === "unknown") return unknown(null);
  const location = observation.location;
  if (!location) return unknown(null);
  const legacy = place(location.value);
  if (legacy && legacy.mode !== "remote") {
    if (legacy.mode === "local" || conflicts(legacy.city, legacy.country))
      return unknown(location.evidence.quote);
    if (
      preferences.some(
        (preference) =>
          (preference.mode === "local" || preference.mode === legacy.mode) &&
          preference.country === legacy.country &&
          (!preference.city || preference.city === legacy.city),
      )
    )
      return reason(
        "supported_conditions",
        "supported",
        "location",
        location.evidence.quote,
        facts,
      );
    // An unmatched free-text place is not a complete list of permissible arrangements.
    return unknown(location.evidence.quote);
  }
  if (/^(?:fully\s+)?remote\b/i.test(location.value)) {
    const scope = observation.remoteFromGermany;
    if (scope.status === "confirmed") {
      if (
        !scope.value &&
        !incomplete &&
        preferences.every((preference) => preference.country === "DE")
      )
        return reason(
          "germany_remote_incompatible",
          "blocked",
          "remoteFromGermany",
          scope.evidence.quote,
          facts,
        );
      if (
        scope.value &&
        !conflicts(undefined, "DE") &&
        preferences.some(
          (preference) =>
            preference.mode === "remote" && preference.country === "DE",
        )
      )
        return reason(
          "supported_conditions",
          "supported",
          "remoteFromGermany",
          scope.evidence.quote,
          facts,
        );
    }
    return reason(
      "germany_remote_unknown",
      "unknown",
      "remoteFromGermany",
      null,
      facts,
    );
  }
  return unknown(location.evidence.quote);
}
/** Germany-only authorization declarations cannot establish permission in other countries. */
function supportsGermanyArrangement(
  observation: DiscoveryJob["observation"],
  facts: ProfileFact[],
): boolean {
  const source = observation.workArrangements;
  if (source?.status === "complete") {
    const arrangements: typeof source.arrangements = [];
    for (const arrangement of source.arrangements) {
      if (arrangement.mode === "remote") {
        if (arrangement.allowedCountries.includes("DE"))
          arrangements.push({ ...arrangement, allowedCountries: ["DE"] });
      } else if (arrangement.countryCode === "DE")
        arrangements.push(arrangement);
    }
    return (
      arrangements.length > 0 &&
      locationGate(
        { ...observation, workArrangements: { ...source, arrangements } },
        facts,
      ).outcome === "supported"
    );
  }
  return (
    source === undefined &&
    locationGate(observation, facts).outcome === "supported" &&
    ((observation.location &&
      place(observation.location.value)?.country === "DE") ||
      (/^(?:fully\s+)?remote\b/i.test(observation.location?.value ?? "") &&
        observation.remoteFromGermany.status === "confirmed" &&
        observation.remoteFromGermany.value)) === true
  );
}
function availableHours(facts: ProfileFact[]): number | undefined {
  const values = [
    ...new Set(
      facts.map((fact) =>
        /^\d+(?:\.\d+)?$/.test(fact.value.trim()) ? Number(fact.value) : NaN,
      ),
    ),
  ];
  const value = values[0];
  return values.length === 1 &&
    value !== undefined &&
    Number.isFinite(value) &&
    value >= 0 &&
    value <= 168
    ? value
    : undefined;
}
function employmentGates(
  observation: DiscoveryJob["observation"],
  preferences: ProfileFact[],
  availability: ProfileFact[],
): Reason[] {
  const values = preferences.flatMap((fact) =>
    fact.value.split(/\s+(?:or|and\/or)\s+/i).map(format),
  );
  const preferred = values.filter((value) => value !== undefined);
  const excluded = preferences.flatMap((fact) => {
    const match = /^(?:not|no|except)\s+(.+)$/i.exec(fact.value.trim());
    return match?.[1] ? [format(match[1])] : [];
  });
  const incomplete = !values.length || preferred.length !== values.length;
  const available = availableHours(availability);
  const typeGate = (type: string | undefined, quote: string | null): Reason => {
    if (!preferred.length)
      return reason(
        "profile_preferences_unknown",
        "unknown",
        "employmentOptions",
        quote,
        preferences,
      );
    if (!type)
      return reason(
        "employment_unknown",
        "unknown",
        "employmentOptions",
        quote,
        preferences,
      );
    if (preferred.includes(type) && excluded.includes(type))
      return reason(
        "employment_unknown",
        "unknown",
        "employmentOptions",
        quote,
        preferences,
      );
    if (preferred.includes(type))
      return reason(
        "supported_conditions",
        "supported",
        "employmentOptions",
        quote,
        preferences,
      );
    return incomplete
      ? reason(
          "employment_unknown",
          "unknown",
          "employmentOptions",
          quote,
          preferences,
        )
      : reason(
          "employment_incompatible",
          "blocked",
          "employmentOptions",
          quote,
          preferences,
        );
  };
  const hoursGate = (
    hours:
      | { minimum: number; maximum: number; flexibleWithinRange?: boolean }
      | undefined,
    quote: string | null,
  ): Reason => {
    if (available === undefined)
      return reason(
        "profile_availability_unknown",
        "unknown",
        "weeklyHours",
        quote,
        availability,
      );
    if (!hours)
      return reason(
        "hours_unknown",
        "unknown",
        "weeklyHours",
        quote,
        availability,
      );
    if (hours.minimum > available)
      return reason(
        "hours_incompatible",
        "blocked",
        "weeklyHours",
        quote,
        availability,
      );
    if (hours.maximum > available && !hours.flexibleWithinRange)
      return reason(
        "hours_range_unknown",
        "unknown",
        "weeklyHours",
        quote,
        availability,
      );
    return reason(
      "supported_conditions",
      "supported",
      "weeklyHours",
      quote,
      availability,
    );
  };
  const source = observation.employmentOptions;
  if (source?.status === "conflicting")
    return [
      reason(
        "employment_unknown",
        "unknown",
        "employmentOptions",
        source.evidence.quote,
        [...preferences, ...availability],
      ),
    ];
  if (source?.status === "complete") {
    const legacyFormats =
      observation.employmentType?.value
        .split(/\s+(?:or|and\/or)\s+/i)
        .map(format) ?? [];
    const formatConflict =
      legacyFormats.length > 0 &&
      legacyFormats.every((entry) => entry !== undefined) &&
      !source.options.some((option) =>
        legacyFormats.includes(option.employmentType),
      );
    const legacyHours =
      observation.weeklyHours?.status === "confirmed"
        ? observation.weeklyHours
        : undefined;
    const supported = reason(
      "supported_conditions",
      "supported",
      "employmentOptions",
      source.evidence.quote,
      [...preferences, ...availability],
    );
    return [
      combineAlternatives(
        source.options.map((option) =>
          combineRequirements(
            [
              formatConflict
                ? reason(
                    "employment_unknown",
                    "unknown",
                    "employmentOptions",
                    source.evidence.quote,
                    preferences,
                  )
                : typeGate(option.employmentType, option.evidence.quote),
              legacyHours &&
              (option.weeklyHours.minimum < legacyHours.minimum ||
                option.weeklyHours.maximum > legacyHours.maximum)
                ? reason(
                    "hours_range_unknown",
                    "unknown",
                    "weeklyHours",
                    legacyHours.evidence.quote,
                    availability,
                  )
                : hoursGate(option.weeklyHours, option.evidence.quote),
            ],
            supported,
          ),
        ),
        supported,
      ),
    ];
  }
  const formats =
    observation.employmentType?.value
      .split(/\s+(?:or|and\/or)\s+/i)
      .map(format) ?? [];
  const type =
    source?.status === "unknown" ||
    !formats.length ||
    formats.some((entry) => entry === undefined)
      ? reason(
          "employment_unknown",
          "unknown",
          "employmentType",
          observation.employmentType?.evidence.quote ?? null,
          preferences,
        )
      : combineAlternatives(
          formats.map((entry) =>
            typeGate(entry, observation.employmentType?.evidence.quote ?? null),
          ),
          reason(
            "supported_conditions",
            "supported",
            "employmentType",
            observation.employmentType?.evidence.quote ?? null,
            preferences,
          ),
        );
  return [
    type,
    hoursGate(
      observation.weeklyHours?.status === "confirmed"
        ? observation.weeklyHours
        : undefined,
      observation.weeklyHours?.status === "confirmed"
        ? observation.weeklyHours.evidence.quote
        : null,
    ),
  ];
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

  reasons.push(languageGate(observation, facts("working_language")));
  reasons.push(locationGate(observation, facts("location_preference")));
  reasons.push(
    ...employmentGates(
      observation,
      facts("employment_preference"),
      facts("weekly_availability_hours"),
    ),
  );
  const remaining = observation.additionalRequirements;
  reasons.push(
    reason(
      remaining?.status === "none"
        ? "supported_conditions"
        : "additional_requirements_unknown",
      remaining?.status === "none" ? "supported" : "unknown",
      "additionalRequirements",
      remaining && remaining.status !== "unknown"
        ? remaining.evidence.quote
        : null,
      [],
    ),
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
  else if (
    !supportsGermanyArrangement(observation, facts("location_preference"))
  )
    add(
      "authorization_country_unknown",
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
      currentEvaluatorVersion,
      assessment ?? null,
    ]),
    ownerId: profile.ownerId,
    jobId: job.jobId,
    jobRevisionId: job.currentRevisionId,
    profileVersionId: profile.id,
    profileHash: profile.profileHash,
    evaluatorVersion: currentEvaluatorVersion,
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
