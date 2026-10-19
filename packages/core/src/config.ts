import { z } from "zod";

// This offline-only foundation has no credentials, endpoints, or provider clients.
export const offlineConfigSchema = z.strictObject({
  mode: z.literal("offline"),
  logLevel: z.enum(["silent", "error", "info"]),
});

export type OfflineConfig = z.infer<typeof offlineConfigSchema>;

export function parseOfflineConfig(input: unknown): OfflineConfig {
  return offlineConfigSchema.parse(input);
}
