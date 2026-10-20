import type { DiscoveryJob } from "@job-search/discovery/schemas";
import type { User } from "firebase/auth";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  type ApplicationView,
  applicationsResponseSchema,
} from "../../../packages/server/dist/application-schema.js";
import type { ProfileView } from "../../../packages/server/dist/profile-schema.js";
import { safeLink } from "./links.mjs";

type Evaluation = ProfileView["evaluations"][number];
type ManualStatus = ApplicationView["manualStatus"];

function hours(job: DiscoveryJob) {
  const observation = job.observation;
  const format = (minimum: number, maximum: number) =>
    minimum === maximum ? `${minimum} h` : `${minimum}–${maximum} h`;
  if (observation.employmentOptions?.status === "complete")
    return [
      ...new Set(
        observation.employmentOptions.options.map((option) =>
          format(option.weeklyHours.minimum, option.weeklyHours.maximum),
        ),
      ),
    ].join(" / ");
  if (observation.employmentOptions?.status === "conflicting")
    return "Conflicting";
  return observation.weeklyHours?.status === "confirmed"
    ? format(observation.weeklyHours.minimum, observation.weeklyHours.maximum)
    : "Unknown";
}
function arrangement(job: DiscoveryJob) {
  const arrangements = job.observation.workArrangements;
  if (arrangements?.status === "complete")
    return arrangements.arrangements
      .map((item) =>
        item.mode === "remote"
          ? `Remote · ${item.allowedCountries.join(", ") || "country unknown"}`
          : `${item.mode === "on_site" ? "On-site" : item.mode.replaceAll("_", " ")} · ${item.city}`,
      )
      .join(" / ");
  if (arrangements?.status === "conflicting") return "Conflicting";
  if (
    job.observation.remoteFromGermany?.status === "confirmed" &&
    job.observation.remoteFromGermany.value
  )
    return "Remote · Germany";
  return job.observation.location?.value
    ? `${job.observation.location.value} · mode unknown`
    : "Unknown";
}
function Fit({ evaluation }: { evaluation: Evaluation | undefined }) {
  const id = useId();
  const trigger = useRef<HTMLButtonElement>(null);
  const tooltip = useRef<HTMLDivElement>(null);
  const closeTimer = useRef<number | undefined>(undefined);
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const show = () => {
    window.clearTimeout(closeTimer.current);
    const rect = trigger.current?.getBoundingClientRect();
    if (rect) {
      setPosition({
        top:
          window.innerHeight - rect.bottom < 240
            ? Math.max(8, rect.top - 348)
            : rect.bottom + 8,
        left: Math.max(8, Math.min(rect.right - 330, window.innerWidth - 338)),
      });
      setOpen(true);
    }
  };
  return (
    <div className="fit-cell">
      <button
        onMouseEnter={show}
        onMouseLeave={() => {
          if (document.activeElement !== trigger.current)
            closeTimer.current = window.setTimeout(() => setOpen(false), 120);
        }}
        ref={trigger}
        type="button"
        className="fit-trigger"
        aria-expanded={open}
        aria-describedby={open ? id : undefined}
        onFocus={show}
        onBlur={() => setOpen(false)}
        onClick={show}
        onKeyDown={(event) => {
          if (event.key === "Escape") setOpen(false);
          if (
            ["ArrowDown", "ArrowUp", "PageDown", "PageUp"].includes(event.key)
          ) {
            event.preventDefault();
            tooltip.current?.scrollBy({
              top:
                (event.key.endsWith("Down") ? 1 : -1) *
                (event.key.startsWith("Page") ? 160 : 36),
            });
          }
        }}
      >
        {evaluation?.stale
          ? "Stale"
          : evaluation?.fitScore === null || !evaluation
            ? "Unavailable"
            : `${evaluation.fitScore}%`}
        <span className="fit-info" aria-hidden="true">
          ⓘ
        </span>
      </button>
      {open &&
        createPortal(
          <div
            ref={tooltip}
            id={id}
            className="fit-tooltip"
            role="tooltip"
            style={{
              top: position.top,
              left: position.left,
              maxHeight: Math.max(120, window.innerHeight - position.top - 12),
            }}
            onMouseEnter={() => {
              window.clearTimeout(closeTimer.current);
              setOpen(true);
            }}
            onMouseLeave={() => {
              if (document.activeElement !== trigger.current)
                closeTimer.current = window.setTimeout(
                  () => setOpen(false),
                  120,
                );
            }}
          >
            <strong>
              {evaluation?.stale
                ? "Previous assessment · refresh matching"
                : "Fit assessment"}
            </strong>
            <p>
              Fit is not a hiring probability. Evidence confidence and
              eligibility are separate.
            </p>
            {evaluation ? (
              <>
                <p>
                  Eligibility: {evaluation.eligibility.replaceAll("_", " ")}
                  <br />
                  Evidence confidence:{" "}
                  {Math.round(evaluation.evidenceConfidence * 100)}%
                </p>
                <ul>
                  {evaluation.reasons.map((reason) => (
                    <li key={`${reason.code}-${reason.jobField}`}>
                      {reason.code.replaceAll("_", " ")} · {reason.outcome}
                      {reason.quote ? `: “${reason.quote}”` : ""}
                    </li>
                  ))}
                </ul>
                <p>
                  These recorded reasons do not assign individual percentage
                  contributions. Previous experience is assessed only where
                  supported by approved facts.
                </p>
              </>
            ) : (
              <p>
                Approve a profile and match discoveries to see an assessment.
                Language and previous experience have not been assessed.
              </p>
            )}
          </div>,
          document.body,
        )}
    </div>
  );
}

export function JobsTable({
  user,
  jobs,
  evaluationFor,
  draftEnabled,
  onDraft,
  details,
}: {
  user: User;
  jobs: DiscoveryJob[];
  evaluationFor: (job: DiscoveryJob) => Evaluation | undefined;
  draftEnabled: boolean;
  onDraft: (job: DiscoveryJob) => void;
  details: (job: DiscoveryJob) => React.ReactNode;
}) {
  const [applications, setApplications] = useState<ApplicationView[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const alive = useRef(true);
  const operations = useRef(new Map<string, string>());
  const request = useCallback(
    async (path: string, body?: unknown) => {
      const token = await user.getIdToken();
      const response = await fetch(path, {
        method: body ? "PATCH" : "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          ...(body ? { "Content-Type": "application/json" } : {}),
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
      if (!response.ok)
        throw new Error(
          response.status === 401
            ? "Your session expired. Sign out and sign in again."
            : "Application status could not be updated. Refresh status and try again.",
        );
      return applicationsResponseSchema.parse(await response.json())
        .applications;
    },
    [user],
  );
  useEffect(() => {
    alive.current = true;
    let active = true;
    setReady(false);
    void request("/api/applications")
      .then((value) => {
        if (active) {
          setApplications(value);
          setReady(true);
          setError("");
        }
      })
      .catch((cause: unknown) => {
        if (active)
          setError(
            cause instanceof Error ? cause.message : "Status unavailable",
          );
      });
    return () => {
      active = false;
      alive.current = false;
    };
  }, [request]);
  async function status(job: DiscoveryJob, next: ManualStatus) {
    if (busy) return;
    const application = applications.find((item) => item.jobId === job.jobId);
    const body = {
      ...(application
        ? {
            applicationId: application.id,
            expectedRevision: application.revision,
          }
        : { jobId: job.jobId, expectedRevision: 0 }),
      status: next,
    };
    const key = JSON.stringify(body);
    const operationId = operations.current.get(key) ?? crypto.randomUUID();
    operations.current.set(key, operationId);
    setBusy(true);
    setError("");
    try {
      const value = await request("/api/applications/status", {
        ...body,
        operationId,
      });
      operations.current.delete(key);
      if (alive.current) setApplications(value);
    } catch (cause: unknown) {
      if (alive.current)
        setError(cause instanceof Error ? cause.message : "Status unavailable");
    } finally {
      if (alive.current) setBusy(false);
    }
  }
  return (
    <>
      {error && (
        <div className="error" role="alert">
          {error}{" "}
          <button
            type="button"
            className="secondary"
            disabled={busy}
            onClick={() => {
              setBusy(true);
              void request("/api/applications")
                .then((value) => {
                  if (alive.current) {
                    setApplications(value);
                    setReady(true);
                    setError("");
                  }
                })
                .catch(() => {})
                .finally(() => {
                  if (alive.current) setBusy(false);
                });
            }}
          >
            Refresh status
          </button>
        </div>
      )}
      {/* biome-ignore lint/a11y/noNoninteractiveTabindex: Scrollable table region needs keyboard access. */}
      <section className="table-wrap" aria-label="Discovered jobs" tabIndex={0}>
        <table className="jobs-table">
          <caption className="sr-only">
            Discovered jobs, ordered by current fit score. Manual applied status
            does not confirm submission.
          </caption>
          <thead>
            <tr>
              <th scope="col">
                <span className="sr-only">Company icon</span>
              </th>
              <th scope="col">Company / role</th>
              <th scope="col">Industry</th>
              <th scope="col">Hours / week</th>
              <th scope="col">Workplace</th>
              <th scope="col">Fit</th>
              <th scope="col">Apply</th>
              <th scope="col">Draft</th>
              <th scope="col">Status</th>
            </tr>
          </thead>
          {jobs.map((job) => {
            const company =
              job.observation.employer?.value ?? "Unknown employer";
            const currentStatus =
              applications.find((item) => item.jobId === job.jobId)
                ?.manualStatus ?? "not_applied";
            const original = safeLink(job.observation.originalUrl);
            const isExpanded = expanded === job.jobId;
            return (
              <tbody
                key={job.jobId}
                className={`job-group${currentStatus === "ignored" ? " is-ignored" : ""}`}
              >
                <tr className="job-row">
                  <td>
                    <span className="company-avatar" aria-hidden="true">
                      {company
                        .split(/\s+/)
                        .slice(0, 2)
                        .map((part) => part[0])
                        .join("")
                        .toUpperCase()}
                    </span>
                  </td>
                  <td className="company-cell">
                    <strong>{company}</strong>
                    <h3>{job.observation.title?.value ?? "Unknown title"}</h3>
                    <button
                      type="button"
                      className="evidence-toggle"
                      aria-expanded={isExpanded}
                      aria-controls={`evidence-${job.jobId}`}
                      onClick={() => setExpanded(isExpanded ? null : job.jobId)}
                    >
                      Evidence & details{" "}
                      <span aria-hidden="true">{isExpanded ? "−" : "+"}</span>
                    </button>
                  </td>
                  <td className="muted">
                    <span aria-hidden="true">—</span>
                    <span className="sr-only">Industry unknown</span>
                  </td>
                  <td>{hours(job)}</td>
                  <td className="workplace-cell">{arrangement(job)}</td>
                  <td>
                    <Fit evaluation={evaluationFor(job)} />
                  </td>
                  <td>
                    {original ? (
                      <a
                        className="apply-button"
                        href={original}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label="Apply"
                      >
                        Apply <span aria-hidden="true">↗</span>
                      </a>
                    ) : (
                      <button type="button" disabled>
                        Apply
                      </button>
                    )}
                  </td>
                  <td>
                    <button
                      type="button"
                      className="secondary draft-button"
                      disabled={!draftEnabled}
                      onClick={() => onDraft(job)}
                    >
                      View Draft
                    </button>
                  </td>
                  <td>
                    <div className="status-actions">
                      <button
                        type="button"
                        className="status-button"
                        aria-pressed={currentStatus === "ignored"}
                        disabled={busy || !ready || !draftEnabled}
                        onClick={() =>
                          void status(
                            job,
                            currentStatus === "ignored"
                              ? "not_applied"
                              : "ignored",
                          )
                        }
                      >
                        Ignore
                      </button>
                      <button
                        type="button"
                        className="status-button"
                        aria-pressed={currentStatus === "applied"}
                        disabled={busy || !ready || !draftEnabled}
                        onClick={() =>
                          void status(
                            job,
                            currentStatus === "applied"
                              ? "not_applied"
                              : "applied",
                          )
                        }
                      >
                        Applied
                      </button>
                    </div>
                  </td>
                </tr>
                {isExpanded && (
                  <tr className="evidence-row">
                    <td colSpan={9}>
                      <div
                        id={`evidence-${job.jobId}`}
                        className="job-evidence"
                      >
                        <p className="source-note">
                          {job.sourceId.startsWith("synthetic-")
                            ? "Synthetic example"
                            : "Source observation"}{" "}
                          · {job.observation.kind.replaceAll("_", " ")} ·
                          Industry unknown: no sourced fact. Applied is
                          applicant-reported and does not prove delivery or
                          submission.
                        </p>
                        {details(job)}
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            );
          })}
        </table>
      </section>
      {busy && (
        <p className="status-message" role="status">
          Saving private status…
        </p>
      )}
    </>
  );
}
