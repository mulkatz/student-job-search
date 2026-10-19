import { createHash } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
import {
  createPublicFetcher,
  extractPublicPage,
  type FetchOutcome,
  type PublicFetcherOptions,
  publicUrl,
} from "@job-search/experiment";
import { load } from "cheerio";
import { z } from "zod";
import { type DiscoveryAdapter, SourceFailure } from "./runner.js";
import {
  type EvidenceValue,
  type NormalizedObservation,
  observationSchema,
} from "./schema.js";

const fields = z.strictObject({
  title: z.string().min(1).max(500),
  employer: z.string().min(1).max(500),
  location: z.string().min(1).max(500).optional(),
  employmentType: z.string().min(1).max(500).optional(),
});
const targetsSchema = z
  .array(
    z.strictObject({
      sourceRecordId: z.string().min(1).max(8192),
      url: z.string().url(),
      visibleFields: fields.optional(),
    }),
  )
  .min(1)
  .max(100);
/** Target list is an operator-configured stream, not a product-wide employer allowlist. */
export function createPublicPageAdapter(input: {
  sourceId: string;
  sourcePolicyRef: string;
  targets: z.infer<typeof targetsSchema>;
  fetchOptions: PublicFetcherOptions;
  retentionDays?: number;
}): DiscoveryAdapter {
  z.string()
    .regex(/^[a-zA-Z0-9_-]{1,160}$/)
    .parse(input.sourceId);
  z.string().trim().min(1).max(1000).parse(input.sourcePolicyRef);
  const targets = targetsSchema.parse(input.targets);
  if (
    new Set(targets.map((target) => target.sourceRecordId)).size !==
    targets.length
  )
    throw new Error("duplicate_target_record");
  for (const target of targets) publicUrl(target.url);
  const retentionDays = z
    .number()
    .int()
    .min(1)
    .max(7)
    .parse(input.retentionDays ?? 7);
  const version = `public-pages-v1-${createHash("sha256")
    .update(
      JSON.stringify({
        targets,
        retentionDays,
        sourcePolicyRef: input.sourcePolicyRef,
      }),
    )
    .digest("hex")
    .slice(0, 24)}`;
  const nextLocalDispatch = new Map<string, number>();
  const minIntervalMs = input.fetchOptions.minOriginIntervalMs ?? 1000;
  let reservation: ((origin: string) => Promise<void>) | null = null;
  let stepSignal: AbortSignal | null = null;
  let confirmation: ((origin: string) => Promise<void>) | null = null;
  let hookFailure: { error?: unknown } | null = null;
  const fetch = createPublicFetcher({
    ...input.fetchOptions,
    beforeRequest: async (request) => {
      const reserve = reservation;
      const signal = stepSignal;
      const confirm = confirmation;
      const failure = hookFailure;
      if (!reserve || !signal) throw new Error("source_step_not_active");
      try {
        const origin = new URL(request.url).origin;
        const residual =
          (nextLocalDispatch.get(origin) ?? -Infinity) - performance.now();
        if (residual > 0)
          await delay(Math.ceil(residual), undefined, { signal });
        signal.throwIfAborted();
        await reserve(origin);
        await input.fetchOptions.beforeRequest(request);
        signal.throwIfAborted();
        await confirm?.(origin);
        signal.throwIfAborted();
        nextLocalDispatch.set(origin, performance.now() + minIntervalMs);
      } catch (error) {
        if (failure) failure.error = error;
        throw error;
      }
    },
  });
  return {
    sourceId: input.sourceId,
    version,
    async step(cursor, context) {
      const index = cursor === null ? 0 : Number(cursor);
      if (
        !Number.isInteger(index) ||
        index < 0 ||
        index >= targets.length ||
        (cursor !== null && String(index) !== cursor)
      )
        throw new Error("invalid_source_cursor");
      const target = targets[index];
      if (!target) throw new Error("target_missing");
      if (reservation) throw new Error("source_step_overlap");
      stepSignal = context.signal;
      confirmation = context.confirmDispatch ?? null;
      reservation = async (origin) => {
        context.signal.throwIfAborted();
        await context.reserveRequest(origin, minIntervalMs);
      };
      const failure: { error?: unknown } = {};
      hookFailure = failure;
      let fetched: FetchOutcome;
      try {
        fetched = await fetch(target.url);
      } finally {
        reservation = null;
        stepSignal = null;
        confirmation = null;
        hookFailure = null;
      }
      if (failure.error) throw failure.error;
      if (fetched.kind !== "html") {
        const raw = "retryAfter" in fetched ? fetched.retryAfter : undefined;
        const retryMs =
          raw && /^\d+$/.test(raw)
            ? context.now.getTime() + Number(raw) * 1000
            : Date.parse(raw ?? "");
        const boundedRetry =
          "reason" in fetched && fetched.reason === "rate_limited"
            ? Math.max(
                context.now.getTime() + 60000,
                Number.isFinite(retryMs) && retryMs <= 8640000000000000
                  ? retryMs
                  : 0,
              )
            : retryMs;
        const retry =
          Number.isFinite(boundedRetry) && boundedRetry <= 8640000000000000
            ? new Date(boundedRetry).toISOString()
            : null;
        throw new SourceFailure(
          fetched.kind === "policy_unresolved"
            ? "source_policy_unresolved"
            : fetched.kind === "blocked"
              ? "source_blocked"
              : "source_unavailable",
          retry,
        );
      }
      const extracted = extractPublicPage(
        fetched.text,
        fetched.url,
        context.now,
      );
      const observation: NormalizedObservation = {
        sourceId: input.sourceId,
        sourceRecordId: target.sourceRecordId,
        sourcePolicyRef: input.sourcePolicyRef,
        observedAt: context.now.toISOString(),
        kind:
          extracted.kind === "job_detail"
            ? "vacancy_detail"
            : extracted.kind === "negative" || extracted.kind === "unavailable"
              ? "unavailable"
              : "career_lead",
        originalUrl: target.url,
        finalUrl: fetched.url,
        title: extracted.title ?? null,
        employer: extracted.employer ?? null,
        location: extracted.location ?? null,
        employmentType: extracted.workFormat ?? null,
        englishAccepted: { status: "unknown" },
        remoteFromGermany: { status: "unknown" },
        applicationLinks: extracted.applicationRoutes.map((route) => ({
          url: route.value,
          evidence: route.evidence,
        })),
        publishedAt: null,
        expiresAt: null,
        retentionUntil: new Date(
          context.now.getTime() + retentionDays * 86400000,
        ).toISOString(),
      };
      if (
        target.visibleFields &&
        extracted.kind === "career_lead" &&
        extracted.reason === "no_complete_jobposting"
      ) {
        const $ = load(fetched.text);
        $(
          "script,style,noscript,template,iframe,form,[hidden],[aria-hidden='true'],[style*='display:none'],[style*='display: none']",
        ).remove();
        const visible = (
          selector: string | undefined,
        ): EvidenceValue | null => {
          if (!selector) return null;
          const matches = $(selector);
          if (matches.length !== 1) return null;
          const value = matches.text().replace(/\s+/g, " ").trim();
          return value && value.length <= 2000
            ? { value, evidence: { url: fetched.url, selector, quote: value } }
            : null;
        };
        const title = visible(target.visibleFields.title);
        const employer = visible(target.visibleFields.employer);
        if (title && employer) {
          observation.kind = "vacancy_detail";
          observation.title = title;
          observation.employer = employer;
          observation.location = visible(target.visibleFields.location);
          observation.employmentType = visible(
            target.visibleFields.employmentType,
          );
          // The parser discovers channels only after a complete JobPosting. A visible
          // detail has its original public source link; no channel is invented.
        }
      }
      return {
        observations: [observationSchema.parse(observation)],
        nextCursor: index + 1 < targets.length ? String(index + 1) : null,
        done: index + 1 >= targets.length,
      };
    },
  };
}
