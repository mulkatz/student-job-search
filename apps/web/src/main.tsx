import type {
  DiscoveryJob,
  EvidenceValue,
} from "@job-search/discovery/schemas";
import { discoveryJobSchema } from "@job-search/discovery/schemas";
import { onAuthStateChanged, signOut, type User } from "firebase/auth";
import { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  currentEvaluatorVersion,
  type ProfileView,
} from "../../../packages/server/dist/profile-schema.js";
import { ApplicationDialog } from "./applications.js";
import { JobsTable } from "./jobs-table.js";
import { safeLink } from "./links.mjs";
import { ProfilePanel } from "./profile.js";
import { runtime } from "./runtime.js";
import { SearchRun } from "./search-run.js";
import "./style.css";

const { auth } = runtime;

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
      <Field
        label="Complete language requirements"
        field={
          observation.languageRequirements &&
          observation.languageRequirements.status !== "unknown"
            ? {
                value:
                  observation.languageRequirements.status === "complete"
                    ? observation.languageRequirements.alternatives
                        .map((set) =>
                          set
                            .map(
                              (requirement) =>
                                `${requirement.language}${requirement.minimumLevel ? ` ${requirement.minimumLevel}` : ""}`,
                            )
                            .join(" AND "),
                        )
                        .join(" OR ")
                    : "Conflicting source requirements · review needed",
                evidence: observation.languageRequirements.evidence,
              }
            : null
        }
      />
      <Field
        label="Employment and hours alternatives"
        field={
          observation.employmentOptions &&
          observation.employmentOptions.status !== "unknown"
            ? {
                value:
                  observation.employmentOptions.status === "complete"
                    ? observation.employmentOptions.options
                        .map(
                          (option) =>
                            `${option.employmentType.replaceAll("_", " ")} · ${option.weeklyHours.minimum}–${option.weeklyHours.maximum} hours${option.weeklyHours.flexibleWithinRange ? " · applicant may choose within range" : ""}`,
                        )
                        .join(" OR ")
                    : "Conflicting source requirements · review needed",
                evidence: observation.employmentOptions.evidence,
              }
            : null
        }
      />
      <Field
        label="Complete work arrangements"
        field={
          observation.workArrangements &&
          observation.workArrangements.status !== "unknown"
            ? {
                value:
                  observation.workArrangements.status === "complete"
                    ? observation.workArrangements.arrangements
                        .map((arrangement) =>
                          arrangement.mode === "remote"
                            ? `Remote from ${arrangement.allowedCountries.join(", ")}`
                            : `${arrangement.mode.replaceAll("_", " ")} · ${arrangement.city}, ${arrangement.countryCode}`,
                        )
                        .join(" OR ")
                    : "Conflicting source requirements · review needed",
                evidence: observation.workArrangements.evidence,
              }
            : null
        }
      />
      <Field
        label="Other mandatory requirements"
        field={
          observation.additionalRequirements &&
          observation.additionalRequirements.status !== "unknown"
            ? {
                value:
                  observation.additionalRequirements.status === "none"
                    ? "Source explicitly states no further mandatory requirements"
                    : "Unresolved requirements · review needed",
                evidence: observation.additionalRequirements.evidence,
              }
            : null
        }
      />
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
          Seen = present in a successful observation. Checked = latest processed
          observation; it does not prove the vacancy is still open. Unavailable
          outcomes do not prove closure; stream failures appear in run
          diagnostics.
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
  );
}
function App() {
  const [user, setUser] = useState<User | null>(null);
  const [jobs, setJobs] = useState<DiscoveryJob[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [statusRefresh, setStatusRefresh] = useState(0);
  const [discoveryRefresh, setDiscoveryRefresh] = useState(0);
  const [profile, setProfile] = useState<ProfileView | null>(null);
  const [applicationJob, setApplicationJob] = useState<DiscoveryJob | null>(
    null,
  );
  useEffect(
    () =>
      onAuthStateChanged(auth, (next) => {
        setUser(next);
        setJobs([]);
        setLoaded(false);
        setError("");
        setProfile(null);
        setApplicationJob(null);
      }),
    [],
  );
  // biome-ignore lint/correctness/useExhaustiveDependencies: A completed search explicitly invalidates the job list.
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
  }, [user, discoveryRefresh]);
  const login = async () => {
    setError("");
    try {
      await runtime.login();
    } catch {
      setError(
        runtime.local
          ? "Local authentication unavailable. Start the Auth emulator and retry."
          : "Google sign-in was not completed. Please try again.",
      );
    }
  };
  const staleEvaluation = (
    evaluation: ProfileView["evaluations"][number],
    job: DiscoveryJob,
  ) =>
    evaluation.stale ||
    evaluation.evaluatorVersion !== currentEvaluatorVersion ||
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
          <p className="eyebrow">
            {runtime.local
              ? "JOB SEARCH / LOCAL PREVIEW"
              : "JOB SEARCH / PRIVATE PILOT"}
          </p>
          <h1>Your opportunities</h1>
          <p className="intro">
            Compare jobs, review your fit, and choose your next step.
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
        <strong>
          {runtime.local ? "Local emulator preview" : "Private pilot"}
        </strong>
        <span>
          {runtime.local
            ? "Firebase emulators and synthetic login identities. Seeded examples are labeled; imported source observations do not establish coverage or eligibility."
            : "Your profile and application drafts are private to your account. Review source evidence and copy application text yourself."}
        </span>
      </aside>
      {!user ? (
        <section className="login">
          <h2>Sign in to view discoveries</h2>
          <p>
            {runtime.local
              ? "This local test creates a temporary synthetic Firebase identity. No email, profile or application is required."
              : "Sign in with your invited Google account to review opportunities and manage your private profile."}
          </p>
          <button type="button" onClick={() => void login()}>
            {runtime.local ? "Sign in to local demo" : "Sign in with Google"}
          </button>
        </section>
      ) : (
        <>
          <details className="profile-disclosure">
            <summary>
              <span>Profile & preferences</span>
              <span className="profile-summary">
                {profile?.activeVersionId
                  ? "Approved profile · manage matching"
                  : "Set up your profile to see fit scores"}
              </span>
            </summary>
            <ProfilePanel
              key={user.uid}
              user={user}
              local={runtime.local}
              realProfileProcessing={runtime.realProfileProcessing}
              refreshKey={discoveryRefresh}
              onChange={(next) => {
                setProfile(next);
                if (
                  next.lifecycle === "deleted" ||
                  next.lifecycle === "deleting"
                ) {
                  setJobs([]);
                  setApplicationJob(null);
                }
              }}
            />
          </details>
          {!runtime.local && (
            <SearchRun
              key={user.uid}
              user={user}
              activeVersionId={profile?.activeVersionId ?? null}
              onComplete={() => setDiscoveryRefresh((value) => value + 1)}
            />
          )}
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
            <span className="session">
              {runtime.local
                ? "Authenticated local session"
                : "Private account session"}
            </span>
          </div>
          {loading && <p role="status">Loading discoveries…</p>}
          {loaded && jobs.length === 0 && (
            <p>
              {runtime.local
                ? "No discoveries yet. Run the synthetic seed command to preview a record."
                : "No opportunities yet. Add and approve your profile, then start a 30-job dry run."}
            </p>
          )}
          {jobs.length > 0 && (
            <JobsTable
              key={`${user.uid}:${statusRefresh}`}
              user={user}
              jobs={orderedJobs}
              evaluationFor={displayedEvaluation}
              draftEnabled={
                !!profile &&
                !["deleted", "deleting"].includes(profile.lifecycle)
              }
              onDraft={setApplicationJob}
              details={(job) => (
                <JobDetails job={job} evaluation={displayedEvaluation(job)} />
              )}
            />
          )}
        </>
      )}
      {user &&
        applicationJob &&
        profile &&
        !["deleted", "deleting"].includes(profile.lifecycle) && (
          <ApplicationDialog
            key={`${user.uid}:${applicationJob.jobId}`}
            user={user}
            job={applicationJob}
            profile={profile}
            onClose={() => {
              setApplicationJob(null);
              setStatusRefresh((value) => value + 1);
            }}
          />
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
