import type {
  DiscoveryJob,
  EvidenceValue,
} from "@job-search/discovery/schemas";
import { discoveryJobSchema } from "@job-search/discovery/schemas";
import { initializeApp } from "firebase/app";
import {
  connectAuthEmulator,
  getAuth,
  inMemoryPersistence,
  onAuthStateChanged,
  setPersistence,
  signInAnonymously,
  signOut,
  type User,
} from "firebase/auth";
import { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import type { ProfileView } from "../../../packages/server/dist/profile-schema.js";
import { safeLink } from "./links.mjs";
import { ProfilePanel } from "./profile.js";
import "./style.css";

if (!["127.0.0.1", "localhost"].includes(window.location.hostname)) {
  throw new Error("This synthetic preview runs on localhost only");
}
const app = initializeApp({
  apiKey: "synthetic-emulator-key",
  projectId: "demo-job-search",
  authDomain: "demo-job-search.firebaseapp.com",
});
const auth = getAuth(app);
connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
await setPersistence(auth, inMemoryPersistence);

function SourceLink({
  url,
  children,
}: {
  url: string;
  children: React.ReactNode;
}) {
  const href = safeLink(url);
  if (/^mailto:[^\s@,;?]+@[^\s@,;?]+\.[^\s@,;?]+$/.test(url))
    return <span>{url.slice(7)} · manual copying</span>;
  return href ? (
    <a href={href} target="_blank" rel="noopener noreferrer">
      {children} ↗
    </a>
  ) : (
    <span>Unavailable link</span>
  );
}
function Field({
  label,
  field,
}: {
  label: string;
  field: EvidenceValue | null;
}) {
  return (
    <div className="evidence">
      <strong>{label}</strong>
      {field ? (
        <>
          <span>{field.value}</span>
          <blockquote>{field.evidence.quote}</blockquote>
          <SourceLink url={field.evidence.url}>Source evidence</SourceLink>
          <small>Locator: {field.evidence.selector}</small>
        </>
      ) : (
        <span className="unknown">Unknown · no evidence</span>
      )}
    </div>
  );
}
function JobDetails({
  job,
  evaluation,
}: {
  job: DiscoveryJob;
  evaluation: ProfileView["evaluations"][number] | undefined;
}) {
  const observation = job.observation;
  const provenance = observation.discoveryProvenance;
  return (
    <details>
      <summary>Evidence & details</summary>
      <div className="details-grid">
        {evaluation && (
          <div className="evidence">
            <strong>Private assessment</strong>
            <span>
              {evaluation.stale
                ? "Stale · profile or job version changed"
                : evaluation.eligibility.replaceAll("_", " ")}
            </span>
            <span>
              Evidence confidence:{" "}
              {Math.round(evaluation.evidenceConfidence * 100)}%
            </span>
            <small>Profile version: {evaluation.profileVersionId}</small>
            <small>Evaluator: {evaluation.evaluatorVersion}</small>
            {evaluation.reasons.map((reason) => (
              <div key={`${reason.code}-${reason.jobField}`}>
                <span>
                  {reason.code.replaceAll("_", " ")} · {reason.outcome}
                </span>
                {reason.quote && <blockquote>{reason.quote}</blockquote>}
              </div>
            ))}
          </div>
        )}
        <Field label="Title" field={observation.title} />
        <Field label="Employer" field={observation.employer} />
        <Field label="Location" field={observation.location} />
        <Field label="Employment type" field={observation.employmentType} />
        <div className="evidence">
          <strong>Weekly hours</strong>
          {observation.weeklyHours?.status === "confirmed" ? (
            <>
              <span>
                {observation.weeklyHours.minimum}–
                {observation.weeklyHours.maximum} hours
              </span>
              <blockquote>{observation.weeklyHours.evidence.quote}</blockquote>
              <SourceLink url={observation.weeklyHours.evidence.url}>
                Source evidence
              </SourceLink>
            </>
          ) : (
            <span className="unknown">Unknown · no evidence</span>
          )}
        </div>
        <div className="evidence">
          <strong>Work authorization condition</strong>
          {observation.workAuthorization?.status === "confirmed" ? (
            <>
              <span>
                {observation.workAuthorization.requirement ===
                "employee_work_in_germany"
                  ? "Existing employee-work permission in Germany required"
                  : "Additional restrictions require review"}
              </span>
              <blockquote>
                {observation.workAuthorization.evidence.quote}
              </blockquote>
              <SourceLink url={observation.workAuthorization.evidence.url}>
                Source evidence
              </SourceLink>
              <small>
                Source requirement only; candidate permission needs explicit
                declaration and is not legally verified.
              </small>
            </>
          ) : (
            <span className="unknown">Unknown · no evidence</span>
          )}
        </div>
        {(["englishAccepted", "remoteFromGermany"] as const).map((key) => (
          <div className="evidence" key={key}>
            <strong>
              {key === "englishAccepted"
                ? "English accepted"
                : "Work remotely from Germany"}
            </strong>
            {observation[key].status === "unknown" ? (
              <span className="unknown">Unknown · confirmation needed</span>
            ) : (
              <>
                <span>
                  {observation[key].value ? "Confirmed yes" : "Confirmed no"}
                </span>
                <blockquote>{observation[key].evidence.quote}</blockquote>
                <SourceLink url={observation[key].evidence.url}>
                  Source evidence
                </SourceLink>
              </>
            )}
          </div>
        ))}
        <div className="evidence">
          <strong>Traceability</strong>
          <span>Source: {job.sourceId}</span>
          <span>Record: {job.sourceRecordId}</span>
          <span>Revision: {job.currentRevisionId}</span>
          <span>Policy reference: {observation.sourcePolicyRef}</span>
          <span>Observed: {observation.observedAt}</span>
          <span>First seen: {job.firstSeenAt}</span>
          <span>Last seen: {job.lastSeenAt}</span>
          <span>Last checked: {job.lastCheckedAt}</span>
          <small>
            Seen = present in a successful observation. Checked = latest
            processed observation; it does not prove the vacancy is still open.
            Unavailable outcomes do not prove closure; stream failures appear in
            run diagnostics.
          </small>
          <span>Published: {observation.publishedAt ?? "Unknown"}</span>
          <span>Expires: {observation.expiresAt ?? "Unknown"}</span>
          <span>Retain until: {observation.retentionUntil}</span>
          <span>
            Possible duplicates:{" "}
            {job.possibleDuplicateIds.join(", ") || "None linked"}
          </span>
          <SourceLink url={observation.originalUrl}>Original source</SourceLink>
        </div>
        {provenance && (
          <div className="evidence">
            <strong>Discovery path · unverified lead</strong>
            {provenance.kind === "search_result" ||
            provenance.kind === "brave_search_result" ? (
              <>
                <span>Search query reference: {provenance.queryRef}</span>
                <span>Search result reference: {provenance.resultRef}</span>
                {provenance.kind === "search_result" ? (
                  <span>Snapshot reference: {provenance.snapshotId}</span>
                ) : (
                  <>
                    <span>
                      Operator authorization:{" "}
                      {provenance.operatorAuthorizationRef}
                    </span>
                    <span>Provider storage/use grant: unverified</span>
                  </>
                )}
                <small>Search discovery does not verify employer facts.</small>
              </>
            ) : provenance.kind === "parent_anchor" ? (
              <>
                <span>Parent record: {provenance.parentSourceRecordId}</span>
                <blockquote>{provenance.evidence.quote}</blockquote>
                <SourceLink url={provenance.evidence.url}>
                  Parent page evidence
                </SourceLink>
                <small>Locator: {provenance.evidence.selector}</small>
              </>
            ) : (
              <span>Reviewed operator seed: {provenance.seedRef}</span>
            )}
          </div>
        )}
        {observation.applicationLinks.map((link) => (
          <div className="evidence" key={link.url}>
            <strong>Source-listed application link · unverified</strong>
            <SourceLink url={link.url}>{link.url}</SourceLink>
            <blockquote>{link.evidence.quote}</blockquote>
            <SourceLink url={link.evidence.url}>Link evidence</SourceLink>
            <small>Locator: {link.evidence.selector}</small>
          </div>
        ))}
      </div>
    </details>
  );
}
function App() {
  const [user, setUser] = useState<User | null>(null);
  const [jobs, setJobs] = useState<DiscoveryJob[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [profile, setProfile] = useState<ProfileView | null>(null);
  useEffect(
    () =>
      onAuthStateChanged(auth, (next) => {
        setUser(next);
        setJobs([]);
        setLoaded(false);
        setError("");
        setProfile(null);
      }),
    [],
  );
  useEffect(() => {
    if (!user) return;
    let active = true;
    setLoading(true);
    (async () => {
      const token = await user.getIdToken();
      const response = await fetch("/api/jobs", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok)
        throw new Error(
          response.status === 401
            ? "Your session expired. Sign out and sign in again."
            : "Local discovery data is unavailable. Try signing in again.",
        );
      const value: unknown = await response.json();
      if (typeof value !== "object" || value === null || !("jobs" in value))
        throw new Error("Invalid discovery response");
      const parsed = discoveryJobSchema.array().max(100).parse(value.jobs);
      if (active) {
        setJobs(parsed);
        setLoaded(true);
      }
    })()
      .catch((cause: unknown) => {
        if (active)
          setError(
            cause instanceof Error ? cause.message : "Local data unavailable",
          );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [user]);
  const login = async () => {
    setError("");
    try {
      await signInAnonymously(auth);
    } catch {
      setError(
        "Local authentication unavailable. Start the Auth emulator and retry.",
      );
    }
  };
  const staleEvaluation = (
    evaluation: ProfileView["evaluations"][number],
    job: DiscoveryJob,
  ) =>
    evaluation.stale ||
    evaluation.jobRevisionId !== job.currentRevisionId ||
    evaluation.profileVersionId !== profile?.activeVersionId ||
    Date.parse(evaluation.expiresAt) <= Date.now() ||
    !profile.versions.some(
      (version) =>
        version.id === evaluation.profileVersionId &&
        Date.parse(version.expiresAt) > Date.now(),
    );
  const currentEvaluation = (job: DiscoveryJob) =>
    profile?.evaluations.find(
      (evaluation) =>
        evaluation.jobId === job.jobId && !staleEvaluation(evaluation, job),
    );
  const displayedEvaluation = (job: DiscoveryJob) => {
    const evaluation =
      currentEvaluation(job) ??
      profile?.evaluations.find((evaluation) => evaluation.jobId === job.jobId);
    return evaluation
      ? { ...evaluation, stale: staleEvaluation(evaluation, job) }
      : undefined;
  };
  const orderedJobs = [...jobs].sort(
    (a, b) =>
      (currentEvaluation(b)?.fitScore ?? -1) -
        (currentEvaluation(a)?.fitScore ?? -1) ||
      b.lastCheckedAt.localeCompare(a.lastCheckedAt),
  );
  return (
    <main>
      <header>
        <div>
          <p className="eyebrow">DISCOVERY / LOCAL PREVIEW</p>
          <h1>
            Your next opportunity,
            <br />
            with the evidence attached.
          </h1>
          <p className="intro">
            Review discoveries, follow original links, and keep uncertainty
            visible.
          </p>
        </div>
        {user && (
          <button
            type="button"
            className="secondary"
            onClick={() => void signOut(auth)}
          >
            Sign out
          </button>
        )}
      </header>
      <aside className="notice">
        <strong>Local emulator preview</strong>
        <span>
          Firebase emulators and synthetic login identities. Seeded examples are
          labeled; imported source observations do not establish coverage or
          eligibility.
        </span>
      </aside>
      {!user ? (
        <section className="login">
          <h2>Sign in to view discoveries</h2>
          <p>
            This local test creates a temporary synthetic Firebase identity. No
            email, profile or application is required.
          </p>
          <button type="button" onClick={() => void login()}>
            Sign in to local demo
          </button>
        </section>
      ) : (
        <>
          <ProfilePanel
            key={user.uid}
            user={user}
            onChange={(next) => {
              setProfile(next);
              if (next.lifecycle === "deleted" || next.lifecycle === "deleting")
                setJobs([]);
            }}
          />
          <div className="section-title">
            <div>
              <h2>
                Discoveries <span className="count">{jobs.length}</span>
              </h2>
              <p>
                {profile?.activeVersionId
                  ? "Private fit scores first · evidence confidence stays separate"
                  : "Latest check first · approve a profile before matching"}
              </p>
            </div>
            <span className="session">Authenticated local session</span>
          </div>
          {loading && <p role="status">Loading discoveries…</p>}
          {loaded && jobs.length === 0 && (
            <p>
              No discoveries yet. Run the synthetic seed command to preview a
              record.
            </p>
          )}
          {jobs.length > 0 && (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Role / source status</th>
                    <th>Employer & location</th>
                    <th>Fit</th>
                    <th>Original application</th>
                  </tr>
                </thead>
                <tbody>
                  {orderedJobs.map((job) => (
                    <tr key={job.jobId}>
                      <td colSpan={4}>
                        <div className="job-row">
                          <div>
                            <small>
                              {job.sourceId.startsWith("synthetic-")
                                ? "Synthetic example"
                                : "Source observation"}
                            </small>
                            <h3>
                              {job.observation.title?.value ?? "Unknown title"}
                            </h3>
                            <span className="badge">
                              {job.observation.kind.replaceAll("_", " ")}
                            </span>
                          </div>
                          <div>
                            {job.observation.employer?.value ??
                              "Unknown employer"}
                            <small>
                              {job.observation.location?.value ??
                                "Location unknown"}
                            </small>
                          </div>
                          <div className="muted">
                            {currentEvaluation(job) ? (
                              <>
                                <span>
                                  {currentEvaluation(job)?.fitScore === null
                                    ? "Unavailable"
                                    : `${currentEvaluation(job)?.fitScore}/100`}
                                </span>
                                <small>
                                  {currentEvaluation(
                                    job,
                                  )?.eligibility.replaceAll("_", " ")}
                                </small>
                                <small>
                                  Evidence confidence:{" "}
                                  {Math.round(
                                    (currentEvaluation(job)
                                      ?.evidenceConfidence ?? 0) * 100,
                                  )}
                                  %
                                </small>
                              </>
                            ) : (
                              <>
                                <span>Unavailable</span>
                                <small>Matching is not available yet</small>
                              </>
                            )}
                          </div>
                          <div>
                            <SourceLink url={job.observation.originalUrl}>
                              Original posting
                            </SourceLink>
                            <br />
                            {job.observation.applicationLinks.length > 0 ? (
                              job.observation.applicationLinks.map((link) => (
                                <SourceLink key={link.url} url={link.url}>
                                  Source-listed link · unverified
                                </SourceLink>
                              ))
                            ) : (
                              <span className="unknown">
                                No verified application link
                              </span>
                            )}
                          </div>
                        </div>
                        <JobDetails
                          job={job}
                          evaluation={displayedEvaluation(job)}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <footer>
        Review source evidence before acting. The applicant alone copies, sends
        and submits.
      </footer>
    </main>
  );
}
const container = document.getElementById("root");
if (!container) throw new Error("Missing app root");
createRoot(container).render(<App />);
