import { createHash, randomUUID } from "node:crypto";
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
import {
  type TraversalCheckpoint,
  traversalCheckpointSchema,
} from "./provenance.js";
import {
  type AdapterContext,
  type DiscoveryAdapter,
  SourceFailure,
} from "./runner.js";
import {
  type NormalizedObservation,
  observationSchema,
  publicLinkSchema,
} from "./schema.js";

function urlKey(value: string): string {
  const url = new URL(value);
  url.hash = "";
  return createHash("sha256").update(url.href).digest("hex");
}
function retryAfter(raw: string | undefined, now: Date): string {
  const parsed =
    raw && /^\d+$/.test(raw)
      ? now.getTime() + Number(raw) * 1000
      : Date.parse(raw ?? "");
  const until = Math.max(
    now.getTime() + 60000,
    Number.isFinite(parsed) && parsed <= 8640000000000000 ? parsed : 0,
  );
  return new Date(until).toISOString();
}
function anchorPriority(input: {
  url: URL;
  label: string;
  inMain: boolean;
  inNavigation: boolean;
  inJobCard: boolean;
}): number | null {
  // Host names can contain "jobs" on every navigation link. Only the actual
  // destination path/query and visible label provide a career-link signal.
  const path = input.url.pathname.toLowerCase();
  const label = input.label.toLowerCase();
  const text = `${path} ${input.url.search} ${label}`;
  const intent =
    /(career|job|vacan|position|opening|stellen|karriere|student|intern|trainee|employment|assistant|engineer|analyst|apply|opportunit)/i;
  if (!intent.test(text) && !input.inJobCard) return null;
  const segments = path.split("/").filter(Boolean);
  const last = segments.at(-1) ?? "";
  const servicePage =
    /^(?:about(?:-us)?|ueber-uns|über-uns|contact(?:-us)?|kontakt|privacy|privacy-policy|datenschutz|legal|imprint|impressum|terms(?:-and-conditions)?|agb|login|log-in|signin|sign-in|signup|sign-up|register|registration)(?:\.[a-z]+)?$/i;
  const publishingPath =
    /(?:^|\/)(?:(?:post|publish|submit|add|create)[-_]?(?:a[-_]?)?(?:job|vacancy|position)(?:s)?|(?:jobs?|vacanc(?:y|ies)|positions?)(?:[-_]|\/)(?:post|publish|submit|add|create))(?:\/|$)/i;
  const publishingLabel =
    /\b(?:post|publish|submit|add|create|advertise)\s+(?:a\s+|your\s+|an?\s+)?(?:job|vacancy|position)s?\b|\b(?:employer|recruiter)\s+(?:sign[- ]?up|register|login|log[- ]?in)\b|stellenanzeige\s+(?:aufgeben|schalten)|job\s+veröffentlichen/i;
  const homeLabel =
    /^(?:home|homepage|startseite|back to home|go to homepage)$/i;
  if (
    servicePage.test(last) ||
    publishingPath.test(path) ||
    publishingLabel.test(label) ||
    (segments.length <= 1 && homeLabel.test(label))
  )
    return null;
  let score = 0;
  if (input.inMain) score += 50;
  if (input.inJobCard) score += 30;
  if (input.inNavigation) score -= 100;
  if (
    /(?:^|\/)(?:jobs?|vacanc(?:y|ies)|positions?|openings?|stellenangebote?|stellenanzeigen?)(?:\/[^/]+|[-_][^/]+)(?:\/|$)/i.test(
      path,
    )
  )
    score += 20;
  if (
    [...input.url.searchParams].some(
      ([key, value]) =>
        value &&
        /^(?:job(?:_?id)?|vacancy(?:_?id)?|position(?:_?id)?|opening(?:_?id)?|req(?:uisition)?_?id|reference|id)$/i.test(
          key,
        ),
    )
  )
    score += 20;
  if (
    /^(?:jobs?|careers?|karriere|stellen|open positions|all jobs|view jobs|our jobs)$/i.test(
      label,
    )
  )
    score -= 5;
  return score;
}

const limitsSchema = z.strictObject({
  maxDepth: z.number().int().min(0).max(2),
  maxLinksPerPage: z.number().int().min(1).max(20),
  maxPending: z.number().int().min(1).max(64),
  maxVisited: z.number().int().min(1).max(256),
});
export const operatorSeedSchema = z
  .strictObject({
    url: publicLinkSchema,
    seedRef: z.string().min(1).max(160),
    sourcePolicyRef: z.string().min(1).max(1000),
    observedAt: z.iso.datetime({ offset: true }),
    retentionUntil: z.iso.datetime({ offset: true }),
  })
  .superRefine((value, context) => {
    if (
      Date.parse(value.retentionUntil) <= Date.parse(value.observedAt) ||
      Date.parse(value.retentionUntil) - Date.parse(value.observedAt) >
        7 * 86400000
    )
      context.addIssue({
        code: "custom",
        message: "Operator seed retention expires within seven days",
      });
  });
export type OperatorSeed = z.infer<typeof operatorSeedSchema>;
/** Bounded public discovery; no fixed employer/domain list and no credential forwarding. */
export function createCareerTraversalAdapter(input: {
  sourceId: string;
  sourcePolicyRef: string;
  seeds:
    | readonly (NormalizedObservation | OperatorSeed)[]
    | (() => readonly (NormalizedObservation | OperatorSeed)[]);
  seedVersion?: string;
  seedSelectionRef?: string;
  fetchOptions: PublicFetcherOptions;
  retentionDays?: number;
  /** Optional source-specific shortening; cannot extend parent evidence or seven days. */
  retentionUntil?: (url: URL, now: Date) => string;
  limits?: Partial<z.infer<typeof limitsSchema>>;
}): DiscoveryAdapter {
  z.string()
    .regex(/^[a-zA-Z0-9_-]{1,160}$/)
    .parse(input.sourceId);
  z.string().trim().min(1).max(1000).parse(input.sourcePolicyRef);
  const limits = limitsSchema.parse({
    maxDepth: 2,
    maxLinksPerPage: 20,
    maxPending: 64,
    maxVisited: 256,
    ...input.limits,
  });
  const retentionDays = z
    .number()
    .int()
    .min(1)
    .max(7)
    .parse(input.retentionDays ?? 7);
  const lazySeeds = typeof input.seeds === "function" ? input.seeds : null;
  const seedRefs = lazySeeds
    ? {
        seedVersion: z
          .string()
          .regex(/^[a-zA-Z0-9_-]{1,160}$/)
          .parse(input.seedVersion),
        seedSelectionRef: z
          .string()
          .trim()
          .min(1)
          .max(1000)
          .parse(input.seedSelectionRef),
      }
    : null;
  const makeCheckpoint = (
    seedInput: readonly (NormalizedObservation | OperatorSeed)[],
  ): TraversalCheckpoint | null => {
    const seeds = z
      .array(z.union([observationSchema, operatorSeedSchema]))
      .min(lazySeeds ? 0 : 1)
      .max(64)
      .parse(seedInput);
    if (
      seeds.some(
        (seed) =>
          "kind" in seed &&
          (seed.kind !== "search_lead" ||
            (seed.discoveryProvenance?.kind !== "search_result" &&
              seed.discoveryProvenance?.kind !== "brave_search_result") ||
            seed.sourceId === input.sourceId),
      )
    )
      throw new Error("retained_search_leads_required");
    const pending: TraversalCheckpoint["pending"] = [];
    let excessLinks = 0;
    for (const seed of seeds) {
      const provenance =
        "kind" in seed
          ? seed.discoveryProvenance
          : {
              kind: "operator_seed" as const,
              seedRef: seed.seedRef,
              sourcePolicyRef: seed.sourcePolicyRef,
              observedAt: seed.observedAt,
              retentionUntil: seed.retentionUntil,
            };
      if (!provenance) throw new Error("search_provenance_required");
      const url = "kind" in seed ? seed.originalUrl : seed.url;
      publicUrl(url);
      if (pending.some((entry) => urlKey(entry.url) === urlKey(url))) continue;
      if (pending.length >= limits.maxPending) {
        excessLinks++;
        continue;
      }
      pending.push({
        url,
        depth: 0,
        expiresAt: seed.retentionUntil,
        provenance,
      });
    }
    if (pending.length === 0) return null;
    return traversalCheckpointSchema.parse({
      version: 1,
      expiresAt: new Date(
        Math.max(...pending.map((entry) => Date.parse(entry.expiresAt))),
      ).toISOString(),
      pending,
      visited: [],
      rejectedLinks: 0,
      excessLinks,
    });
  };
  const initialCheckpoint = lazySeeds
    ? null
    : makeCheckpoint(typeof input.seeds === "function" ? [] : input.seeds);
  const version = `career-traversal-v2-${createHash("sha256")
    .update(
      JSON.stringify({
        seeds: lazySeeds ? seedRefs : input.seeds,
        limits,
        retentionDays,
        sourcePolicyRef: input.sourcePolicyRef,
      }),
    )
    .digest("hex")
    .slice(0, 24)}`;
  const nextLocalDispatch = new Map<string, number>();
  const minIntervalMs = input.fetchOptions.minOriginIntervalMs ?? 1000;
  let active: {
    context: AdapterContext;
    expiresAt: string;
    policyExpiry: number;
    hookFailure: unknown;
  } | null = null;
  const fetch = createPublicFetcher({
    ...input.fetchOptions,
    sourcePolicy: async (url) => {
      const step = active;
      if (!step) throw new Error("source_step_not_active");
      try {
        const permission = await input.fetchOptions.sourcePolicy(new URL(url));
        if (input.retentionUntil) {
          const expiry = Date.parse(
            z.iso
              .datetime({ offset: true })
              .parse(
                input.retentionUntil(
                  new URL(url),
                  step.context.currentTime?.() ?? step.context.now,
                ),
              ),
          );
          step.policyExpiry = Math.min(step.policyExpiry, expiry);
          if (
            step.policyExpiry <=
            (step.context.currentTime?.() ?? step.context.now).getTime()
          )
            throw new Error("source_retention_expired");
        }
        return permission;
      } catch (error) {
        step.hookFailure = error;
        throw error;
      }
    },
    beforeRequest: async (request) => {
      const step = active;
      if (!step) throw new Error("source_step_not_active");
      const assertActive = () => {
        step.context.signal.throwIfAborted();
        if (
          Math.min(Date.parse(step.expiresAt), step.policyExpiry) <=
          (step.context.currentTime?.() ?? step.context.now).getTime()
        )
          throw new Error("discovery_evidence_expired");
      };
      try {
        assertActive();
        const origin = new URL(request.url).origin;
        const residual =
          (nextLocalDispatch.get(origin) ?? -Infinity) - performance.now();
        if (residual > 0)
          await delay(Math.ceil(residual), undefined, {
            signal: step.context.signal,
          });
        assertActive();
        await step.context.reserveRequest(origin, minIntervalMs);
        await input.fetchOptions.beforeRequest(request);
        assertActive();
        await step.context.confirmDispatch?.(origin);
        assertActive();
        nextLocalDispatch.set(origin, performance.now() + minIntervalMs);
      } catch (error) {
        step.hookFailure = error;
        throw error;
      }
    },
  });
  return {
    sourceId: input.sourceId,
    version,
    ...(initialCheckpoint ? { initialCheckpoint } : {}),
    ...(lazySeeds
      ? {
          initializeCheckpoint: () => makeCheckpoint(lazySeeds()),
          resumeAcrossDays: true,
        }
      : {}),
    async step(cursor, context) {
      context.signal.throwIfAborted();
      if (cursor !== null && !/^graph_[a-f0-9-]{36}$/.test(cursor))
        throw new Error("invalid_source_cursor");
      // Missing/expired state never falls back to the original seed URLs.
      if (!context.checkpoint)
        throw new SourceFailure("source_checkpoint_unavailable");
      if (Date.parse(context.checkpoint.expiresAt) <= context.now.getTime())
        throw new SourceFailure("source_checkpoint_expired");
      const checkpoint = traversalCheckpointSchema.parse(context.checkpoint);
      const hadPending = checkpoint.pending.length > 0;
      const reached = (limit: "depth" | "links" | "pending" | "visited") => {
        checkpoint.limitsReached ??= [];
        if (!checkpoint.limitsReached.includes(limit))
          checkpoint.limitsReached.push(limit);
      };
      checkpoint.pending = checkpoint.pending.filter(
        (entry) => Date.parse(entry.expiresAt) > context.now.getTime(),
      );
      checkpoint.expiredTargets =
        (checkpoint.expiredTargets ?? 0) +
        (hadPending
          ? context.checkpoint.pending.length - checkpoint.pending.length
          : 0);
      checkpoint.visited = checkpoint.visited.filter(
        (entry) => Date.parse(entry.expiresAt) > context.now.getTime(),
      );
      const target = checkpoint.pending[0];
      if (!target) {
        if (hadPending || (checkpoint.expiredTargets ?? 0) > 0)
          throw new SourceFailure("source_checkpoint_expired");
        return { observations: [], nextCursor: null, done: true, checkpoint };
      }
      if (checkpoint.visited.length >= limits.maxVisited) {
        reached("visited");
        checkpoint.excessLinks += checkpoint.pending.length;
        checkpoint.pending = [];
        return { observations: [], nextCursor: null, done: true, checkpoint };
      }
      if (active) throw new Error("source_step_overlap");
      const provenanceStart =
        target.provenance.kind === "search_result" ||
        target.provenance.kind === "brave_search_result"
          ? target.provenance.capturedAt
          : target.provenance.kind === "operator_seed"
            ? target.provenance.observedAt
            : target.provenance.parentObservedAt;
      if (Date.parse(provenanceStart) > context.now.getTime())
        throw new Error("discovery_evidence_in_future");
      const step = {
        context,
        expiresAt: target.expiresAt,
        policyExpiry: Infinity,
        hookFailure: undefined as unknown,
      };
      active = step;
      let fetched: FetchOutcome;
      try {
        fetched = await fetch(target.url);
      } finally {
        if (active === step) active = null;
      }
      if (step.hookFailure) throw step.hookFailure;
      context.signal.throwIfAborted();
      if (
        Date.parse(target.expiresAt) <=
        (context.currentTime?.() ?? context.now).getTime()
      )
        throw new Error("discovery_evidence_expired");
      if (
        fetched.kind !== "html" &&
        "reason" in fetched &&
        (fetched.reason === "rate_limited" ||
          fetched.reason === "rate_limit_cooldown")
      )
        throw new SourceFailure(
          "source_blocked",
          retryAfter(
            "retryAfter" in fetched ? fetched.retryAfter : undefined,
            context.now,
          ),
        );
      const retentionUntil = new Date(
        Math.min(
          Date.parse(target.expiresAt),
          context.now.getTime() + retentionDays * 86400000,
          step.policyExpiry,
        ),
      ).toISOString();
      if (Date.parse(retentionUntil) <= context.now.getTime())
        throw new Error("source_retention_expired");
      const extracted =
        fetched.kind === "html"
          ? extractPublicPage(fetched.text, fetched.url, context.now)
          : null;
      const observation = observationSchema.parse({
        sourceId: input.sourceId,
        sourceRecordId: target.url,
        sourcePolicyRef: input.sourcePolicyRef,
        discoveryProvenance: target.provenance,
        observedAt: context.now.toISOString(),
        kind:
          !extracted ||
          extracted.kind === "negative" ||
          extracted.kind === "unavailable"
            ? "unavailable"
            : extracted.kind === "job_detail"
              ? "vacancy_detail"
              : "career_lead",
        originalUrl: target.url,
        ...(fetched.kind === "html" ? { finalUrl: fetched.url } : {}),
        title: extracted?.title ?? null,
        employer: extracted?.employer ?? null,
        location: extracted?.location ?? null,
        employmentType: extracted?.workFormat ?? null,
        englishAccepted: { status: "unknown" },
        remoteFromGermany: { status: "unknown" },
        applicationLinks:
          extracted?.applicationRoutes.map((route) => ({
            url: route.value,
            evidence: route.evidence,
          })) ?? [],
        publishedAt: null,
        expiresAt: null,
        retentionUntil,
      });
      checkpoint.pending.shift();
      checkpoint.visited.push({
        urlKey: urlKey(target.url),
        observedAt: context.now.toISOString(),
        expiresAt: retentionUntil,
      });
      if (
        fetched.kind === "html" &&
        urlKey(fetched.url) !== urlKey(target.url) &&
        !checkpoint.visited.some(
          (entry) => entry.urlKey === urlKey(fetched.url),
        ) &&
        checkpoint.visited.length < limits.maxVisited
      )
        checkpoint.visited.push({
          urlKey: urlKey(fetched.url),
          observedAt: context.now.toISOString(),
          expiresAt: retentionUntil,
        });
      if (fetched.kind === "html" && observation.kind === "career_lead") {
        const $ = load(fetched.text);
        $(
          "script,style,noscript,template,iframe,form,[hidden],[aria-hidden='true'],[style*='display:none'],[style*='display: none']",
        ).remove();
        const candidates: {
          url: string;
          label: string;
          href: string;
          score: number;
          index: number;
        }[] = [];
        $("a[href]").each((index, element) => {
          const anchor = $(element);
          const href = anchor.attr("href") ?? "";
          const label = anchor.text().replace(/\s+/g, " ").trim();
          let url: string;
          try {
            url = publicLinkSchema.parse(new URL(href, fetched.url).href);
            publicUrl(url);
          } catch {
            // Count rejected career-like targets without retaining their addresses.
            if (
              /(career|job|vacan|position|opening|stellen|karriere|student|intern|trainee|employment|assistant|engineer|analyst|apply)/i.test(
                `${href} ${label}`,
              )
            )
              checkpoint.rejectedLinks++;
            return;
          }
          const score = anchorPriority({
            url: new URL(url),
            label,
            inMain: anchor.closest('main,article,[role="main"]').length > 0,
            inNavigation:
              anchor.closest(
                'nav,footer,[role="navigation"],[role="contentinfo"]',
              ).length > 0,
            inJobCard:
              anchor.closest(
                '[itemtype$="/JobPosting"],[data-job-id],[data-vacancy-id],[class*="job-card"],[class*="job-item"],[class*="vacancy-card"],[class*="position-card"]',
              ).length > 0,
          });
          if (score !== null)
            candidates.push({ url, label, href, score, index });
        });
        candidates.sort(
          (left, right) => right.score - left.score || left.index - right.index,
        );
        let accepted = 0;
        for (const { url, label, href } of candidates) {
          const key = urlKey(url);
          if (
            checkpoint.visited.some((entry) => entry.urlKey === key) ||
            checkpoint.pending.some((entry) => urlKey(entry.url) === key)
          )
            continue;
          if (target.depth >= limits.maxDepth) {
            reached("depth");
            checkpoint.excessLinks++;
            continue;
          }
          if (accepted >= limits.maxLinksPerPage) {
            reached("links");
            checkpoint.excessLinks++;
            continue;
          }
          if (checkpoint.pending.length >= limits.maxPending) {
            reached("pending");
            checkpoint.excessLinks++;
            continue;
          }
          if (
            checkpoint.pending.length + checkpoint.visited.length >=
            limits.maxVisited
          ) {
            reached("visited");
            checkpoint.excessLinks++;
            continue;
          }
          accepted++;
          checkpoint.pending.push({
            url,
            depth: target.depth + 1,
            expiresAt: retentionUntil,
            provenance: {
              kind: "parent_anchor",
              parentSourceId: input.sourceId,
              parentSourceRecordId: target.url,
              parentObservedAt: observation.observedAt,
              retentionUntil,
              evidence: {
                url: fetched.url,
                selector: "a[href]",
                quote: (label || href).slice(0, 4000),
              },
            },
          });
        }
      }
      const done =
        checkpoint.pending.length === 0 ||
        checkpoint.visited.length >= limits.maxVisited;
      if (done && checkpoint.pending.length) {
        reached("visited");
        checkpoint.excessLinks += checkpoint.pending.length;
        checkpoint.pending = [];
      }
      return {
        observations: [observation],
        nextCursor: done ? null : `graph_${randomUUID()}`,
        done,
        checkpoint: traversalCheckpointSchema.parse(checkpoint),
      };
    },
  };
}
