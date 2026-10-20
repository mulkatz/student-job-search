import { createHash, randomUUID } from "node:crypto";
import type { DiscoveryJob } from "@job-search/discovery";
import { z } from "zod";
import { validateApplicationState } from "./application-domain.js";
import {
  assertApplicationCapacity,
  createApplicationOperations,
  retainedApplications,
} from "./application-service.js";
import { independentBenchmarkEvidence } from "./profile-benchmark-evidence.js";
import { type AssessmentHook, evaluateProfileJob } from "./profile-matching.js";
import { contentHash, extractProfilePdf, ProfileError } from "./profile-pdf.js";
import {
  currentEvaluatorVersion,
  type PrivateEvaluation,
  type ProfileFact,
  type ProfileState,
  type ProfileVersion,
  type ProfileView,
  profileApprovalSchema,
  profileEditSchema,
  profilePolicy,
  profileStateSchema,
  profileVersionSchema,
  profileViewSchema,
} from "./profile-schema.js";

export interface ProfileRepository {
  read(ownerId: string): Promise<ProfileState | null>;
  update(
    ownerId: string,
    change: (state: ProfileState | null) => ProfileState,
  ): Promise<ProfileState>;
  readPreferences(ownerId: string): Promise<unknown>;
  deletePreferences(ownerId: string): Promise<void>;
}
export interface ProfileAssets {
  create(
    ownerId: string,
    generation: string,
    id: string,
    bytes: Buffer,
  ): Promise<void>;
  read(ownerId: string, generation: string, id: string): Promise<Buffer>;
  remove(ownerId: string, generation: string, id: string): Promise<void>;
}
const iso = (now: number) => new Date(now).toISOString();
const benchmark = independentBenchmarkEvidence;
function factSource(fact: ProfileFact) {
  return fact.provenance.kind === "pdf_quote"
    ? fact.provenance
    : fact.provenance.priorSource;
}
function versionIdentity(
  ownerId: string,
  generation: string,
  operationId: string,
  profileHash: string,
  sourceAssets?: ProfileVersion["sourceAssets"],
  sourceAssetHash?: string,
): string {
  return contentHash([
    ownerId,
    generation,
    operationId,
    profileHash,
    ...(sourceAssets ? [{ sourceAssets, sourceAssetHash }] : []),
  ]);
}
export function validatedProfileState(
  input: unknown,
  ownerId: string,
): ProfileState {
  const result = profileStateSchema.safeParse(input);
  if (!result.success || result.data.ownerId !== ownerId)
    throw new ProfileError(503, "private_record_invalid");
  const state = result.data;
  if (
    Buffer.byteLength(JSON.stringify(state)) >
    profilePolicy.maximumDocumentBytes
  )
    throw new ProfileError(413, "private_record_limit_reached");
  const retained = (start: string, end: string, maximum: number) =>
    Date.parse(end) > Date.parse(start) &&
    Date.parse(end) - Date.parse(start) <= maximum;
  if (
    new Set(state.assets.map((asset) => asset.id)).size !==
      state.assets.length ||
    new Set(state.drafts.map((draft) => draft.id)).size !==
      state.drafts.length ||
    new Set(state.versions.map((version) => version.id)).size !==
      state.versions.length ||
    new Set(state.evaluations.map((evaluation) => evaluation.id)).size !==
      state.evaluations.length ||
    new Set([...state.assets, ...state.cleanupObjects].map((asset) => asset.id))
      .size !==
      state.assets.length + state.cleanupObjects.length ||
    state.assets.length + state.cleanupObjects.length >
      profilePolicy.maximumAssets ||
    state.versions.some(
      (version) =>
        version.ownerId !== ownerId ||
        version.profileHash !== contentHash(version.facts) ||
        version.id !==
          versionIdentity(
            ownerId,
            state.generation,
            version.operationId,
            version.profileHash,
            version.sourceAssets,
            version.sourceAssetHash,
          ) ||
        new Set(version.facts.map((fact) => fact.id)).size !==
          version.facts.length ||
        (version.sourceAssets !== undefined &&
          (new Set(version.sourceAssets.map((asset) => asset.id)).size !==
            version.sourceAssets.length ||
            !version.sourceAssets.some(
              (asset) => asset.hash === version.sourceAssetHash,
            ) ||
            version.sourceAssets.some((source) => {
              const asset = state.assets.find(
                (entry) => entry.id === source.id,
              );
              return (
                asset !== undefined &&
                (asset.status !== "ready" || asset.hash !== source.hash)
              );
            }) ||
            version.facts.some((fact) => {
              const source = factSource(fact);
              return (
                source !== undefined &&
                (!source.sourceAssetId ||
                  !version.sourceAssets?.some(
                    (asset) => asset.id === source.sourceAssetId,
                  ))
              );
            }))) ||
        !retained(
          version.approvedAt,
          version.expiresAt,
          profilePolicy.profileRetentionMs,
        ),
    ) ||
    state.assets.some(
      (asset) =>
        !retained(
          asset.pendingUntil,
          asset.expiresAt,
          profilePolicy.rawRetentionMs,
        ),
    ) ||
    state.drafts.some(
      (draft) =>
        !retained(
          draft.createdAt,
          draft.expiresAt,
          profilePolicy.rawRetentionMs,
        ) ||
        new Set(draft.facts.map((fact) => fact.id)).size !==
          draft.facts.length ||
        new Set(
          draft.pages.map(
            (page) => `${page.sourceAssetId ?? draft.assetId}:${page.page}`,
          ),
        ).size !== draft.pages.length ||
        draft.pages.reduce((length, page) => length + page.text.length, 0) >
          profilePolicy.maximumText ||
        (draft.sourceAssetIds !== undefined &&
          (new Set(draft.sourceAssetIds).size !== draft.sourceAssetIds.length ||
            !draft.sourceAssetIds.includes(draft.assetId) ||
            draft.sourceAssetIds.some(
              (id) =>
                !state.assets.some(
                  (asset) =>
                    asset.id === id &&
                    asset.status === "ready" &&
                    Date.parse(asset.expiresAt) >= Date.parse(draft.expiresAt),
                ),
            ) ||
            draft.pages.some(
              (page) =>
                !page.sourceAssetId ||
                !draft.sourceAssetIds?.includes(page.sourceAssetId),
            ))) ||
        draft.facts.some((fact) => {
          const source = factSource(fact);
          return (
            source !== undefined &&
            !draft.pages.some(
              (page) =>
                page.page === source.page &&
                (page.sourceAssetId ?? draft.assetId) ===
                  (source.sourceAssetId ?? draft.assetId) &&
                page.text.includes(source.quote),
            )
          );
        }),
    ) ||
    state.evaluations.some(
      (evaluation) =>
        evaluation.ownerId !== ownerId ||
        !retained(
          evaluation.evaluatedAt,
          evaluation.expiresAt,
          profilePolicy.rawRetentionMs,
        ) ||
        !state.versions.some(
          (version) =>
            version.id === evaluation.profileVersionId &&
            version.profileHash === evaluation.profileHash &&
            Date.parse(evaluation.expiresAt) <= Date.parse(version.expiresAt),
        ),
    ) ||
    (state.activeVersionId !== null &&
      !state.versions.some((version) => version.id === state.activeVersionId))
  )
    throw new ProfileError(503, "private_record_invalid");
  validateApplicationState(state);
  return state;
}
function requestValue<T>(schema: z.ZodType<T>, input: unknown): T {
  const result = schema.safeParse(input);
  if (!result.success) throw new ProfileError(400, "request_schema_invalid");
  return result.data;
}
function live(state: ProfileState, now: number): ProfileState {
  if (state.lifecycle !== "active")
    throw new ProfileError(410, "owner_data_deleted");
  if (
    !state.assets.some((asset) => Date.parse(asset.expiresAt) > now) &&
    !state.versions.some((version) => Date.parse(version.expiresAt) > now) &&
    !(state.applications ?? []).some(
      (record) => Date.parse(record.expiresAt) > now,
    )
  )
    throw new ProfileError(410, "owner_data_expired");
  return state;
}
export function assertActiveProfileState(
  state: unknown,
  ownerId: string,
  now = Date.now(),
): void {
  live(validatedProfileState(state, ownerId), now);
}
function newState(ownerId: string, now: number): ProfileState {
  return {
    ownerId,
    generation: randomUUID(),
    lifecycle: "active",
    revision: 0,
    activeVersionId: null,
    assets: [],
    cleanupObjects: [],
    drafts: [],
    versions: [],
    evaluations: [],
    createdAt: iso(now),
    updatedAt: iso(now),
    nextCleanupAt: iso(now + profilePolicy.rawRetentionMs),
  };
}
function touch(state: ProfileState, now: number): ProfileState {
  const deadlines = [
    ...state.assets.flatMap((asset) =>
      asset.status === "pending"
        ? [asset.pendingUntil, asset.expiresAt]
        : [asset.expiresAt],
    ),
    ...state.drafts.map((draft) => draft.expiresAt),
    ...state.versions.map((version) => version.expiresAt),
    ...state.evaluations.map((evaluation) => evaluation.expiresAt),
    ...(state.applications ?? []).flatMap((record) => [
      record.expiresAt,
      ...record.packages.map((pkg) => pkg.expiresAt),
    ]),
  ];
  return {
    ...state,
    revision: state.revision + 1,
    updatedAt: iso(now),
    nextCleanupAt:
      state.lifecycle === "deleted"
        ? null
        : state.cleanupObjects.some((asset) => asset.status === "settled")
          ? iso(now)
          : (deadlines.sort()[0] ?? null),
  };
}

export function createProfileService(
  repository: ProfileRepository,
  assets: ProfileAssets,
  options: {
    now?: () => number;
    assessmentHook?: AssessmentHook;
    realProfileProcessing?: boolean;
  } = {},
) {
  const now = options.now ?? Date.now;
  const checked = async (ownerId: string) => {
    const state = await repository.read(ownerId);
    return state ? validatedProfileState(state, ownerId) : null;
  };
  const change = (
    ownerId: string,
    update: (state: ProfileState | null) => ProfileState,
  ) =>
    repository.update(ownerId, (state) => {
      const next = update(state ? validatedProfileState(state, ownerId) : null);
      assertApplicationCapacity(next);
      return validatedProfileState(next, ownerId);
    });
  const requireState = (state: ProfileState | null): ProfileState => {
    if (!state) throw new ProfileError(409, "profile_not_created");
    return live(state, now());
  };
  const view = async (
    ownerId: string,
    jobs: readonly DiscoveryJob[],
  ): Promise<ProfileView> => {
    const state = await checked(ownerId);
    if (!state)
      return {
        lifecycle: "empty",
        revision: 0,
        activeVersionId: null,
        pendingCleanup: 0,
        drafts: [],
        versions: [],
        evaluations: [],
        benchmark,
      };
    if (state.lifecycle !== "active")
      return {
        lifecycle: state.lifecycle,
        revision: state.revision,
        activeVersionId: null,
        pendingCleanup: state.cleanupObjects.length,
        drafts: [],
        versions: [],
        evaluations: [],
        benchmark,
      };
    live(state, now());
    const versions = state.versions.filter(
      (version) => Date.parse(version.expiresAt) > now(),
    );
    const activeVersionId = versions.some(
      (version) => version.id === state.activeVersionId,
    )
      ? state.activeVersionId
      : null;
    return profileViewSchema.parse({
      lifecycle: "active",
      revision: state.revision,
      activeVersionId,
      pendingCleanup:
        state.cleanupObjects.length +
        state.assets.filter((asset) => asset.status === "uncertain").length,
      drafts: state.drafts.filter(
        (draft) => Date.parse(draft.expiresAt) > now(),
      ),
      versions,
      evaluations: state.evaluations
        .filter((evaluation) => Date.parse(evaluation.expiresAt) > now())
        .map((evaluation) => ({
          ...evaluation,
          stale:
            evaluation.evaluatorVersion !== currentEvaluatorVersion ||
            evaluation.profileVersionId !== activeVersionId ||
            !jobs.some(
              (job) =>
                job.jobId === evaluation.jobId &&
                job.currentRevisionId === evaluation.jobRevisionId &&
                Date.parse(job.observation.retentionUntil) > now(),
            ),
        })),
      benchmark,
    });
  };
  const upload = async (
    ownerId: string,
    operationId: string,
    bytes: Buffer,
  ) => {
    requestValue(z.string().uuid(), operationId);
    if (!bytes.length || bytes.length > profilePolicy.maximumPdfBytes)
      throw new ProfileError(413, "pdf_size_invalid");
    const hash = createHash("sha256").update(bytes).digest("hex");
    let existing = false;
    const reserved = await change(ownerId, (value) => {
      existing = false;
      const state = value ? requireState(value) : newState(ownerId, now());
      const previous = state.assets.find((asset) => asset.id === operationId);
      if (previous) {
        if (previous.hash !== hash)
          throw new ProfileError(409, "operation_content_conflict");
        if (previous.status !== "ready")
          throw new ProfileError(409, "upload_not_ready");
        existing = true;
        return state;
      }
      if (
        state.assets.length + state.cleanupObjects.length >=
        profilePolicy.maximumAssets
      )
        throw new ProfileError(409, "asset_limit_reached");
      state.assets.push({
        id: operationId,
        hash,
        bytes: bytes.length,
        status: "pending",
        expiresAt: iso(now() + profilePolicy.rawRetentionMs),
        pendingUntil: iso(now() + 30_000),
      });
      return touch(state, now());
    });
    if (existing) return;
    let storageSettled = false;
    try {
      await assets.create(ownerId, reserved.generation, operationId, bytes);
      storageSettled = true;
      const extracted = await extractProfilePdf(bytes, {
        realProfileProcessing: options.realProfileProcessing ?? false,
      });
      await change(ownerId, (value) => {
        const state = requireState(value);
        if (state.generation !== reserved.generation)
          throw new ProfileError(409, "owner_generation_changed");
        const asset = state.assets.find((entry) => entry.id === operationId);
        if (
          asset?.status !== "pending" ||
          Date.parse(asset.pendingUntil) <= now()
        )
          throw new ProfileError(409, "upload_reservation_expired");
        asset.status = "ready";
        const previous = options.realProfileProcessing
          ? state.drafts.findLast(
              (draft) =>
                Date.parse(draft.expiresAt) > now() &&
                ["text_extracted", "needs_review"].includes(draft.outcome),
            )
          : undefined;
        const includePrevious =
          previous &&
          ["text_extracted", "needs_review"].includes(extracted.outcome);
        const sourceAssetIds = includePrevious
          ? [...(previous.sourceAssetIds ?? [previous.assetId]), operationId]
          : [operationId];
        const pages = options.realProfileProcessing
          ? [
              ...(includePrevious
                ? previous.pages.map((page) => ({
                    ...page,
                    sourceAssetId: page.sourceAssetId ?? previous.assetId,
                  }))
                : []),
              ...extracted.pages.map((page) => ({
                ...page,
                sourceAssetId: operationId,
              })),
            ]
          : extracted.pages;
        const facts = options.realProfileProcessing
          ? [
              ...(includePrevious ? previous.facts : []),
              ...extracted.facts.map(
                (fact): ProfileFact => ({
                  ...fact,
                  id: `fact_${contentHash([operationId, fact.id]).slice(0, 32)}`,
                  provenance:
                    fact.provenance.kind === "pdf_quote"
                      ? { ...fact.provenance, sourceAssetId: operationId }
                      : fact.provenance,
                }),
              ),
            ]
          : extracted.facts;
        if (
          sourceAssetIds.length > profilePolicy.maximumAssets ||
          facts.length > 20 ||
          pages.length > 30 ||
          pages.reduce((length, page) => length + page.text.length, 0) >
            profilePolicy.maximumText
        )
          throw new ProfileError(413, "combined_profile_limit_reached");
        if (
          sourceAssetIds.some(
            (id) =>
              !state.assets.some(
                (source) =>
                  source.id === id &&
                  source.status === "ready" &&
                  Date.parse(source.expiresAt) > now(),
              ),
          )
        )
          throw new ProfileError(409, "source_asset_unavailable");
        state.drafts.push({
          id: operationId,
          assetId: operationId,
          revision: 0,
          ...extracted,
          pages,
          facts,
          ...(options.realProfileProcessing ? { sourceAssetIds } : {}),
          createdAt: iso(now()),
          expiresAt:
            includePrevious && previous.expiresAt < asset.expiresAt
              ? previous.expiresAt
              : asset.expiresAt,
        });
        return touch(state, now());
      });
    } catch (error: unknown) {
      let removed = false;
      if (storageSettled) {
        try {
          await assets.remove(ownerId, reserved.generation, operationId);
          removed = true;
        } catch {
          /* Retain the marker for explicit reconciliation. */
        }
      }
      await change(ownerId, (state) => {
        if (!state) throw new ProfileError(503, "private_record_invalid");
        const asset = state.assets.find((entry) => entry.id === operationId);
        if (asset)
          asset.status = storageSettled && removed ? "failed" : "uncertain";
        const marker = state.cleanupObjects.find(
          (entry) => entry.id === operationId,
        );
        if (marker)
          marker.status = storageSettled && removed ? "settled" : "uncertain";
        return touch(state, now());
      });
      throw error instanceof ProfileError
        ? error
        : new ProfileError(503, "private_upload_failed");
    }
  };
  const edit = async (ownerId: string, input: unknown) => {
    const patch = requestValue(profileEditSchema, input);
    if (new Set(patch.facts.map((fact) => fact.id)).size !== patch.facts.length)
      throw new ProfileError(400, "duplicate_fact_ids");
    await change(ownerId, (value) => {
      const state = requireState(value);
      const draft = state.drafts.find(
        (entry) =>
          entry.id === patch.draftId && Date.parse(entry.expiresAt) > now(),
      );
      if (!draft) throw new ProfileError(404, "draft_not_found");
      if (draft.revision !== patch.expectedRevision)
        throw new ProfileError(409, "draft_revision_conflict");
      if (!["text_extracted", "needs_review"].includes(draft.outcome))
        throw new ProfileError(422, "draft_not_editable");
      draft.facts = patch.facts.map((fact): ProfileFact => {
        const previous = draft.facts.find((entry) => entry.id === fact.id);
        if (
          previous &&
          previous.value === fact.value &&
          previous.category === fact.category &&
          !fact.attestation
        )
          return previous;
        if (!fact.attestation)
          throw new ProfileError(422, "correction_attestation_required");
        const priorSource =
          previous?.provenance.kind === "pdf_quote"
            ? {
                ...(previous.provenance.sourceAssetId
                  ? { sourceAssetId: previous.provenance.sourceAssetId }
                  : {}),
                page: previous.provenance.page,
                quote: previous.provenance.quote,
              }
            : previous?.provenance.priorSource;
        return {
          id: fact.id,
          category: fact.category,
          value: fact.value,
          provenance: {
            kind: "user_attestation",
            statement: fact.attestation,
            ...(priorSource ? { priorSource } : {}),
          },
        };
      });
      draft.revision++;
      return touch(state, now());
    });
  };
  const approve = async (ownerId: string, input: unknown) => {
    const request = requestValue(profileApprovalSchema, input);
    const requestHash = contentHash(request);
    await change(ownerId, (value) => {
      const state = requireState(value);
      const repeated = state.versions.find(
        (version) => version.operationId === request.operationId,
      );
      if (repeated) {
        if (repeated.approvalRequestHash !== requestHash)
          throw new ProfileError(409, "operation_content_conflict");
        return state;
      }
      if (state.activeVersionId !== request.expectedActiveVersionId)
        throw new ProfileError(409, "active_profile_conflict");
      const draft = state.drafts.find(
        (entry) =>
          entry.id === request.draftId && Date.parse(entry.expiresAt) > now(),
      );
      if (!draft || draft.revision !== request.expectedRevision)
        throw new ProfileError(409, "draft_revision_conflict");
      if (
        !draft.facts.length ||
        !["text_extracted", "needs_review"].includes(draft.outcome)
      )
        throw new ProfileError(422, "draft_approval_unavailable");
      if (state.versions.length >= profilePolicy.maximumVersions)
        throw new ProfileError(409, "version_limit_reached");
      const asset = state.assets.find(
        (entry) => entry.id === draft.assetId && entry.status === "ready",
      );
      if (!asset) throw new ProfileError(409, "source_asset_unavailable");
      const sourceAssets = (draft.sourceAssetIds ?? [draft.assetId]).map(
        (id) => {
          const source = state.assets.find(
            (entry) =>
              entry.id === id &&
              entry.status === "ready" &&
              Date.parse(entry.expiresAt) > now(),
          );
          if (!source) throw new ProfileError(409, "source_asset_unavailable");
          return { id: source.id, hash: source.hash };
        },
      );
      const profileHash = contentHash(draft.facts);
      const approvedTime = now();
      const version = profileVersionSchema.parse({
        id: versionIdentity(
          ownerId,
          state.generation,
          request.operationId,
          profileHash,
          draft.sourceAssetIds ? sourceAssets : undefined,
          asset.hash,
        ),
        ownerId,
        draftId: draft.id,
        draftRevision: draft.revision,
        facts: structuredClone(draft.facts),
        profileHash,
        sourceAssetHash: asset.hash,
        ...(draft.sourceAssetIds ? { sourceAssets } : {}),
        approvedAt: iso(approvedTime),
        expiresAt: iso(approvedTime + profilePolicy.profileRetentionMs),
        operationId: request.operationId,
        approvalRequestHash: requestHash,
      });
      state.versions.push(version);
      state.activeVersionId = version.id;
      return touch(state, now());
    });
  };
  const evaluate = async (
    ownerId: string,
    expectedActiveVersionId: string,
    jobs: readonly DiscoveryJob[],
  ) => {
    const initial = requireState(await checked(ownerId));
    if (initial.activeVersionId !== expectedActiveVersionId)
      throw new ProfileError(409, "active_profile_conflict");
    const profile = initial.versions.find(
      (version) =>
        version.id === expectedActiveVersionId &&
        Date.parse(version.expiresAt) > now(),
    );
    if (!profile) throw new ProfileError(409, "approved_profile_required");
    const evaluations: PrivateEvaluation[] = [];
    for (const job of jobs.slice(0, 100))
      evaluations.push(
        await evaluateProfileJob(profile, job, now(), options.assessmentHook),
      );
    await change(ownerId, (value) => {
      const state = requireState(value);
      if (
        state.activeVersionId !== expectedActiveVersionId ||
        state.generation !== initial.generation
      )
        throw new ProfileError(409, "active_profile_conflict");
      if (
        evaluations.some(
          (evaluation) => Date.parse(evaluation.expiresAt) <= now(),
        )
      )
        throw new ProfileError(410, "evaluation_input_expired");
      const packageEvaluationIds = new Set(
        (state.applications ?? []).flatMap((record) =>
          record.packages.map((pkg) => pkg.evaluationId),
        ),
      );
      const merged = new Map(
        state.evaluations
          .filter(
            (entry) =>
              Date.parse(entry.expiresAt) > now() ||
              packageEvaluationIds.has(entry.id),
          )
          .map((entry) => [entry.id, entry]),
      );
      for (const evaluation of evaluations)
        if (!merged.has(evaluation.id)) merged.set(evaluation.id, evaluation);
      if (merged.size > profilePolicy.maximumEvaluations)
        throw new ProfileError(409, "evaluation_limit_reached");
      state.evaluations = [...merged.values()];
      return touch(state, now());
    });
  };
  const exportOwner = async (ownerId: string) => {
    const state = requireState(await checked(ownerId));
    if (
      state.cleanupObjects.length ||
      state.assets.some(
        (asset) => asset.status === "pending" || asset.status === "uncertain",
      )
    )
      throw new ProfileError(409, "export_upload_pending");
    const retainedAssets = state.assets.filter(
      (asset) =>
        asset.status === "ready" && Date.parse(asset.expiresAt) > now(),
    );
    const files = [];
    for (const asset of retainedAssets) {
      const bytes = await assets.read(ownerId, state.generation, asset.id);
      if (
        bytes.length !== asset.bytes ||
        createHash("sha256").update(bytes).digest("hex") !== asset.hash
      )
        throw new ProfileError(503, "private_asset_invalid");
      files.push({
        id: asset.id,
        sha256: asset.hash,
        contentType: "application/pdf",
        base64: bytes.toString("base64"),
        expiresAt: asset.expiresAt,
      });
    }
    const preferences = await repository.readPreferences(ownerId);
    const current = requireState(await checked(ownerId));
    if (
      current.revision !== state.revision ||
      current.generation !== state.generation
    )
      throw new ProfileError(409, "export_snapshot_changed");
    if (retainedAssets.some((asset) => Date.parse(asset.expiresAt) <= now()))
      throw new ProfileError(410, "export_asset_expired");
    const versions = state.versions.filter(
      (version) => Date.parse(version.expiresAt) > now(),
    );
    return {
      format: "job-search-owner-export-v1",
      exportedAt: iso(now()),
      profile: {
        ...state,
        ...(state.applications
          ? { applications: retainedApplications(state, now()) }
          : {}),
        assets: retainedAssets,
        activeVersionId: versions.some(
          (version) => version.id === state.activeVersionId,
        )
          ? state.activeVersionId
          : null,
        drafts: state.drafts.filter(
          (draft) => Date.parse(draft.expiresAt) > now(),
        ),
        versions,
        evaluations: state.evaluations.filter(
          (evaluation) => Date.parse(evaluation.expiresAt) > now(),
        ),
      },
      preferences,
      files,
    };
  };
  const deleteOwner = async (ownerId: string) => {
    const marked = await change(ownerId, (value) => {
      const state = value ?? newState(ownerId, now());
      if (state.lifecycle === "deleted") return state;
      if (state.lifecycle === "active") {
        state.cleanupObjects.push(
          ...state.assets.map((asset) => ({
            id: asset.id,
            status:
              asset.status === "pending" || asset.status === "uncertain"
                ? asset.status
                : ("settled" as const),
          })),
        );
        state.assets = [];
        state.drafts = [];
        state.versions = [];
        state.evaluations = [];
        state.applications = [];
        state.activeVersionId = null;
      }
      state.lifecycle = "deleting";
      return touch(state, now());
    });
    if (marked.lifecycle === "deleted") return "deleted" as const;
    let pending = false;
    const removed = new Set<string>();
    for (const asset of marked.cleanupObjects) {
      if (asset.status === "pending" || asset.status === "uncertain") {
        pending = true;
        continue;
      }
      await assets.remove(ownerId, marked.generation, asset.id);
      removed.add(asset.id);
    }
    await repository.deletePreferences(ownerId);
    if (pending) {
      await change(ownerId, (value) => {
        if (
          !value ||
          value.generation !== marked.generation ||
          value.lifecycle !== "deleting"
        )
          throw new ProfileError(409, "owner_generation_changed");
        value.cleanupObjects = value.cleanupObjects.filter(
          (asset) => !removed.has(asset.id),
        );
        return touch(value, now());
      });
      return "deleting" as const;
    }
    await change(ownerId, (value) => {
      if (
        !value ||
        value.generation !== marked.generation ||
        value.lifecycle !== "deleting"
      )
        throw new ProfileError(409, "owner_generation_changed");
      return touch(
        {
          ...value,
          lifecycle: "deleted",
          activeVersionId: null,
          assets: [],
          cleanupObjects: [],
          drafts: [],
          versions: [],
          evaluations: [],
          applications: [],
        },
        now(),
      );
    });
    return "deleted" as const;
  };
  const cleanup = async (ownerId: string) => {
    const current = await checked(ownerId);
    if (!current || current.lifecycle === "deleted") return;
    if (current.lifecycle === "deleting") {
      await deleteOwner(ownerId);
      return;
    }
    const expired = current.assets.filter(
      (asset) => Date.parse(asset.expiresAt) <= now(),
    );
    const physicallyRemoved = new Set<string>();
    for (const asset of expired)
      if (asset.status !== "pending" && asset.status !== "uncertain") {
        await assets.remove(ownerId, current.generation, asset.id);
        physicallyRemoved.add(asset.id);
      }
    for (const marker of current.cleanupObjects)
      if (marker.status === "settled") {
        await assets.remove(ownerId, current.generation, marker.id);
        physicallyRemoved.add(marker.id);
      }
    await change(ownerId, (value) => {
      if (
        !value ||
        value.generation !== current.generation ||
        value.lifecycle !== "active"
      )
        throw new ProfileError(409, "owner_generation_changed");
      const freshExpired = value.assets.filter(
        (asset) =>
          expired.some(
            (snapshot) =>
              snapshot.id === asset.id &&
              snapshot.hash === asset.hash &&
              snapshot.expiresAt === asset.expiresAt,
          ) && Date.parse(asset.expiresAt) <= now(),
      );
      const removed = new Set(freshExpired.map((asset) => asset.id));
      value.cleanupObjects = value.cleanupObjects.filter(
        (asset) => !physicallyRemoved.has(asset.id),
      );
      for (const asset of freshExpired)
        if (!physicallyRemoved.has(asset.id))
          value.cleanupObjects.push({
            id: asset.id,
            status:
              asset.status === "pending" || asset.status === "uncertain"
                ? "uncertain"
                : "settled",
          });
      value.assets = value.assets.filter((asset) => !removed.has(asset.id));
      for (const asset of value.assets)
        if (
          asset.status === "pending" &&
          Date.parse(asset.pendingUntil) <= now()
        )
          asset.status = "uncertain";
      value.drafts = value.drafts.filter(
        (draft) =>
          Date.parse(draft.expiresAt) > now() && !removed.has(draft.assetId),
      );
      if (value.applications)
        value.applications = retainedApplications(value, now());
      value.versions = value.versions.filter(
        (version) => Date.parse(version.expiresAt) > now(),
      );
      if (
        !value.versions.some((version) => version.id === value.activeVersionId)
      )
        value.activeVersionId = null;
      value.evaluations = value.evaluations.filter(
        (evaluation) => Date.parse(evaluation.expiresAt) > now(),
      );
      if (
        !value.assets.length &&
        !value.versions.length &&
        !value.applications?.length
      )
        value.lifecycle = value.cleanupObjects.length ? "deleting" : "deleted";
      return touch(value, now());
    });
  };
  return {
    ...createApplicationOperations({ checked, change, newState, touch, now }),
    view,
    upload,
    edit,
    approve,
    evaluate,
    exportOwner,
    deleteOwner,
    cleanup,
    requireActive: async (ownerId: string) => {
      const state = await checked(ownerId);
      if (state) live(state, now());
    },
  };
}
export type ProfileService = ReturnType<typeof createProfileService>;
