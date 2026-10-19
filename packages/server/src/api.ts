import type { IncomingMessage, ServerResponse } from "node:http";
import type { DiscoveryJob } from "@job-search/discovery";
import { z } from "zod";

export const preferenceSchema = z.strictObject({
  ownerId: z.string().min(1).max(128),
  label: z.literal("Synthetic local preferences"),
});
export type Preferences = z.infer<typeof preferenceSchema>;
export interface ApiDependencies {
  verifyToken(token: string): Promise<{ uid: string }>;
  listJobs(): Promise<DiscoveryJob[]>;
  getPreferences(ownerId: string): Promise<Preferences | null>;
  createPreferences(ownerId: string): Promise<Preferences>;
}

export function apiHandler(dependencies: ApiDependencies) {
  return async (request: IncomingMessage, response: ServerResponse) => {
    response.setHeader("Content-Type", "application/json");
    response.setHeader("Cache-Control", "no-store");
    response.setHeader("X-Content-Type-Options", "nosniff");
    const send = (status: number, value: unknown) => {
      response.writeHead(status);
      response.end(JSON.stringify(value));
    };
    const path = request.url;
    if (request.method === "GET" && path === "/api/health") {
      send(200, { mode: "synthetic-emulators-only" });
      return;
    }
    const bearer = request.headers.authorization;
    if (!bearer?.startsWith("Bearer ") || bearer.length > 8192) {
      send(401, { error: "Authentication required" });
      return;
    }
    let ownerId: string;
    try {
      const identity = await dependencies.verifyToken(bearer.slice(7));
      ownerId = z
        .string()
        .regex(/^[A-Za-z0-9_-]{1,128}$/)
        .parse(identity.uid);
    } catch {
      send(401, { error: "Authentication expired or invalid" });
      return;
    }
    try {
      if (request.method === "GET" && path === "/api/jobs") {
        send(200, {
          jobs: await dependencies.listJobs(),
          fitScoreStatus: "unavailable_until_g5",
        });
      } else if (request.method === "GET" && path === "/api/preferences") {
        send(200, { preferences: await dependencies.getPreferences(ownerId) });
      } else if (
        request.method === "POST" &&
        path === "/api/demo/preferences"
      ) {
        // No owner or candidate facts are accepted from the browser.
        if (
          request.headers["transfer-encoding"] ||
          (request.headers["content-length"] &&
            request.headers["content-length"] !== "0")
        ) {
          send(400, { error: "This endpoint accepts no request body" });
          return;
        }
        send(200, {
          preferences: await dependencies.createPreferences(ownerId),
        });
      } else {
        send(404, { error: "Not found" });
      }
    } catch {
      send(503, { error: "Local data unavailable; retry later" });
    }
  };
}
