import type { IncomingMessage, ServerResponse } from "node:http";
import type { App } from "firebase-admin/app";
import type { Firestore } from "firebase-admin/firestore";
import { z } from "zod";
import { type ApiDependencies, apiHandler } from "./api.js";
import {
  type PilotSearchConfig,
  pilotRunSchema,
  pilotSearchConfigSchema,
  pilotSearchRequestSchema,
  type SearchRunSummary,
  searchRunSummary,
} from "./pilot-search-schema.js";
import { PilotSearchStore } from "./pilot-search-store.js";
import { ProfileError } from "./profile-pdf.js";

export interface PilotSearchOperations {
  current(ownerId: string): Promise<SearchRunSummary | null>;
  start(
    ownerId: string,
    input: z.infer<typeof pilotSearchRequestSchema>,
  ): Promise<SearchRunSummary>;
}
export function createPilotSearchOperations(
  store: PilotSearchStore,
  dispatch: (id: string, ownerId: string) => Promise<void>,
): PilotSearchOperations {
  return {
    current: (ownerId) => store.get(ownerId),
    start: async (ownerId, input) => {
      const { run, created } = await store.create(
        ownerId,
        input.operationId,
        input.expectedActiveVersionId,
      );
      if (created) {
        try {
          await dispatch(run.id, ownerId);
        } catch {
          await store.dispatchUncertain(run.id);
        }
      }
      return searchRunSummary(
        pilotRunSchema.parse((await store.runRef(run.id).get()).data()),
      );
    },
  };
}
/** One dispatch only. An HTTP error/timeout is ambiguous and never retried here. */
export function cloudRunJobDispatcher(
  app: App,
  rawConfig: PilotSearchConfig,
  fetchImpl: typeof fetch = fetch,
) {
  const config = pilotSearchConfigSchema.parse(rawConfig);
  return async (runId: string, ownerId: string): Promise<void> => {
    z.string().uuid().parse(runId);
    z.string()
      .regex(/^[A-Za-z0-9_-]{1,128}$/)
      .parse(ownerId);
    const credential = app.options.credential;
    if (!credential) throw new Error("platform_credential_required");
    const token = await credential.getAccessToken();
    const result = await fetchImpl(
      `https://run.googleapis.com/v2/projects/${config.projectId}/locations/${config.region}/jobs/${config.jobName}:run`,
      {
        method: "POST",
        redirect: "error",
        signal: AbortSignal.timeout(15_000),
        headers: {
          Authorization: `Bearer ${token.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          overrides: {
            taskCount: 1,
            timeout: "780s",
            containerOverrides: [
              {
                env: [
                  { name: "JOB_SEARCH_RUN_ID", value: runId },
                  { name: "JOB_SEARCH_RUN_OWNER", value: ownerId },
                ],
              },
            ],
          },
        }),
      },
    );
    void result.body?.cancel().catch(() => {});
    if (!result.ok) throw new Error("pilot_dispatch_uncertain");
  };
}
export function pilotSearchHandler(
  dependencies: ApiDependencies,
  operations: PilotSearchOperations,
) {
  const fallback = apiHandler(dependencies);
  return async (request: IncomingMessage, response: ServerResponse) => {
    if (request.url !== "/api/search-runs") return fallback(request, response);
    response.setHeader("Content-Type", "application/json");
    response.setHeader("Cache-Control", "no-store");
    response.setHeader("X-Content-Type-Options", "nosniff");
    response.setHeader("X-Robots-Tag", "noindex, nofollow, noarchive");
    const send = (status: number, value: unknown) => {
      response.writeHead(status);
      response.end(JSON.stringify(value));
    };
    if (dependencies.mode !== "private-pilot") {
      send(404, { error: "Not found" });
      return;
    }
    const bearer = request.headers.authorization;
    if (!bearer?.startsWith("Bearer ") || bearer.length > 8192) {
      send(401, { error: "Authentication required" });
      return;
    }
    let ownerId: string;
    try {
      ownerId = z
        .string()
        .regex(/^[A-Za-z0-9_-]{1,128}$/)
        .parse((await dependencies.verifyToken(bearer.slice(7))).uid);
    } catch {
      send(401, { error: "Authentication expired or invalid" });
      return;
    }
    try {
      await dependencies.profiles?.requireActive(ownerId);
      if (request.method === "GET") {
        const run = await operations.current(ownerId);
        await dependencies.profiles?.requireActive(ownerId);
        send(200, { run });
        return;
      }
      if (request.method !== "POST") {
        send(405, { error: "Method not allowed" });
        return;
      }
      if (request.headers["content-type"] !== "application/json")
        throw new ProfileError(415, "json_required");
      const length = request.headers["content-length"];
      if (length && (!/^\d+$/.test(length) || Number(length) > 4096))
        throw new ProfileError(413, "request_too_large");
      const chunks: Buffer[] = [];
      let bytes = 0;
      const timer = setTimeout(() => request.destroy(), 5000);
      try {
        for await (const chunk of request) {
          if (!Buffer.isBuffer(chunk))
            throw new ProfileError(400, "request_body_invalid");
          bytes += chunk.length;
          if (bytes > 4096) throw new ProfileError(413, "request_too_large");
          chunks.push(chunk);
        }
      } finally {
        clearTimeout(timer);
      }
      let input: unknown;
      try {
        input = JSON.parse(Buffer.concat(chunks).toString("utf8"));
      } catch {
        throw new ProfileError(400, "request_json_invalid");
      }
      const parsed = pilotSearchRequestSchema.safeParse(input);
      if (!parsed.success)
        throw new ProfileError(400, "request_schema_invalid");
      const run = await operations.start(ownerId, parsed.data);
      await dependencies.profiles?.requireActive(ownerId);
      send(202, { run });
    } catch (error) {
      if (error instanceof ProfileError)
        send(error.status, { error: error.code });
      else send(503, { error: "Search unavailable; retry later" });
    }
  };
}
export function productionPilotSearchHandler(
  dependencies: ApiDependencies,
  firestore: Firestore,
  app: App,
  config: PilotSearchConfig,
) {
  const store = new PilotSearchStore(firestore);
  return pilotSearchHandler(
    {
      ...dependencies,
      pilotSearchLifecycle: {
        exportOwner: (ownerId) => store.exportOwner(ownerId),
        deleteOwner: (ownerId) => store.deleteOwner(ownerId),
      },
    },
    createPilotSearchOperations(store, cloudRunJobDispatcher(app, config)),
  );
}
