import { generateKeyPairSync } from "node:crypto";
import { type DiscoveryJob, discoveryJobSchema } from "@job-search/discovery";
import { cert, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { z } from "zod";
import { type ApiDependencies, preferenceSchema } from "./api.js";

export const projectId = "demo-job-search";
export function requireEmulators(environment: NodeJS.ProcessEnv): void {
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
  const firestore = getFirestore(app);
  const auth = getAuth(app);
  const storage = getStorage(app);
  const ownerDocument = (ownerId: string) => {
    z.string()
      .regex(/^[A-Za-z0-9_-]{1,128}$/)
      .parse(ownerId);
    return firestore.doc(`users/${ownerId}/preferences/discovery`);
  };
  const dependencies: ApiDependencies = {
    verifyToken: async (token) => auth.verifyIdToken(token, true),
    listJobs: async () => {
      const snapshot = await firestore
        .collection("sharedJobs")
        .where("retentionUntilEpochMs", ">", Date.now())
        .limit(100)
        .get();
      return snapshot.docs
        .map((document) => {
          const projection = discoveryJobSchema
            .extend({ retentionUntilEpochMs: z.number().int().positive() })
            .parse(document.data());
          const { retentionUntilEpochMs, ...job } = projection;
          if (
            retentionUntilEpochMs !== Date.parse(job.observation.retentionUntil)
          )
            throw new Error("Invalid projection expiry");
          return discoveryJobSchema.parse(job);
        })
        .filter(
          (job) => Date.parse(job.observation.retentionUntil) > Date.now(),
        )
        .sort((a, b) => b.lastCheckedAt.localeCompare(a.lastCheckedAt));
    },
    getPreferences: async (ownerId) => {
      const snapshot = await ownerDocument(ownerId).get();
      if (!snapshot.exists) return null;
      const value = preferenceSchema.parse(snapshot.data());
      if (value.ownerId !== ownerId) throw new Error("Stored owner mismatch");
      return value;
    },
    createPreferences: async (ownerId) => {
      const value = preferenceSchema.parse({
        ownerId,
        label: "Synthetic local preferences",
      });
      const reference = ownerDocument(ownerId);
      await firestore.runTransaction(async (transaction) => {
        const snapshot = await transaction.get(reference);
        if (!snapshot.exists) transaction.create(reference, value);
      });
      const stored = preferenceSchema.parse((await reference.get()).data());
      if (stored.ownerId !== ownerId) throw new Error("Stored owner mismatch");
      return stored;
    },
  };
  return { app, auth, firestore, storage, dependencies };
}

export async function persistSharedJobs(
  firestore: ReturnType<typeof getFirestore>,
  jobs: readonly DiscoveryJob[],
): Promise<void> {
  if (jobs.length > 100)
    throw new Error("At most 100 records per bounded import");
  const validated = jobs.map((job) => discoveryJobSchema.parse(job));
  const batch = firestore.batch();
  for (const job of validated) {
    z.string()
      .regex(/^[a-zA-Z0-9_-]+$/)
      .parse(job.jobId);
    batch.set(firestore.doc(`sharedJobs/${job.jobId}`), {
      ...job,
      retentionUntilEpochMs: Date.parse(job.observation.retentionUntil),
    });
  }
  await batch.commit();
}

/** Delete at most 100 expired read projections; repeat explicitly if a full batch was removed. */
export async function cleanupExpiredProjections(
  firestore: ReturnType<typeof getFirestore>,
  now = Date.now(),
): Promise<number> {
  const expired = await firestore
    .collection("sharedJobs")
    .where("retentionUntilEpochMs", "<=", now)
    .limit(100)
    .get();
  const batch = firestore.batch();
  for (const document of expired.docs)
    batch.delete(document.ref, { lastUpdateTime: document.updateTime });
  await batch.commit();
  return expired.size;
}
