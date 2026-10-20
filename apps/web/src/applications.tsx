import type { DiscoveryJob } from "@job-search/discovery/schemas";
import type { User } from "firebase/auth";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  type ApplicationContent,
  type ApplicationView,
  applicationContentSchema,
  applicationsResponseSchema,
} from "../../../packages/server/dist/application-schema.js";
import type { ProfileView } from "../../../packages/server/dist/profile-schema.js";
import { safeLink } from "./links.mjs";

async function request(
  user: User,
  path: string,
  method = "GET",
  body?: unknown,
) {
  const token = await user.getIdToken();
  const response = await fetch(path, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const value: unknown = await response.json();
  if (!response.ok) {
    const code =
      typeof value === "object" &&
      value !== null &&
      "error" in value &&
      typeof value.error === "string"
        ? value.error.replaceAll("_", " ")
        : "Application data unavailable";
    throw new Error(
      `${response.status === 401 ? "Session expired. Sign out and sign in again. " : ""}${code}`,
    );
  }
  return value;
}

function EvidenceTree({ value }: { value: unknown }) {
  if (value === null || value === undefined) return <span>Unknown</span>;
  if (Array.isArray(value))
    return value.length ? (
      <ul>
        {value.map((item) => (
          <li key={JSON.stringify(item)}>
            <EvidenceTree value={item} />
          </li>
        ))}
      </ul>
    ) : (
      <span>None recorded</span>
    );
  if (typeof value === "object")
    return (
      <dl className="version-links">
        {Object.entries(value).map(([key, item]) => (
          <div key={key}>
            <dt>{key.replace(/([A-Z])/g, " $1").replaceAll("_", " ")}</dt>
            <dd>
              <EvidenceTree value={item} />
            </dd>
          </div>
        ))}
      </dl>
    );
  return <span>{String(value)}</span>;
}

export function ApplicationDialog({
  user,
  job,
  profile,
  onClose,
}: {
  user: User;
  job: DiscoveryJob;
  profile: ProfileView;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const alive = useRef(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [applications, setApplications] = useState<ApplicationView[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [reviewedBinding, setReviewed] = useState<string | null>(null);
  const [edits, setEdits] = useState<Record<string, ApplicationContent>>({});
  const sequence = useRef(0);
  const application = applications.find((item) => item.jobId === job.jobId);
  const selected =
    application?.packages.find((item) => item.id === selectedId) ??
    application?.packages.find(
      (item) => item.id === application.currentPackageId,
    );
  const reviewBinding = selected
    ? JSON.stringify([selected.id, selected.contentHash])
    : "";
  const reviewed = !!reviewBinding && reviewedBinding === reviewBinding;
  const localStale =
    selected &&
    (selected.profileVersionId !== profile.activeVersionId ||
      selected.jobRevisionId !== job.currentRevisionId ||
      Date.parse(selected.expiresAt) <= Date.now());
  const dirty = selected ? edits[selected.id] !== undefined : false;
  const copyBinding = JSON.stringify([
    profile.activeVersionId,
    profile.lifecycle,
    job.currentRevisionId,
    selected?.id,
    selected?.contentHash,
    dirty,
  ]);
  const currentBinding = useRef(copyBinding);
  currentBinding.current = copyBinding;
  const accept = useCallback((value: unknown) => {
    const parsed = applicationsResponseSchema.parse(value);
    if (alive.current) setApplications(parsed.applications);
  }, []);
  const refresh = useCallback(async () => {
    const current = ++sequence.current;
    const value = await request(user, "/api/applications");
    if (current === sequence.current) accept(value);
  }, [user, accept]);
  // Reuse an uncertain operation only for the exact same request, including its base version.
  const operations = useRef(new Map<string, string>());
  const mutate = async (
    path: string,
    body: Record<string, unknown>,
    method = "POST",
  ) => {
    const key = JSON.stringify([path, method, body]);
    const operationId = operations.current.get(key) ?? crypto.randomUUID();
    operations.current.set(key, operationId);
    const value = await request(user, path, method, { ...body, operationId });
    operations.current.delete(key);
    return value;
  };
  const run = useCallback(async (operation: () => Promise<void>) => {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await operation();
    } catch (cause: unknown) {
      if (alive.current)
        setError(
          cause instanceof Error
            ? cause.message
            : "Application operation failed",
        );
    } finally {
      if (alive.current) setBusy(false);
    }
  }, []);
  useEffect(() => {
    alive.current = true;
    const trigger = document.activeElement;
    dialog.current?.showModal();
    return () => {
      alive.current = false;
      if (trigger instanceof HTMLElement && trigger.isConnected)
        trigger.focus();
    };
  }, []);
  useEffect(() => {
    setReviewed(null);
    if (profile.lifecycle === "active" || profile.lifecycle === "empty")
      void run(refresh);
  }, [profile, refresh, run]);
  return (
    <dialog
      ref={dialog}
      className="application-dialog"
      aria-labelledby="application-title"
      onClose={onClose}
    >
      <header>
        <div>
          <h2 id="application-title">Application draft</h2>
          <p>{job.observation.title?.value ?? "Untitled discovery"}</p>
        </div>
        <button
          type="button"
          className="secondary"
          onClick={() => dialog.current?.close()}
        >
          Close application draft
        </button>
      </header>
      <p>
        The applicant alone copies text, attaches files, and sends or submits.
        Manual applied status is your report and proves no delivery or
        submission.
      </p>
      {!profile.activeVersionId && (
        <p>
          Approve an immutable profile version before generating an application
          draft.
        </p>
      )}
      <div className="application-actions">
        <button
          type="button"
          disabled={busy || !profile.activeVersionId}
          onClick={() =>
            void run(async () => {
              const value = await mutate("/api/applications/generate", {
                jobId: job.jobId,
                expectedJobRevisionId: job.currentRevisionId,
                expectedActiveVersionId: profile.activeVersionId,
                expectedCurrentPackageId: application?.currentPackageId ?? null,
              });
              accept(value);
              setSelectedId("");
              setReviewed(null);
            })
          }
        >
          {application?.currentPackageId
            ? "Regenerate new version"
            : "Generate application draft"}
        </button>
        <button
          type="button"
          className="secondary"
          disabled={busy}
          onClick={() => void run(refresh)}
        >
          Refresh application
        </button>
      </div>
      <label>
        Manual application status
        <select
          value={application?.manualStatus ?? "not_applied"}
          disabled={busy}
          onChange={(event) => {
            const status = event.target.value;
            void run(async () =>
              accept(
                await mutate(
                  "/api/applications/status",
                  {
                    ...(application
                      ? {
                          applicationId: application.id,
                          expectedRevision: application.revision,
                        }
                      : { jobId: job.jobId, expectedRevision: 0 }),
                    status,
                  },
                  "PATCH",
                ),
              ),
            );
          }}
        >
          <option value="not_applied">Not applied</option>
          <option value="applied">Applied · reported by applicant</option>
          <option value="ignored">Ignored</option>
        </select>
      </label>
      {application && (
        <label>
          Package version
          <select
            value={selected?.id ?? ""}
            disabled={busy}
            onChange={(event) => {
              setSelectedId(event.target.value);
              setReviewed(null);
              setMessage("");
            }}
          >
            {application.packages.map((item, index) => (
              <option key={item.id} value={item.id}>
                Version {index + 1} ·{" "}
                {item.origin === "generated" ? "Generated" : "Your edits"} ·{" "}
                {item.createdAt}
              </option>
            ))}
          </select>
        </label>
      )}
      {selected && (
        <section aria-label="Exact application package">
          <p data-testid="package-readiness">
            {localStale ? "stale" : selected.readiness.status}
          </p>
          <p>{selected.readiness.reasons.join(" · ")}</p>
          {selected.origin === "applicant_edit" && (
            <p>
              Applicant edits are unverified. Reviewing them does not establish
              grounded claims or make them ready.
            </p>
          )}
          <p>Expires: {selected.expiresAt}</p>
          {selected.source.kind === "email" ? (
            <p>
              Source-verified recipient: {selected.source.recipient} · manual
              copying
            </p>
          ) : safeLink(selected.source.url) ? (
            <a
              href={safeLink(selected.source.url) ?? undefined}
              target="_blank"
              rel="noopener noreferrer"
            >
              Original questionnaire ↗
            </a>
          ) : (
            <p>Original questionnaire link unavailable</p>
          )}
          {(selected.content.kind === "email"
            ? [
                {
                  id: "subject",
                  label: "Email subject",
                  text: selected.content.subject,
                  status: "answered",
                },
                {
                  id: "body",
                  label: "Email body",
                  text: selected.content.body,
                  status: "answered",
                },
              ]
            : selected.content.fields.map((field) => ({
                id: field.internalId,
                label: field.prompt,
                text: field.answer ?? "",
                status: field.status,
              }))
          ).map((field) => (
            <div className="application-field" key={field.id}>
              <h3>{field.label}</h3>
              <p>
                Internal field ID: {field.id} · {field.status}
              </p>
              <pre data-testid={`answer-${field.id}`}>{field.text}</pre>
              <button
                type="button"
                disabled={
                  busy ||
                  dirty ||
                  !!localStale ||
                  !selected.readiness.copyableFieldIds.includes(field.id) ||
                  field.status !== "answered"
                }
                onClick={() =>
                  void run(async () => {
                    const result = await request(
                      user,
                      "/api/applications/copy",
                      "POST",
                      {
                        applicationId: application?.id,
                        packageId: selected.id,
                        expectedContentHash: selected.contentHash,
                        fieldId: field.id,
                      },
                    );
                    if (
                      typeof result !== "object" ||
                      result === null ||
                      !("text" in result) ||
                      typeof result.text !== "string" ||
                      result.text !== field.text ||
                      !("packageId" in result) ||
                      result.packageId !== selected.id ||
                      !("contentHash" in result) ||
                      result.contentHash !== selected.contentHash ||
                      !("fieldId" in result) ||
                      result.fieldId !== field.id
                    )
                      throw new Error("Invalid authorized copy response");
                    if (
                      !alive.current ||
                      currentBinding.current !== copyBinding
                    )
                      return;
                    if (
                      profile.lifecycle !== "active" ||
                      Date.parse(selected.expiresAt) <= Date.now() ||
                      Date.parse(selected.source.review.expiresAt) <= Date.now()
                    )
                      throw new Error(
                        "This package expired. Refresh the application before copying.",
                      );
                    try {
                      await navigator.clipboard.writeText(result.text);
                    } catch {
                      throw new Error(
                        "Clipboard permission unavailable. Allow clipboard access and retry the copy button.",
                      );
                    }
                    if (alive.current)
                      setMessage(
                        `Copied ${field.id}. You alone send or submit.`,
                      );
                  })
                }
              >
                Copy {field.id}
              </button>
            </div>
          ))}
          <h3>Source evidence and version links</h3>
          <p>Internal field IDs do not claim to be employer form IDs.</p>
          <blockquote>{selected.source.evidence.quote}</blockquote>
          <p>
            Source:{" "}
            <a
              href={safeLink(selected.source.sourceUrl) ?? undefined}
              target="_blank"
              rel="noopener noreferrer"
            >
              {selected.source.sourceUrl}
            </a>
            <br />
            Locator: {selected.source.evidence.selector}
            <br />
            Source review: {selected.source.review.method.replaceAll("_", " ")}{" "}
            · {selected.source.review.reviewedAt}
            <br />
            Source review expires: {selected.source.review.expiresAt}
          </p>
          {selected.source.kind === "questionnaire" &&
            selected.source.fields.map((field) => (
              <div className="application-field" key={field.internalId}>
                <strong>{field.prompt}</strong>
                <p>
                  Internal ID: {field.internalId} ·{" "}
                  {field.required ? "Required" : "Optional"} ·{" "}
                  {field.answerKind.replaceAll("_", " ")}
                </p>
                <blockquote>{field.evidence.quote}</blockquote>
                <p>
                  Evidence: {field.evidence.url} · {field.evidence.selector}
                </p>
                <p>
                  Approved fact references:{" "}
                  {selected.content.kind === "questionnaire"
                    ? selected.content.fields
                        .find((item) => item.internalId === field.internalId)
                        ?.factIds.join(", ") ||
                      "None; no candidate claim established"
                    : "None"}
                </p>
              </div>
            ))}
          <details>
            <summary>Version and evidence links</summary>
            <dl className="version-links">
              <dt>Package ID</dt>
              <dd>{selected.id}</dd>
              <dt>Content hash</dt>
              <dd>{selected.contentHash}</dd>
              <dt>Job</dt>
              <dd>
                {selected.jobTitle} · {selected.employer} · {selected.jobId}
              </dd>
              <dt>Job revision</dt>
              <dd>{selected.jobRevisionId}</dd>
              <dt>Profile version / hash</dt>
              <dd>
                {selected.profileVersionId} / {selected.profileHash}
              </dd>
              <dt>Evaluation / evaluator</dt>
              <dd>
                {selected.evaluationId} / {selected.evaluatorVersion}
              </dd>
              <dt>Source contract hash</dt>
              <dd>{selected.sourceSpecHash}</dd>
              <dt>Renderer</dt>
              <dd>{selected.rendererVersion}</dd>
              <dt>Origin / parent version</dt>
              <dd>
                {selected.origin} /{" "}
                {selected.basePackageId ?? "Original generated version"}
              </dd>
              <dt>Created</dt>
              <dd>{selected.createdAt}</dd>
              <dt>Exact review</dt>
              <dd>
                {selected.review
                  ? `${selected.review.contentHash} · ${selected.review.reviewedAt}`
                  : "Not reviewed"}
              </dd>
            </dl>
          </details>
          <h3>Job evidence at generation</h3>
          <EvidenceTree value={selected.jobSnapshot.observation} />
          <h3>Approved fact evidence</h3>
          {(() => {
            const version = profile.versions.find(
              (item) => item.id === selected.profileVersionId,
            );
            return version ? (
              version.facts.map((fact) => (
                <div className="application-field" key={fact.id}>
                  <strong>
                    {fact.category.replaceAll("_", " ")}: {fact.value}
                  </strong>
                  <p>
                    Fact ID: {fact.id} ·{" "}
                    {selected.factIds.includes(fact.id)
                      ? "Referenced by this package"
                      : "Approved profile context"}
                  </p>
                  {fact.provenance.kind === "pdf_quote" ? (
                    <blockquote>
                      PDF page {fact.provenance.page}: {fact.provenance.quote}
                    </blockquote>
                  ) : (
                    <>
                      <blockquote>
                        Applicant attestation: {fact.provenance.statement}
                      </blockquote>
                      {fact.provenance.priorSource && (
                        <p>
                          Prior PDF page {fact.provenance.priorSource.page}:{" "}
                          {fact.provenance.priorSource.quote}
                        </p>
                      )}
                    </>
                  )}
                </div>
              ))
            ) : (
              <p>Historical approved facts unavailable. Refresh before use.</p>
            );
          })()}
          <label className="check">
            <input
              type="checkbox"
              checked={reviewed}
              disabled={busy || dirty || !!localStale}
              onChange={(event) =>
                setReviewed(event.target.checked ? reviewBinding : null)
              }
            />
            I reviewed this exact full package, evidence, answers and version
            links.
          </label>
          <button
            type="button"
            disabled={busy || dirty || !!localStale || !reviewed}
            onClick={() =>
              void run(async () => {
                accept(
                  await mutate("/api/applications/review", {
                    applicationId: application?.id,
                    packageId: selected.id,
                    expectedContentHash: selected.contentHash,
                    confirmReviewed: true,
                  }),
                );
                setReviewed(null);
                setMessage("Review recorded for this exact content hash.");
              })
            }
          >
            Review exact package
          </button>
          <details>
            <summary>Edit into a new immutable version</summary>
            <p>
              Edits create an unverified version and preserve the original.
              Missing answers, consents, signatures and declarations stay
              unanswered.
            </p>
            {(() => {
              const content = edits[selected.id] ?? selected.content;
              const update = (next: ApplicationContent) => {
                setEdits({ ...edits, [selected.id]: next });
                setReviewed(null);
              };
              return content.kind === "email" ? (
                <>
                  <label>
                    Edited email subject
                    <textarea
                      aria-label="Edited email subject"
                      rows={2}
                      disabled={busy}
                      maxLength={1000}
                      value={content.subject}
                      onChange={(event) =>
                        update({ ...content, subject: event.target.value })
                      }
                    />
                  </label>
                  <label>
                    Edited email body
                    <textarea
                      aria-label="Edited email body"
                      rows={10}
                      disabled={busy}
                      maxLength={12000}
                      value={content.body}
                      onChange={(event) =>
                        update({ ...content, body: event.target.value })
                      }
                    />
                  </label>
                </>
              ) : (
                content.fields.map((field) => (
                  <label key={field.internalId}>
                    Edited answer: {field.prompt}
                    <textarea
                      aria-label={`Edited answer: ${field.prompt}`}
                      rows={3}
                      maxLength={6000}
                      disabled={busy || field.status !== "answered"}
                      value={field.answer ?? ""}
                      onChange={(event) =>
                        update({
                          ...content,
                          fields: content.fields.map((item) =>
                            item.internalId === field.internalId
                              ? { ...item, answer: event.target.value }
                              : item,
                          ),
                        })
                      }
                    />
                  </label>
                ))
              );
            })()}
            <button
              type="button"
              disabled={busy || !dirty}
              onClick={() =>
                void run(async () => {
                  const content = applicationContentSchema.parse(
                    edits[selected.id],
                  );
                  accept(
                    await mutate("/api/applications/edit", {
                      applicationId: application?.id,
                      basePackageId: selected.id,
                      expectedRevision: application?.revision,
                      content,
                    }),
                  );
                  setEdits((previous) => {
                    const next = { ...previous };
                    delete next[selected.id];
                    return next;
                  });
                  setSelectedId("");
                  setReviewed(null);
                })
              }
            >
              Save edited version
            </button>
          </details>
        </section>
      )}
      {busy && <p role="status">Updating your private application…</p>}
      {message && <p role="status">{message}</p>}
      {error && (
        <p role="alert" className="error">
          {error} Your unsaved edits remain available.
        </p>
      )}
    </dialog>
  );
}
