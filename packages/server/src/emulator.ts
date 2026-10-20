import { generateKeyPairSync } from "node:crypto";
import { cert, initializeApp } from "firebase-admin/app";
import { createFirebaseServices } from "./firebase-adapter.js";

export {
  cleanupExpiredProjections,
  decodeProfileState,
  decodeSharedJob,
  encodeProfileState,
  encodeSharedJob,
  persistSharedJobs,
} from "./firebase-adapter.js";
export const projectId = "demo-job-search";
export function requireEmulators(environment: NodeJS.ProcessEnv): void {
  if (
    environment.STORAGE_EMULATOR_HOST &&
    environment.STORAGE_EMULATOR_HOST !== "http://127.0.0.1:9199"
  )
    throw new Error("STORAGE_EMULATOR_HOST conflicts with emulator-only mode");
  for (const [name, expected] of Object.entries({
    FIREBASE_AUTH_EMULATOR_HOST: "127.0.0.1:9099",
    FIRESTORE_EMULATOR_HOST: "127.0.0.1:8080",
    FIREBASE_STORAGE_EMULATOR_HOST: "127.0.0.1:9199",
  })) {
    if (environment[name] !== expected)
      throw new Error(`${name} must be ${expected}; emulator-only mode`);
  }
}
export function createEmulatorServices() {
  requireEmulators(process.env);
  // The maintained Admin Firestore/Storage adapters require a certificate or ADC.
  // Generate a throwaway local certificate: never read ambient/live credentials.
  const { privateKey } = generateKeyPairSync("rsa", {
    modulusLength: 2048,
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
    publicKeyEncoding: { type: "spki", format: "pem" },
  });
  const credential = cert({
    projectId,
    clientEmail: "emulator@demo-job-search.invalid",
    privateKey,
  });
  credential.getAccessToken = async () => ({
    access_token: "emulator-only",
    expires_in: 3600,
  });
  const app = initializeApp({
    projectId,
    storageBucket: `${projectId}.appspot.com`,
    credential,
  });
  return createFirebaseServices(app);
}
