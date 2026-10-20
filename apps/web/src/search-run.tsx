import type { User } from "firebase/auth";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  type SearchRunSummary,
  searchRunResponseSchema,
} from "../../../packages/server/dist/pilot-search-view-schema.js";

export function SearchRun({
  user,
  activeVersionId,
  onComplete,
}: {
  user: User;
  activeVersionId: string | null;
  onComplete: () => void;
}) {
  const [run, setRun] = useState<SearchRunSummary | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const alive = useRef(true);
  const timer = useRef<number | undefined>(undefined);
  const operation = useRef<{ version: string; id: string } | null>(null);
  const completed = useRef<string | null>(null);
  const completeCallback = useRef(onComplete);
  completeCallback.current = onComplete;
  const request = useCallback(
    async (body?: { operationId: string; expectedActiveVersionId: string }) => {
      const token = await user.getIdToken();
      const response = await fetch("/api/search-runs", {
        method: body ? "POST" : "GET",
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
            : response.status === 409
              ? "This profile or run changed. Refresh run status before starting again."
              : "Search is currently unavailable. Your profile remains saved.",
        );
      return searchRunResponseSchema.parse(await response.json()).run;
    },
    [user],
  );
  const accept = useCallback(
    (next: SearchRunSummary | null) => {
      if (!alive.current) return;
      setRun(next);
      window.clearTimeout(timer.current);
      if (next && ["queued", "running"].includes(next.status)) {
        timer.current = window.setTimeout(() => {
          void request()
            .then(accept)
            .catch((cause: unknown) => {
              if (alive.current)
                setError(
                  cause instanceof Error
                    ? cause.message
                    : "Run status unavailable",
                );
            });
        }, 2500);
      } else if (next && completed.current !== `${next.id}:${next.updatedAt}`) {
        completed.current = `${next.id}:${next.updatedAt}`;
        completeCallback.current();
      }
    },
    [request],
  );
  useEffect(() => {
    alive.current = true;
    let active = true;
    void request()
      .then((next) => {
        if (active) accept(next);
      })
      .catch((cause: unknown) => {
        if (active)
          setError(
            cause instanceof Error ? cause.message : "Run status unavailable",
          );
      });
    return () => {
      active = false;
      alive.current = false;
      window.clearTimeout(timer.current);
    };
  }, [request, accept]);
  const start = async () => {
    if (!activeVersionId || busy) return;
    operation.current =
      operation.current?.version === activeVersionId
        ? operation.current
        : { version: activeVersionId, id: crypto.randomUUID() };
    setBusy(true);
    setError("");
    try {
      const next = await request({
        operationId: operation.current.id,
        expectedActiveVersionId: activeVersionId,
      });
      operation.current = null;
      accept(next);
    } catch (cause: unknown) {
      if (alive.current)
        setError(cause instanceof Error ? cause.message : "Search unavailable");
    } finally {
      if (alive.current) setBusy(false);
    }
  };
  const pending = run && ["queued", "running"].includes(run.status);
  return (
    <section className="search-run" aria-label="30-job dry run">
      <div>
        <strong>Find your next 30 opportunities</strong>
        <p>
          {!activeVersionId
            ? "Add documents, complete the questionnaire, and approve your profile first."
            : "Search public sources using your approved preferences. Results may be fewer than 30. Review and apply yourself."}
        </p>
      </div>
      <button
        type="button"
        disabled={
          !activeVersionId ||
          busy ||
          !!pending ||
          run?.status === "dispatch_uncertain"
        }
        onClick={() => void start()}
      >
        {pending ? "Searching…" : "Run 30-job dry run"}
      </button>
      {run && (
        <p className="run-status" role="status">
          {run.status === "completed"
            ? "Search complete"
            : run.status === "limited"
              ? "Search finished within available sources and limits"
              : run.status === "dispatch_uncertain"
                ? "Run status needs review; check status before starting again"
                : run.status.replaceAll("_", " ")}{" "}
          · {run.displayedJobs} of up to 30 jobs
          {run.reason ? ` · ${run.reason.replaceAll("_", " ")}` : ""}
          {run.profileVersionId !== activeVersionId
            ? " · Based on a previous approved profile"
            : ""}
        </p>
      )}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {(error || run?.status === "dispatch_uncertain") && (
        <button
          type="button"
          className="secondary"
          disabled={busy}
          onClick={() => {
            setBusy(true);
            void request()
              .then((next) => {
                if (alive.current) {
                  setError("");
                  accept(next);
                }
              })
              .catch((cause: unknown) => {
                if (alive.current)
                  setError(
                    cause instanceof Error
                      ? cause.message
                      : "Run status unavailable",
                  );
              })
              .finally(() => {
                if (alive.current) setBusy(false);
              });
          }}
        >
          Refresh run status
        </button>
      )}
    </section>
  );
}
