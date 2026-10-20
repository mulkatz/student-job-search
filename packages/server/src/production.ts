import { applicationDefault, initializeApp } from "firebase-admin/app";
import type { Auth, DecodedIdToken } from "firebase-admin/auth";
import { z } from "zod";
import { createFirebaseServices } from "./firebase-adapter.js";

const configSchema = z.strictObject({
  projectId: z
    .string()
    .regex(/^[a-z][a-z0-9-]{4,28}[a-z0-9]$/)
    .refine((value) => !value.startsWith("demo-")),
  storageBucket: z.string().regex(/^[a-z0-9][a-z0-9.-]{2,220}[a-z0-9]$/),
  pilotEmails: z.array(z.email().max(254)).min(1).max(10),
  realProfileProcessing: z.boolean(),
});
export type PrivatePilotConfig = z.infer<typeof configSchema>;

/** Production is an explicit platform-ADC entry point, never emulator fallback. */
export function privatePilotConfig(
  environment: NodeJS.ProcessEnv,
): PrivatePilotConfig {
  if (
    environment.JOB_SEARCH_MODE !== "private-pilot" ||
    environment.JOB_SEARCH_PLATFORM_ADC !== "enabled"
  )
    throw new Error(
      "Private pilot requires explicit mode and platform ADC opt-in",
    );
  for (const name of [
    "FIREBASE_AUTH_EMULATOR_HOST",
    "FIRESTORE_EMULATOR_HOST",
    "FIREBASE_STORAGE_EMULATOR_HOST",
    "STORAGE_EMULATOR_HOST",
    "GOOGLE_APPLICATION_CREDENTIALS",
  ]) {
    if (environment[name] !== undefined)
      throw new Error(`${name} is forbidden in private-pilot mode`);
  }
  const realProfileProcessing = environment.JOB_SEARCH_REAL_PROFILE_PROCESSING;
  if (
    realProfileProcessing !== undefined &&
    realProfileProcessing !== "enabled"
  )
    throw new Error("Invalid private profile processing option");
  return configSchema.parse({
    projectId: environment.GOOGLE_CLOUD_PROJECT,
    storageBucket: environment.JOB_SEARCH_STORAGE_BUCKET,
    pilotEmails: environment.JOB_SEARCH_PILOT_EMAILS?.split(",").map((value) =>
      value.trim().toLowerCase(),
    ),
    realProfileProcessing: realProfileProcessing === "enabled",
  });
}

/** Only a revoked-token-checked Google identity with a verified allowlisted email. */
export function requirePilotIdentity(
  token: DecodedIdToken,
  config: PrivatePilotConfig,
): { uid: string } {
  if (
    token.firebase.sign_in_provider !== "google.com" ||
    token.email_verified !== true ||
    typeof token.email !== "string" ||
    !config.pilotEmails.includes(token.email.trim().toLowerCase()) ||
    !token.firebase.identities["google.com"]?.length
  )
    throw new Error("Private pilot access denied");
  return {
    uid: z
      .string()
      .regex(/^[A-Za-z0-9_-]{1,128}$/)
      .parse(token.uid),
  };
}

export function productionTokenVerifier(
  auth: Pick<Auth, "verifyIdToken">,
  config: PrivatePilotConfig,
) {
  return async (token: string) =>
    requirePilotIdentity(await auth.verifyIdToken(token, true), config);
}

export function createProductionServices(
  environment: NodeJS.ProcessEnv = process.env,
) {
  const config = privatePilotConfig(environment);
  const app = initializeApp({
    projectId: config.projectId,
    storageBucket: config.storageBucket,
    credential: applicationDefault(),
  });
  const services = createFirebaseServices(app, {
    realProfileProcessing: config.realProfileProcessing,
  });
  return {
    ...services,
    dependencies: {
      ...services.dependencies,
      mode: "private-pilot" as const,
      realProfileProcessing: config.realProfileProcessing,
      verifyToken: productionTokenVerifier(services.auth, config),
    },
  };
}
