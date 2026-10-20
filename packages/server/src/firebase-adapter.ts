import {
  type DiscoveryJob,
  discoveryJobSchema,
  evidenceSchema,
  jobIdentity,
  languageRequirementSchema,
  languageRequirementsSchema,
  revisionIdentity,
} from "@job-search/discovery";
import type { App } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { z } from "zod";
import { type ApiDependencies, preferenceSchema } from "./api.js";
import { checkedApplicationSource } from "./application-domain.js";
import {
  applicationPackageSchema,
  applicationRecordSchema,
} from "./application-schema.js";
import { ProfileError } from "./profile-pdf.js";
import {
  type ProfileState,
  profilePolicy,
  profileStateSchema,
} from "./profile-schema.js";
import {
  assertActiveProfileState,
  createProfileService,
  validatedProfileState,
} from "./profile-service.js";

// Firestore cannot store arrays directly inside arrays. This physical encoding
// leaves the public observation and its content-derived revision identity intact.
const storedLanguageRequirementsSchema = z.union([
  languageRequirementsSchema,
  z
    .strictObject({
      status: z.literal("complete"),
      alternatives: z
        .array(
          z.strictObject({
            requirements: z.array(languageRequirementSchema).min(1).max(10),
          }),
        )
        .min(1)
        .max(5),
      evidence: evidenceSchema,
    })
    .transform((value) => ({
      ...value,
      alternatives: value.alternatives.map((set) => set.requirements),
    })),
]);
const sharedProjectionSchema = discoveryJobSchema
  .omit({ observation: true })
  .extend({
    observation: z.record(z.string(), z.unknown()),
    retentionUntilEpochMs: z.number().int().positive(),
  });

const storedJobSchema = discoveryJobSchema
  .omit({ observation: true })
  .extend({ observation: z.record(z.string(), z.unknown()) })
  .transform((value) =>
    discoveryJobSchema.parse({
      ...value,
      observation: {
        ...value.observation,
        ...(value.observation.languageRequirements === undefined
          ? {}
          : {
              languageRequirements: storedLanguageRequirementsSchema.parse(
                value.observation.languageRequirements,
              ),
            }),
      },
    }),
  );
const storedProfileSchema = profileStateSchema
  .omit({ applications: true })
  .extend({
    applications: z
      .array(
        applicationRecordSchema.omit({ packages: true }).extend({
          packages: z.array(
            applicationPackageSchema
              .omit({ jobSnapshot: true })
              .extend({ jobSnapshot: storedJobSchema }),
          ),
        }),
      )
      .optional(),
  });
export function decodeProfileState(
  value: unknown,
  ownerId: string,
): ProfileState {
  return validatedProfileState(storedProfileSchema.parse(value), ownerId);
}
export function encodeSharedJob(job: DiscoveryJob) {
  const languages = job.observation.languageRequirements;
  return {
    ...job,
    observation:
      languages?.status === "complete"
        ? {
            ...job.observation,
            languageRequirements: {
              ...languages,
              alternatives: languages.alternatives.map((requirements) => ({
                requirements,
              })),
            },
          }
        : job.observation,
  };
}
export function encodeProfileState(state: ProfileState) {
  return {
    ...state,
    ...(state.applications
      ? {
          applications: state.applications.map((record) => ({
            ...record,
            packages: record.packages.map((pkg) => ({
              ...pkg,
              jobSnapshot: encodeSharedJob(pkg.jobSnapshot),
            })),
          })),
        }
      : {}),
  };
}

export function decodeSharedJob(
  value: unknown,
  documentId: string,
  now = Date.now(),
): DiscoveryJob {
  const projection = sharedProjectionSchema.parse(value);
  const { retentionUntilEpochMs, ...stored } = projection;
  const job = storedJobSchema.parse(stored);
  if (retentionUntilEpochMs !== Date.parse(job.observation.retentionUntil))
    throw new Error("Invalid projection expiry");
  if (
    documentId !== job.jobId ||
    job.sourceId !== job.observation.sourceId ||
    job.sourceRecordId !== job.observation.sourceRecordId ||
    job.jobId !== jobIdentity(job.sourceId, job.sourceRecordId) ||
    job.currentRevisionId !== revisionIdentity(job.observation)
  )
    throw new Error("Invalid projection identity");
  if (
    Date.parse(job.observation.observedAt) > now ||
    Date.parse(job.firstSeenAt) > Date.parse(job.lastSeenAt) ||
    Date.parse(job.lastSeenAt) > Date.parse(job.lastCheckedAt) ||
    job.lastCheckedAt !== job.observation.observedAt ||
    (job.observation.kind !== "unavailable" &&
      job.lastSeenAt !== job.observation.observedAt)
  )
    throw new Error("Invalid projection chronology");
  if (job.observation.applicationSource)
    checkedApplicationSource(job, now, true);
  return job;
}

export function createFirebaseServices(
  app: App,
  options: { realProfileProcessing?: boolean } = {},
) {
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
          ? decodeProfileState(snapshot.data(), ownerId)
          : null;
      },
      update: async (ownerId, change) =>
        firestore.runTransaction(async (transaction) => {
          const reference = profileDocument(ownerId);
          const snapshot = await transaction.get(reference);
          const next = change(
            snapshot.exists
              ? decodeProfileState(snapshot.data(), ownerId)
              : null,
          );
          transaction.set(reference, encodeProfileState(next));
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
    { realProfileProcessing: options.realProfileProcessing ?? false },
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
        .map((document) => decodeSharedJob(document.data(), document.id))
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
        if (profile.exists)
          assertActiveProfileState(
            decodeProfileState(profile.data(), ownerId),
            ownerId,
          );
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
    if (job.observation.applicationSource)
      checkedApplicationSource(job, Date.now());
    z.string()
      .regex(/^[a-zA-Z0-9_-]+$/)
      .parse(job.jobId);
    const languages = job.observation.languageRequirements;
    batch.set(firestore.doc(`sharedJobs/${job.jobId}`), {
      ...job,
      observation:
        languages?.status === "complete"
          ? {
              ...job.observation,
              languageRequirements: {
                ...languages,
                alternatives: languages.alternatives.map((requirements) => ({
                  requirements,
                })),
              },
            }
          : job.observation,
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
