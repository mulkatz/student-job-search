import type { User } from "firebase/auth";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  factCategorySchema,
  type ProfileDraft,
  type ProfileFact,
  type ProfileView,
  profileViewSchema,
} from "../../../packages/server/dist/profile-schema.js";

type EditFact = Pick<ProfileFact, "id" | "category" | "value">;
export function ProfilePanel({
  user,
  onChange,
}: {
  user: User;
  onChange: (profile: ProfileView) => void;
}) {
  const [profile, setProfile] = useState<ProfileView | null>(null);
  const [selected, setSelected] = useState<File | null>(null);
  const [synthetic, setSynthetic] = useState(false);
  const [facts, setFacts] = useState<EditFact[]>([]);
  const [attestation, setAttestation] = useState("");
  const [approval, setApproval] = useState(false);
  const [deletion, setDeletion] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const uploadId = useRef(crypto.randomUUID());
  const approvalRequest = useRef<unknown>(null);
  const changeCallback = useRef(onChange);
  changeCallback.current = onChange;
  const draft = profile?.drafts.at(-1);
  const active = profile?.versions.find(
    (version) => version.id === profile.activeVersionId,
  );
  const accept = useCallback((value: unknown) => {
    const parsed = profileViewSchema.parse(value);
    setProfile(parsed);
    changeCallback.current(parsed);
    const current = parsed.drafts.at(-1);
    setFacts(
      current?.facts.map(({ id, category, value }) => ({
        id,
        category,
        value,
      })) ?? [],
    );
    setDirty(false);
    setAttestation("");
    setApproval(false);
  }, []);
  const request = async (path: string, init: RequestInit = {}) => {
    const token = await user.getIdToken();
    const response = await fetch(path, {
      ...init,
      headers: { ...init.headers, Authorization: `Bearer ${token}` },
    });
    if (!response.ok) {
      const value: unknown = await response.json();
      const code =
        typeof value === "object" &&
        value !== null &&
        "error" in value &&
        typeof value.error === "string"
          ? value.error.replaceAll("_", " ")
          : "Private data unavailable";
      throw new Error(
        `${response.status === 401 ? "Session expired. Sign out and sign in again. " : ""}${code}`,
      );
    }
    return response;
  };
  const refresh = async () => {
    const value: unknown = await (await request("/api/profile")).json();
    if (typeof value !== "object" || value === null || !("profile" in value))
      throw new Error("Invalid private profile response");
    accept(value.profile);
  };
  useEffect(() => {
    let active = true;
    (async () => {
      const token = await user.getIdToken();
      const response = await fetch("/api/profile", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok)
        throw new Error("Private profile unavailable. Sign out and retry.");
      const value: unknown = await response.json();
      if (typeof value !== "object" || value === null || !("profile" in value))
        throw new Error("Invalid private profile response");
      if (active) accept(value.profile);
    })().catch(() => {
      if (active) setError("Private profile unavailable. Sign out and retry.");
    });
    return () => {
      active = false;
    };
  }, [user, accept]);
  const run = async (operation: () => Promise<void>) => {
    setBusy(true);
    setError("");
    try {
      await operation();
    } catch (cause: unknown) {
      setError(
        cause instanceof Error ? cause.message : "Private operation failed",
      );
    } finally {
      setBusy(false);
    }
  };
  const updateFact = (id: string, update: Partial<EditFact>) => {
    setFacts((previous) =>
      previous.map((fact) => (fact.id === id ? { ...fact, ...update } : fact)),
    );
    setDirty(true);
    setApproval(false);
    approvalRequest.current = null;
  };
  const json = (value: unknown): RequestInit => ({
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(value),
  });
  const save = async (current: ProfileDraft) => {
    await request("/api/profile/draft", {
      method: "PATCH",
      ...json({
        draftId: current.id,
        expectedRevision: current.revision,
        facts: facts.map((fact) => {
          const original = current.facts.find((entry) => entry.id === fact.id);
          return {
            ...fact,
            ...(!original ||
            original.value !== fact.value ||
            original.category !== fact.category
              ? { attestation }
              : {}),
          };
        }),
      }),
    });
    approvalRequest.current = null;
    await refresh();
  };
  if (profile?.lifecycle === "deleted" || profile?.lifecycle === "deleting")
    return (
      <section className="profile-panel">
        <h2>Private profile</h2>
        <p role="status">
          {profile.lifecycle === "deleted"
            ? "Local profile deletion complete. Sign out to end this session."
            : "Local deletion is in progress. Private reads are blocked; retry deletion to finish cleanup."}
        </p>
        {profile.lifecycle === "deleting" && (
          <button
            type="button"
            onClick={() =>
              void run(async () => {
                await request("/api/profile", { method: "DELETE" });
                await refresh();
              })
            }
          >
            Retry deletion
          </button>
        )}
      </section>
    );
  return (
    <section className="profile-panel" aria-label="Private synthetic profile">
      <h2>Your private profile</h2>
      <p>
        Local synthetic testing only. Upload text is a draft until you review
        and approve it. Approved facts stay private and expire after 90 days;
        original PDFs and drafts expire after 7 days.
      </p>
      <label className="check">
        <input
          type="checkbox"
          checked={synthetic}
          onChange={(event) => setSynthetic(event.target.checked)}
          disabled={busy}
        />
        This PDF contains synthetic test facts, with a SYNTHETIC label.
      </label>
      <label>
        Synthetic PDF (maximum 2 MiB, 10 pages)
        <input
          type="file"
          accept="application/pdf,.pdf"
          disabled={busy}
          onChange={(event) => {
            setSelected(event.target.files?.[0] ?? null);
            uploadId.current = crypto.randomUUID();
          }}
        />
      </label>
      <button
        type="button"
        disabled={busy || !selected || !synthetic}
        onClick={() =>
          void run(async () => {
            if (!selected) return;
            await request("/api/profile/upload", {
              method: "POST",
              headers: {
                "Content-Type": "application/pdf",
                "X-Operation-Id": uploadId.current,
              },
              body: selected,
            });
            await refresh();
          })
        }
      >
        Upload synthetic PDF
      </button>
      {draft && (
        <div className="profile-draft">
          <h3>Review extracted draft</h3>
          <p>
            Extraction: {draft.outcome.replaceAll("_", " ")} · draft revision{" "}
            {draft.revision}
          </p>
          <details>
            <summary>Extracted page text</summary>
            {draft.pages.map((page) => (
              <div key={page.page}>
                <strong>Page {page.page}</strong>
                <pre>
                  {page.text ||
                    "No extractable text. OCR is unavailable; attest corrections explicitly."}
                </pre>
              </div>
            ))}
          </details>
          {["text_extracted", "needs_review"].includes(draft.outcome) && (
            <>
              {facts.map((fact, index) => {
                const source = draft.facts.find(
                  (entry) => entry.id === fact.id,
                )?.provenance;
                return (
                  <div className="profile-fact" key={fact.id}>
                    <label>
                      Fact {index + 1} category
                      <select
                        disabled={busy}
                        value={fact.category}
                        onChange={(event) =>
                          updateFact(fact.id, {
                            category: factCategorySchema.parse(
                              event.target.value,
                            ),
                          })
                        }
                      >
                        {factCategorySchema.options.map((category) => (
                          <option key={category} value={category}>
                            {category.replaceAll("_", " ")}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Fact {index + 1} value
                      <input
                        disabled={busy}
                        maxLength={300}
                        value={fact.value}
                        onChange={(event) =>
                          updateFact(fact.id, { value: event.target.value })
                        }
                      />
                    </label>
                    {fact.category === "working_language" && (
                      <small>
                        Declare each language explicitly, such as English,
                        German B2, Russian fluent, or German not spoken. Missing
                        proficiency stays unknown; fluent and CEFR levels are
                        not interchangeable.
                      </small>
                    )}
                    {fact.category === "location_preference" && (
                      <small>
                        Include city and country, such as Leipzig, Germany, or
                        Remote from Germany. On-site and hybrid preferences can
                        be explicit. Unsupported wording remains unknown.
                      </small>
                    )}
                    {fact.category === "weekly_availability_hours" && (
                      <small>
                        Use a numeric number of available hours, such as 16 or
                        15.5. This is your declared availability, not a legal
                        working-time limit.
                      </small>
                    )}
                    {fact.category === "work_authorization" && (
                      <small>
                        The supported self-declarations are
                        employee_work_in_germany and
                        not_permitted_employee_work_in_germany. Other wording
                        remains unknown. Your approval does not verify legal
                        status.
                      </small>
                    )}
                    {source?.kind === "pdf_quote" ? (
                      <small>
                        PDF page {source.page}: {source.quote}
                      </small>
                    ) : source?.kind === "user_attestation" ? (
                      <small>User attestation: {source.statement}</small>
                    ) : (
                      <small>New fact requires your attestation.</small>
                    )}
                    <button
                      type="button"
                      className="secondary"
                      disabled={busy}
                      onClick={() => {
                        setFacts(facts.filter((entry) => entry.id !== fact.id));
                        setDirty(true);
                        setApproval(false);
                      }}
                    >
                      Remove fact {index + 1}
                    </button>
                  </div>
                );
              })}
              <button
                type="button"
                className="secondary"
                disabled={busy || facts.length >= 20}
                onClick={() => {
                  setFacts([
                    ...facts,
                    { id: crypto.randomUUID(), category: "other", value: "" },
                  ]);
                  setDirty(true);
                  setApproval(false);
                }}
              >
                Add attested fact
              </button>
              <label>
                Correction explanation
                <textarea
                  disabled={busy}
                  maxLength={1000}
                  value={attestation}
                  onChange={(event) => setAttestation(event.target.value)}
                  placeholder="Explain corrections or new facts in your own words."
                />
              </label>
              <button
                type="button"
                disabled={busy || !dirty || !facts.length}
                onClick={() => void run(() => save(draft))}
              >
                Save corrected draft
              </button>
              <label className="check">
                <input
                  type="checkbox"
                  checked={approval}
                  disabled={busy || dirty || !facts.length}
                  onChange={(event) => setApproval(event.target.checked)}
                />
                I reviewed these synthetic facts and explicitly approve a new
                immutable profile version.
              </label>
              <button
                type="button"
                disabled={busy || dirty || !approval}
                onClick={() =>
                  void run(async () => {
                    approvalRequest.current ??= {
                      draftId: draft.id,
                      expectedRevision: draft.revision,
                      expectedActiveVersionId: profile?.activeVersionId ?? null,
                      operationId: crypto.randomUUID(),
                      confirmFacts: true,
                    };
                    await request("/api/profile/approve", {
                      method: "POST",
                      ...json(approvalRequest.current),
                    });
                    approvalRequest.current = null;
                    await refresh();
                  })
                }
              >
                Approve profile version
              </button>
            </>
          )}
        </div>
      )}
      {active && (
        <div className="profile-approved">
          <h3>Approved profile version</h3>
          <p data-testid="active-profile-version">{active.id}</p>
          <p>
            {active.facts.length} approved facts · expires {active.expiresAt}
          </p>
          <button
            type="button"
            disabled={busy}
            onClick={() =>
              void run(async () => {
                await request("/api/profile/evaluate", {
                  method: "POST",
                  ...json({ expectedActiveVersionId: active.id }),
                });
                await refresh();
              })
            }
          >
            Match discoveries
          </button>
          <p>
            Fit measures approved-skill overlap with the evidenced title.
            Evidence confidence measures supported conditions; neither is a
            hiring probability or legal determination. Independent agent review
            accepted the 50-case synthetic benchmark (49 distinct jobs). Human
            review was not performed. Real-market results and full release
            readiness remain unestablished.
          </p>
        </div>
      )}
      {profile?.lifecycle === "active" && (
        <div className="profile-controls">
          <button
            type="button"
            className="secondary"
            disabled={busy}
            onClick={() =>
              void run(async () => {
                const response = await request("/api/profile/export");
                const blob = await response.blob();
                const url = URL.createObjectURL(blob);
                const link = document.createElement("a");
                link.href = url;
                link.download = "synthetic-owner-export.json";
                link.click();
                setTimeout(() => URL.revokeObjectURL(url), 1000);
              })
            }
          >
            Export my local data
          </button>
          <label className="check">
            <input
              type="checkbox"
              checked={deletion}
              disabled={busy}
              onChange={(event) => setDeletion(event.target.checked)}
            />
            Delete my local PDFs, drafts, profile history and evaluations.
          </label>
          <button
            type="button"
            className="secondary"
            disabled={busy || !deletion}
            onClick={() =>
              void run(async () => {
                await request("/api/profile", { method: "DELETE" });
                await refresh();
              })
            }
          >
            Delete my local data
          </button>
        </div>
      )}
      {busy && <p role="status">Updating your private local data…</p>}
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
    </section>
  );
}
