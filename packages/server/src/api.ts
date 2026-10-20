import type { IncomingMessage, ServerResponse } from "node:http";
import type { DiscoveryJob } from "@job-search/discovery";
import { z } from "zod";
import { ProfileError } from "./profile-pdf.js";
import { profilePolicy } from "./profile-schema.js";
import type { ProfileService } from "./profile-service.js";

export const preferenceSchema = z.strictObject({
  ownerId: z.string().min(1).max(128),
  label: z.literal("Synthetic local preferences"),
});
export type Preferences = z.infer<typeof preferenceSchema>;
export interface ApiDependencies {
  mode?: "synthetic-emulators-only" | "private-pilot";
  realProfileProcessing?: boolean;
  profiles?: ProfileService;
  pilotSearchLifecycle?: {
    exportOwner(ownerId: string): Promise<unknown>;
    deleteOwner(ownerId: string): Promise<void>;
  };
  verifyToken(token: string): Promise<{ uid: string }>;
  listJobs(): Promise<DiscoveryJob[]>;
  getPreferences(ownerId: string): Promise<Preferences | null>;
  createPreferences(ownerId: string): Promise<Preferences>;
}

async function body(
  request: IncomingMessage,
  maximum: number,
): Promise<Buffer> {
  const declared = request.headers["content-length"];
  if (declared && (!/^\d+$/.test(declared) || Number(declared) > maximum))
    throw new ProfileError(413, "request_too_large");
  const chunks: Buffer[] = [];
  let length = 0;
  const timer = setTimeout(() => request.destroy(), 5000);
  try {
    for await (const chunk of request) {
      if (!Buffer.isBuffer(chunk))
        throw new ProfileError(400, "request_body_invalid");
      length += chunk.length;
      if (length > maximum) throw new ProfileError(413, "request_too_large");
      chunks.push(chunk);
    }
  } finally {
    clearTimeout(timer);
  }
  return Buffer.concat(chunks);
}
async function jsonBody(request: IncomingMessage): Promise<unknown> {
  if (request.headers["content-type"] !== "application/json")
    throw new ProfileError(415, "json_required");
  try {
    return JSON.parse((await body(request, 64 * 1024)).toString("utf8"));
  } catch (error: unknown) {
    if (error instanceof ProfileError) throw error;
    throw new ProfileError(400, "request_json_invalid");
  }
}

function requestValue<T>(schema: z.ZodType<T>, input: unknown): T {
  const result = schema.safeParse(input);
  if (!result.success) throw new ProfileError(400, "request_schema_invalid");
  return result.data;
}
export function apiHandler(dependencies: ApiDependencies) {
  return async (request: IncomingMessage, response: ServerResponse) => {
    response.setHeader("Content-Type", "application/json");
    response.setHeader("Cache-Control", "no-store");
    response.setHeader("X-Content-Type-Options", "nosniff");
    response.setHeader("X-Robots-Tag", "noindex, nofollow, noarchive");
    const send = (status: number, value: unknown) => {
      response.writeHead(status);
      response.end(JSON.stringify(value));
    };
    const path = request.url;
    if (request.method === "GET" && path === "/api/health") {
      send(200, {
        mode: dependencies.mode ?? "synthetic-emulators-only",
        realProfileProcessing: dependencies.realProfileProcessing ?? false,
      });
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
      const profiles = dependencies.profiles;
      if (
        profiles &&
        request.method === "GET" &&
        path === "/api/applications"
      ) {
        send(200, await profiles.applications(ownerId, dependencies.listJobs));
      } else if (
        profiles &&
        request.method === "POST" &&
        path === "/api/applications/generate"
      ) {
        send(
          200,
          await profiles.generateApplication(
            ownerId,
            await jsonBody(request),
            dependencies.listJobs,
          ),
        );
      } else if (
        profiles &&
        request.method === "POST" &&
        path === "/api/applications/edit"
      ) {
        send(
          200,
          await profiles.editApplication(
            ownerId,
            await jsonBody(request),
            dependencies.listJobs,
          ),
        );
      } else if (
        profiles &&
        request.method === "POST" &&
        path === "/api/applications/review"
      ) {
        send(
          200,
          await profiles.reviewApplication(
            ownerId,
            await jsonBody(request),
            dependencies.listJobs,
          ),
        );
      } else if (
        profiles &&
        request.method === "PATCH" &&
        path === "/api/applications/status"
      ) {
        send(
          200,
          await profiles.setApplicationStatus(
            ownerId,
            await jsonBody(request),
            dependencies.listJobs,
          ),
        );
      } else if (
        profiles &&
        request.method === "POST" &&
        path === "/api/applications/copy"
      ) {
        send(
          200,
          await profiles.copyApplication(
            ownerId,
            await jsonBody(request),
            dependencies.listJobs,
          ),
        );
      } else if (
        profiles &&
        request.method === "GET" &&
        path === "/api/profile"
      ) {
        send(200, {
          profile: await profiles.view(ownerId, await dependencies.listJobs()),
        });
      } else if (
        profiles &&
        request.method === "POST" &&
        path === "/api/profile/upload"
      ) {
        if (request.headers["content-type"] !== "application/pdf")
          throw new ProfileError(415, "pdf_required");
        if (
          dependencies.mode === "private-pilot" &&
          (!dependencies.realProfileProcessing ||
            request.headers["x-applicant-consent"] !==
              "reviewed-private-processing")
        )
          throw new ProfileError(403, "private_processing_consent_required");
        const operation = requestValue(
          z.string().uuid(),
          request.headers["x-operation-id"],
        );
        await profiles.upload(
          ownerId,
          operation,
          await body(request, profilePolicy.maximumPdfBytes),
        );
        send(200, {
          profile: await profiles.view(ownerId, await dependencies.listJobs()),
        });
      } else if (
        profiles &&
        request.method === "PATCH" &&
        path === "/api/profile/draft"
      ) {
        await profiles.edit(ownerId, await jsonBody(request));
        send(200, {
          profile: await profiles.view(ownerId, await dependencies.listJobs()),
        });
      } else if (
        profiles &&
        request.method === "POST" &&
        path === "/api/profile/approve"
      ) {
        await profiles.approve(ownerId, await jsonBody(request));
        send(200, {
          profile: await profiles.view(ownerId, await dependencies.listJobs()),
        });
      } else if (
        profiles &&
        request.method === "POST" &&
        path === "/api/profile/evaluate"
      ) {
        const input = requestValue(
          z.strictObject({
            expectedActiveVersionId: z.string().regex(/^[a-f0-9]{64}$/),
          }),
          await jsonBody(request),
        );
        await profiles.evaluate(
          ownerId,
          input.expectedActiveVersionId,
          await dependencies.listJobs(),
        );
        send(200, {
          profile: await profiles.view(ownerId, await dependencies.listJobs()),
        });
      } else if (
        profiles &&
        request.method === "GET" &&
        path === "/api/profile/export"
      ) {
        const pilotSearch =
          await dependencies.pilotSearchLifecycle?.exportOwner(ownerId);
        // Read sensitive files last so a slow auxiliary export cannot outlive PDF expiry or deletion.
        const exported = await profiles.exportOwner(ownerId);
        response.setHeader(
          "Content-Disposition",
          'attachment; filename="owner-export.json"',
        );
        send(
          200,
          dependencies.pilotSearchLifecycle
            ? { ...exported, pilotSearch }
            : exported,
        );
      } else if (
        profiles &&
        request.method === "DELETE" &&
        path === "/api/profile"
      ) {
        const lifecycle = await profiles.deleteOwner(ownerId);
        await dependencies.pilotSearchLifecycle?.deleteOwner(ownerId);
        send(lifecycle === "deleted" ? 200 : 202, { lifecycle });
      } else if (request.method === "GET" && path === "/api/jobs") {
        if (profiles) await profiles.requireActive(ownerId);
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
        if (dependencies.mode === "private-pilot") {
          send(404, { error: "Not found" });
          return;
        }
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
    } catch (error: unknown) {
      if (error instanceof ProfileError)
        send(error.status, { error: error.code });
      else send(503, { error: "Data unavailable; retry later" });
    }
  };
}
