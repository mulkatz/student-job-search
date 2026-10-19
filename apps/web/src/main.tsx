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
import { safeLink } from "./links.mjs";
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
function JobDetails({ job }: { job: DiscoveryJob }) {
  const observation = job.observation;
  return (
    <details>
      <summary>Evidence & details</summary>
      <div className="details-grid">
        <Field label="Title" field={observation.title} />
        <Field label="Employer" field={observation.employer} />
        <Field label="Location" field={observation.location} />
        <Field label="Employment type" field={observation.employmentType} />
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
            Failed fetches appear in run diagnostics.
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
  useEffect(
    () =>
      onAuthStateChanged(auth, (next) => {
        setUser(next);
        setJobs([]);
        setLoaded(false);
        setError("");
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
          <div className="section-title">
            <div>
              <h2>
                Discovered roles <span className="count">{jobs.length}</span>
              </h2>
              <p>Latest check first · fit scores are not available yet</p>
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
                  {jobs.map((job) => (
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
                            <span>Unavailable</span>
                            <small>Matching is not available yet</small>
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
                        <JobDetails job={job} />
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
