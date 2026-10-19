import { createHash, randomUUID } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
import {
  type Manifest,
  manifestHash,
  manifestSchema,
} from "@job-search/experiment";
import { z } from "zod";
import { type BraveAccess, braveAccessSchema } from "./brave-access.js";
import { type DiscoveryAdapter, SourceFailure } from "./runner.js";
import { observationSchema, publicLinkSchema } from "./schema.js";

const endpoint = "https://api.search.brave.com/res/v1/web/search";
const origin = new URL(endpoint).origin;
const maxBytes = 1_000_000;
const count = 10;
const minIntervalMs = 1000;
const pageSchema = z.strictObject({
  queryId: z.string().regex(/^[a-zA-Z0-9_-]{1,80}$/),
  offset: z.number().int().min(0).max(9),
});
export type BraveSearchPage = z.infer<typeof pageSchema>;
export type BraveSearchRequest = {
  attemptId: string;
  requestRef: string;
  queryId: string;
  offset: number;
  manifestHash: string;
  count: 10;
};
export type BraveAttemptSummary = BraveSearchRequest & {
  outcome: "not_dispatched" | "response_received" | "ambiguous";
  reason:
    | "before_request_refused"
    | "transport_failed"
    | "http_failure"
    | "rate_limited"
    | "redirect_refused"
    | "response_limit"
    | "invalid_payload"
    | "response_timeout"
    | "authorization_expired"
    | "completed";
  status?: number;
  returnedRecords: number;
  rejectedRecords: number;
};
function containsCredential(value: string, credential: string): boolean {
  let decoded = value;
  for (let i = 0; i < 3; i++) {
    if (decoded.includes(credential)) return true;
    try {
      const next = decodeURIComponent(decoded);
      if (next === decoded) break;
      decoded = next;
    } catch {
      break;
    }
  }
  return false;
}
function digest(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}
function abortable<T>(promise: Promise<T>, signal: AbortSignal): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const abort = () => {
      reject(new Error("brave_deadline_reached"));
    };
    if (signal.aborted) {
      promise.catch(() => {});
      abort();
      return;
    }
    signal.addEventListener("abort", abort, { once: true });
    promise.then(
      (value) => {
        signal.removeEventListener("abort", abort);
        resolve(value);
      },
      () => {
        signal.removeEventListener("abort", abort);
        reject(new Error("brave_operation_failed"));
      },
    );
  });
}
class ResponseFailure extends Error {
  constructor(readonly reason: BraveAttemptSummary["reason"]) {
    super(reason);
  }
}
async function readPayload(
  response: Response,
  signal: AbortSignal,
): Promise<unknown> {
  const declared = response.headers.get("content-length");
  if (declared && (!/^\d+$/.test(declared) || Number(declared) > maxBytes)) {
    void response.body?.cancel().catch(() => {});
    throw new ResponseFailure("response_limit");
  }
  if (
    !response.headers
      .get("content-type")
      ?.toLowerCase()
      .startsWith("application/json") ||
    !response.body
  )
    throw new ResponseFailure("invalid_payload");
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  try {
    while (true) {
      const part = await abortable(reader.read(), signal);
      if (part.done) break;
      bytes += part.value.byteLength;
      if (bytes > maxBytes) throw new ResponseFailure("response_limit");
      chunks.push(part.value);
    }
    return JSON.parse(
      new TextDecoder("utf-8", { fatal: true }).decode(
        Buffer.concat(chunks, bytes),
      ),
    );
  } catch (error) {
    void reader.cancel().catch(() => {});
    if (error instanceof ResponseFailure) throw error;
    throw new ResponseFailure(
      signal.aborted ? "response_timeout" : "invalid_payload",
    );
  } finally {
    reader.releaseLock();
  }
}
const responseSchema = z.object({
  type: z.literal("search"),
  query: z.object({ original: z.string().max(2000) }),
  web: z
    .object({ results: z.array(z.unknown()).max(count) })
    .nullable()
    .optional(),
});
function cooldown(value: string | null, now: Date): string {
  const parsed =
    value && /^\d+$/.test(value)
      ? now.getTime() + Number(value) * 1000
      : Date.parse(value ?? "");
  return new Date(
    Math.max(
      now.getTime() + 60000,
      Number.isFinite(parsed) && parsed <= 8640000000000000 ? parsed : 0,
    ),
  ).toISOString();
}
/** Fixed paid API route. The separate access record does not claim provider storage rights. */
export function createBraveSearchAdapter(input: {
  sourceId: string;
  access: BraveAccess;
  manifest: Manifest;
  pages: readonly BraveSearchPage[];
  apiKey: string;
  beforeRequest: (request: BraveSearchRequest) => Promise<void>;
  afterAttempt: (summary: BraveAttemptSummary) => Promise<void>;
  fetchImpl?: typeof fetch;
  liveOptIn?: boolean;
}): DiscoveryAdapter {
  const sourceId = z
    .string()
    .regex(/^[a-zA-Z0-9_-]{1,160}$/)
    .parse(input.sourceId);
  const access = braveAccessSchema.parse(input.access);
  const manifest = manifestSchema.parse(input.manifest);
  const frozenHash = manifestHash(manifest);
  const pages = z.array(pageSchema).min(1).max(100).parse(input.pages);
  if (
    new Set(pages.map((page) => `${page.queryId}:${page.offset}`)).size !==
      pages.length ||
    pages.some(
      (page) => !manifest.queries.some((query) => query.id === page.queryId),
    )
  )
    throw new Error("invalid_brave_pages");
  if (
    typeof input.apiKey !== "string" ||
    input.apiKey.length < 1 ||
    input.apiKey.length > 4096 ||
    /\s/.test(input.apiKey) ||
    typeof input.beforeRequest !== "function" ||
    typeof input.afterAttempt !== "function" ||
    (input.fetchImpl !== undefined && typeof input.fetchImpl !== "function")
  )
    throw new Error("invalid_brave_configuration");
  const liveOptIn = z.boolean().optional().parse(input.liveOptIn) === true;
  const apiKey = input.apiKey;
  const beforeRequest = input.beforeRequest;
  const afterAttempt = input.afterAttempt;
  const fetchImpl = input.fetchImpl ?? fetch;
  if (
    containsCredential(
      JSON.stringify({ sourceId, access, manifest, pages }),
      input.apiKey,
    )
  )
    throw new Error("invalid_brave_configuration");
  if (
    Object.keys(input).some(
      (key) =>
        ![
          "sourceId",
          "access",
          "manifest",
          "pages",
          "apiKey",
          "beforeRequest",
          "afterAttempt",
          "fetchImpl",
          "liveOptIn",
        ].includes(key),
    )
  )
    throw new Error("invalid_brave_configuration");
  const version = `brave-search-v1-${digest({ sourceId, access, frozenHash, pages, count, country: "DE" }).slice(0, 24)}`;
  let nextLocalDispatch = -Infinity;
  let active = false;
  return {
    sourceId,
    version,
    resumeAcrossDays: true,
    async step(cursor, context) {
      if (!liveOptIn) throw new Error("brave_live_opt_in_required");
      if (context.paidAttempt)
        throw new SourceFailure("source_search_reconciliation_required");
      if (!context.beginPaidAttempt || !context.confirmDispatch)
        throw new Error("brave_runner_accounting_required");
      const index = cursor === null ? 0 : Number(cursor);
      if (
        !Number.isInteger(index) ||
        index < 0 ||
        index >= pages.length ||
        (cursor !== null && String(index) !== cursor)
      )
        throw new Error("invalid_source_cursor");
      const page = pages[index];
      const query = manifest.queries.find(
        (query) => query.id === page?.queryId,
      );
      if (!page || !query) throw new Error("invalid_brave_pages");
      const signal = AbortSignal.any([
        context.signal,
        AbortSignal.timeout(10000),
      ]);
      const now = () => context.currentTime?.() ?? context.now;
      const assertActive = () => {
        signal.throwIfAborted();
        if (Date.parse(access.expiresAt) <= now().getTime())
          throw new SourceFailure("source_search_authorization_expired");
      };
      assertActive();
      if (active) throw new Error("source_step_overlap");
      active = true;
      const request: BraveSearchRequest = {
        attemptId: randomUUID(),
        requestRef: digest([frozenHash, page.queryId, page.offset]),
        queryId: page.queryId,
        offset: page.offset,
        manifestHash: frozenHash,
        count,
      };
      let summary: BraveAttemptSummary = {
        ...request,
        outcome: "not_dispatched",
        reason: "before_request_refused",
        returnedRecords: 0,
        rejectedRecords: 0,
      };
      let begun = false;
      let retryAt: string | null = null;
      let observations: z.infer<typeof observationSchema>[] = [];
      let completed = false;
      try {
        const residual = nextLocalDispatch - performance.now();
        if (residual > 0)
          await delay(Math.ceil(residual), undefined, { signal });
        assertActive();
        await context.reserveRequest(origin, minIntervalMs);
        await context.beginPaidAttempt({
          attemptId: request.attemptId,
          requestRef: request.requestRef,
        });
        begun = true;
        await abortable(beforeRequest({ ...request }), signal);
        assertActive();
        await context.confirmDispatch(origin);
        assertActive();
        nextLocalDispatch = performance.now() + minIntervalMs;
        const url = new URL(endpoint);
        url.searchParams.set("q", query.query);
        url.searchParams.set("count", String(count));
        url.searchParams.set("offset", String(page.offset));
        url.searchParams.set("country", "DE");
        url.searchParams.set("result_filter", "web");
        summary = {
          ...summary,
          outcome: "ambiguous",
          reason: "transport_failed",
        };
        const response = await abortable(
          fetchImpl(url, {
            method: "GET",
            headers: {
              Accept: "application/json",
              "X-Subscription-Token": apiKey,
            },
            redirect: "error",
            credentials: "omit",
            referrerPolicy: "no-referrer",
            cache: "no-store",
            signal,
          }),
          signal,
        );
        summary = {
          ...summary,
          outcome: "response_received",
          status: response.status,
          reason: "http_failure",
        };
        if (response.status === 429) {
          summary.reason = "rate_limited";
          retryAt = cooldown(response.headers.get("retry-after"), now());
        } else if (
          (response.status >= 300 && response.status < 400) ||
          response.redirected
        )
          summary.reason = "redirect_refused";
        else if (response.status === 200) {
          try {
            const payload = responseSchema.parse(
              await readPayload(response, signal),
            );
            if (payload.query.original !== query.query)
              throw new ResponseFailure("invalid_payload");
            assertActive();
            const capturedAt = now().toISOString();
            const retentionUntil = new Date(
              Math.min(
                Date.parse(access.expiresAt),
                Date.parse(capturedAt) + 7 * 86400000,
              ),
            ).toISOString();
            const seen = new Set<string>();
            for (const raw of payload.web?.results ?? []) {
              const result = z.object({ url: publicLinkSchema }).safeParse(raw);
              if (
                !result.success ||
                containsCredential(result.data.url, apiKey)
              ) {
                summary.rejectedRecords++;
                continue;
              }
              const resultRef = `brave_${digest([page.queryId, result.data.url])}`;
              if (seen.has(resultRef)) continue;
              seen.add(resultRef);
              observations.push(
                observationSchema.parse({
                  sourceId,
                  sourceRecordId: resultRef,
                  sourcePolicyRef: access.decisionRef,
                  discoveryProvenance: {
                    kind: "brave_search_result",
                    ...access,
                    queryRef: page.queryId,
                    resultRef,
                    manifestHash: frozenHash,
                    attemptId: request.attemptId,
                    capturedAt,
                    retentionUntil,
                  },
                  observedAt: capturedAt,
                  kind: "search_lead",
                  originalUrl: result.data.url,
                  title: null,
                  employer: null,
                  location: null,
                  employmentType: null,
                  englishAccepted: { status: "unknown" },
                  remoteFromGermany: { status: "unknown" },
                  applicationLinks: [],
                  publishedAt: null,
                  expiresAt: null,
                  retentionUntil,
                }),
              );
            }
            summary.returnedRecords = observations.length;
            summary.reason = "completed";
            completed = true;
          } catch (error) {
            summary.reason =
              error instanceof ResponseFailure
                ? error.reason
                : signal.aborted
                  ? "response_timeout"
                  : error instanceof SourceFailure
                    ? "authorization_expired"
                    : "invalid_payload";
            observations = [];
          }
        }
        if (!completed) void response.body?.cancel().catch(() => {});
      } catch (error) {
        if (!begun) {
          active = false;
          throw error;
        }
        if (
          error instanceof SourceFailure &&
          error.code === "source_search_authorization_expired"
        )
          summary.reason = "authorization_expired";
      }
      try {
        try {
          await abortable(afterAttempt({ ...summary }), signal);
        } catch {
          throw new SourceFailure(
            "source_search_reconciliation_required",
            retryAt,
          );
        }
        if (!completed)
          throw new SourceFailure(
            retryAt
              ? "source_blocked"
              : "source_search_reconciliation_required",
            retryAt,
          );
        assertActive();
        return {
          observations,
          completedPaidAttemptId: request.attemptId,
          nextCursor: index + 1 < pages.length ? String(index + 1) : null,
          done: index + 1 >= pages.length,
        };
      } finally {
        active = false;
      }
    },
  };
}
