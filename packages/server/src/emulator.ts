import { generateKeyPairSync } from "node:crypto";
import { type DiscoveryJob, discoveryJobSchema } from "@job-search/discovery";
import { cert, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { z } from "zod";
import { type ApiDependencies, preferenceSchema } from "./api.js";
import { ProfileError } from "./profile-pdf.js";
import { profilePolicy } from "./profile-schema.js";
import {
  assertActiveProfileState,
  createProfileService,
  validatedProfileState,
} from "./profile-service.js";

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
  const firestore = getFirestore(app);
  const auth = getAuth(app);
  const storage = getStorage(app);
  const privateBucket = storage.bucket();
  // Do not retry ambiguous private writes behind the lifecycle reservation.
  privateBucket.storage.retryOptions.autoRetry = false;
  privateBucket.storage.retryOptions.maxRetries = 0;
  privateBucket.storage.retryOptions.totalTimeout = 5;
  const profileDocument = (ownerId: string) => {
    z.string()
      .regex(/^[A-Za-z0-9_-]{1,128}$/)
      .parse(ownerId);
    return firestore.doc(`users/${ownerId}/profileState/current`);
  };
  const ownerDocument = (ownerId: string) => {
    z.string()
      .regex(/^[A-Za-z0-9_-]{1,128}$/)
      .parse(ownerId);
    return firestore.doc(`users/${ownerId}/preferences/discovery`);
  };
  const profileObject = (ownerId: string, generation: string, id: string) => {
    z.string()
      .regex(/^[A-Za-z0-9_-]{1,128}$/)
      .parse(ownerId);
    z.string().uuid().parse(generation);
    z.string().uuid().parse(id);
    return privateBucket.file(`users/${ownerId}/g5/${generation}/${id}.pdf`);
  };
  const profiles = createProfileService(
    {
      read: async (ownerId) => {
        const snapshot = await profileDocument(ownerId).get();
        return snapshot.exists
          ? validatedProfileState(snapshot.data(), ownerId)
          : null;
      },
      update: async (ownerId, change) =>
        firestore.runTransaction(async (transaction) => {
          const reference = profileDocument(ownerId);
          const snapshot = await transaction.get(reference);
          const next = change(
            snapshot.exists
              ? validatedProfileState(snapshot.data(), ownerId)
              : null,
          );
          transaction.set(reference, next);
          return next;
        }),
      readPreferences: async (ownerId) => {
        const snapshot = await ownerDocument(ownerId).get();
        if (!snapshot.exists) return null;
        const value = preferenceSchema.parse(snapshot.data());
        if (value.ownerId !== ownerId)
          throw new ProfileError(503, "private_record_invalid");
        return value;
      },
      deletePreferences: async (ownerId) => {
        await ownerDocument(ownerId).delete();
      },
    },
    {
      create: async (ownerId, generation, id, bytes) => {
        await profileObject(ownerId, generation, id).save(bytes, {
          resumable: false,
          contentType: "application/pdf",
          validation: false,
          timeout: 5000,
          preconditionOpts: { ifGenerationMatch: 0 },
        });
      },
      read: async (ownerId, generation, id) => {
        const stream = profileObject(ownerId, generation, id).createReadStream({
          validation: false,
        });
        const chunks: Buffer[] = [];
        let length = 0;
        const timer = setTimeout(
          () => stream.destroy(new Error("private_asset_timeout")),
          5000,
        );
        try {
          for await (const part of stream) {
            if (!Buffer.isBuffer(part))
              throw new ProfileError(503, "private_asset_invalid");
            length += part.length;
            if (length > profilePolicy.maximumPdfBytes)
              throw new ProfileError(503, "private_asset_invalid");
            chunks.push(part);
          }
          return Buffer.concat(chunks);
        } finally {
          clearTimeout(timer);
          stream.destroy();
        }
      },
      remove: async (ownerId, generation, id) => {
        await profileObject(ownerId, generation, id).delete({
          ignoreNotFound: true,
        });
      },
    },
  );
  const dependencies: ApiDependencies = {
    profiles,
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
      await profiles.requireActive(ownerId);
      const snapshot = await ownerDocument(ownerId).get();
      if (!snapshot.exists) return null;
      const value = preferenceSchema.parse(snapshot.data());
      if (value.ownerId !== ownerId) throw new Error("Stored owner mismatch");
      await profiles.requireActive(ownerId);
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
        const profile = await transaction.get(profileDocument(ownerId));
        if (profile.exists) assertActiveProfileState(profile.data(), ownerId);
        if (!snapshot.exists) transaction.create(reference, value);
      });
      const stored = preferenceSchema.parse((await reference.get()).data());
      if (stored.ownerId !== ownerId) throw new Error("Stored owner mismatch");
      await profiles.requireActive(ownerId);
      return stored;
    },
  };
  return { app, auth, firestore, storage, dependencies, profiles };
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
