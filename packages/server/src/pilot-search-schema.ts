import { createHash } from "node:crypto";
import {
  braveAccessSchema,
  observationSchema,
  traversalCheckpointSchema,
} from "@job-search/discovery";
import { manifestSchema, publicUrl } from "@job-search/experiment";
import { z } from "zod";
import type { ProfileFact } from "./profile-schema.js";

const timestamp = z.iso.datetime({ offset: true });
export const pilotSearchSources = {
  search: "g4-private-brave-web",
  web: "g4-private-web-pages",
} as const;
export const pilotSearchBounds = {
  target: 30,
  searchRequests: 20,
  httpRequests: 120,
  observations: 300,
  reservedMicroEuro: 1_000_000,
  monthlyMicroEuro: 5_000_000,
  durationMs: 12 * 60_000,
} as const;

import {
  type SearchRunSummary,
  searchRunSummarySchema,
} from "./pilot-search-view-schema.js";

export {
  pilotSearchRequestSchema,
  type SearchRunSummary,
  searchRunResponseSchema,
  searchRunSummarySchema,
} from "./pilot-search-view-schema.js";
export const pilotRunSchema = searchRunSummarySchema.extend({
  ownerId: z.string().regex(/^[A-Za-z0-9_-]{1,128}$/),
  operationId: z.string().uuid(),
  profileGeneration: z.string().uuid(),
  profileExpiresAt: timestamp,
  manifest: manifestSchema,
  fence: z.string().uuid().nullable(),
  leaseUntil: timestamp.nullable(),
  paidAttempt: z
    .strictObject({
      attemptId: z.string().uuid(),
      requestRef: z.string().regex(/^[a-f0-9]{64}$/),
    })
    .nullable(),
  searchCursor: z.string().max(80).nullable(),
  traversalCursor: z.string().max(80).nullable(),
  checkpoint: traversalCheckpointSchema.nullable(),
  seeds: z.array(observationSchema).max(64),
  jobIds: z.array(z.string().regex(/^job_[a-f0-9]{32}$/)).max(30),
  dedupKeys: z.array(z.string().regex(/^[a-f0-9]{64}$/)).max(60),
});
export type PilotRun = z.infer<typeof pilotRunSchema>;
export const pilotSourceStateSchema = z
  .strictObject({
    version: z.literal(1),
    baselineImported: z.literal(true),
    baselineSnapshotSha256: z.string().regex(/^[a-f0-9]{64}$/),
    baselineRecordedAt: timestamp,
    originOwners: z.record(z.url(), z.string().min(1).max(160)),
    originNextAllowedAt: z.record(z.url(), timestamp),
    originPending: z
      .record(
        z.url(),
        z.strictObject({ runId: z.string().uuid(), fence: z.string().uuid() }),
      )
      .default({}),
    cooldowns: z.record(z.string().min(1).max(160), timestamp),
  })
  .superRefine((state, context) => {
    if (
      Object.keys(state.originOwners).length < 53 ||
      state.originOwners["https://api.search.brave.com"] !==
        pilotSearchSources.search
    )
      context.addIssue({
        code: "custom",
        message:
          "The retained 53-origin technical ownership baseline is required",
      });
  });
export function minimizeExpiredPilotSources(
  run: PilotRun,
  now: Date,
): PilotRun {
  const next = structuredClone(run);
  next.seeds = next.seeds.filter(
    (seed) => Date.parse(seed.retentionUntil) > now.getTime(),
  );
  if (next.checkpoint) {
    next.checkpoint.pending = next.checkpoint.pending.filter(
      (entry) => Date.parse(entry.expiresAt) > now.getTime(),
    );
    next.checkpoint.visited = next.checkpoint.visited.filter(
      (entry) => Date.parse(entry.expiresAt) > now.getTime(),
    );
    if (
      Date.parse(next.checkpoint.expiresAt) <= now.getTime() ||
      (!next.checkpoint.pending.length && !next.checkpoint.visited.length)
    )
      next.checkpoint = null;
  }
  return next;
}
export const pilotSearchConfigSchema = z.strictObject({
  projectId: z.string().regex(/^[a-z][a-z0-9-]{4,28}[a-z0-9]$/),
  region: z.string().regex(/^[a-z]+-[a-z]+\d$/),
  jobName: z.string().regex(/^[a-z][a-z0-9-]{0,62}$/),
  access: braveAccessSchema,
});
export type PilotSearchConfig = z.infer<typeof pilotSearchConfigSchema>;
export function pilotSearchConfig(
  environment: NodeJS.ProcessEnv,
): PilotSearchConfig | null {
  if (environment.JOB_SEARCH_PILOT_SEARCH !== "enabled") return null;
  if (
    environment.JOB_SEARCH_MODE !== "private-pilot" ||
    environment.JOB_SEARCH_PLATFORM_ADC !== "enabled"
  )
    throw new Error("pilot_search_production_required");
  return pilotSearchConfigSchema.parse({
    projectId: environment.GOOGLE_CLOUD_PROJECT,
    region: environment.JOB_SEARCH_RUN_REGION,
    jobName: environment.JOB_SEARCH_RUN_JOB,
    access: {
      operatorAuthorizationRef: environment.JOB_SEARCH_BRAVE_AUTHORIZATION_REF,
      providerGrant: "unverified",
      decisionRef: "docs/adr/0016-private-brave-operator-authorization.md",
      purpose: "bounded_private_discovery",
      retain: "urls_and_provenance_only",
      expiresAt: environment.JOB_SEARCH_BRAVE_AUTHORIZATION_EXPIRES_AT,
    },
  });
}
export function searchRunSummary(run: PilotRun): SearchRunSummary {
  const {
    id,
    profileVersionId,
    status,
    target,
    displayedJobs,
    observations,
    searchRequests,
    httpRequests,
    reason,
    createdAt,
    updatedAt,
  } = run;
  return searchRunSummarySchema.parse({
    id,
    profileVersionId,
    status,
    target,
    displayedJobs,
    observations,
    searchRequests,
    httpRequests,
    reason,
    createdAt,
    updatedAt,
  });
}
export function hashPilot(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}
export function pilotSourcePermission(url: URL) {
  publicUrl(url.href);
  const denied = [
    "arbeitsagentur.de",
    "workingnomads.com",
    "workingnomads.co",
    "thebarn.de",
    "zertificon.com",
  ];
  return denied.some(
    (domain) => url.hostname === domain || url.hostname.endsWith(`.${domain}`),
  )
    ? { status: "restricted" as const }
    : {
        status: "permitted" as const,
        evidenceRef:
          "docs/adr/0005-bounded-experiment-and-public-fetch-policy.md",
      };
}
/** Only controlled generic vocabulary leaves the server, never raw profile text. */
export function pilotManifest(facts: readonly ProfileFact[]) {
  const values = (category: ProfileFact["category"]) =>
    facts
      .filter((fact) => fact.category === category)
      .map((fact) => fact.value.toLowerCase())
      .join(" ");
  const preferences = `${values("search_preference")} ${values("employment_preference")}`;
  const controlledRoles = [
    "barista",
    "hospitality",
    "customer service",
    "office assistant",
    "research assistant",
    "data entry",
    "retail",
    "warehouse",
    "software",
    "design",
  ];
  let selected = controlledRoles.filter((role) =>
    new RegExp(`\\b${role}\\b`, "i").test(preferences),
  );
  if (!selected.length) {
    const skills = values("skill");
    selected = controlledRoles.filter((role) =>
      new RegExp(`\\b${role}\\b`, "i").test(skills),
    );
    if (
      !selected.length &&
      /\b(?:javascript|typescript|python|programming|sql)\b/.test(skills)
    )
      selected = ["software"];
  }
  const roles = selected.length
    ? selected
    : [
        "student",
        "assistant",
        "customer service",
        "hospitality",
        "office",
        "research",
        "retail",
        "operations",
        "support",
        "entry level",
      ];
  const languages = facts
    .filter(
      (fact) =>
        fact.category === "working_language" &&
        !/\b(?:not spoken|none|no knowledge|nicht)\b/i.test(fact.value),
    )
    .map((fact) => fact.value.toLowerCase())
    .join(" ");
  const language = /\b(?:english|englisch)\b/.test(languages)
    ? "English"
    : /\b(?:german|deutsch)\b/.test(languages)
      ? "German"
      : "";
  const availability = values("weekly_availability_hours");
  const hours = /^\s*(?:[1-9]|[12]\d|30)(?:\s*(?:hours?|h|stunden))?\s*$/.test(
    availability,
  )
    ? "part time"
    : "";
  return manifestSchema.parse({
    version: 1,
    queries: ["berlin", "germany_remote"].flatMap((stream) =>
      Array.from({ length: 10 }, (_, index) => ({
        id: `${stream}_${index + 1}`,
        stream,
        query:
          `${roles[index % roles.length]} ${language} ${hours} ${stream === "berlin" ? "Berlin" : "Germany remote"} ${index >= roles.length ? ["jobs", "vacancy", "careers", "hiring", "employment", "position", "opening", "recruitment", "work", "opportunity"][index] : "jobs"}`
            .replace(/\s+/g, " ")
            .trim(),
      })),
    ),
  });
}
