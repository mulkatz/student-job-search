# Local operations and V1 handover

This runbook covers the loopback-only synthetic preview. It is not a production
deployment or permission to process real CVs. Check [V1_READINESS.json](V1_READINESS.json)
and [PLAN.md](PLAN.md#g7-v1-release-and-operational-handover) for the current blocked
release decision. Local test success does not replace source or live operating evidence.

## Start and stop

Use Node 24.22.0/npm 11.11.0, Java 21 or newer, and Poppler `pdfinfo`/`pdftotext`.
Install locked dependencies with `npm ci`, install Chromium with
`npx playwright install chromium`, then run `npm run verify` from the repository root.
Tool installation may download public artifacts; normal verification uses synthetic
data and local services, without paid providers or cloud credentials.

Start `npm run local:emulators` in one terminal. In a second terminal:

```sh
export FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099
export FIRESTORE_EMULATOR_HOST=127.0.0.1:8080
export FIREBASE_STORAGE_EMULATOR_HOST=127.0.0.1:9199
npm run seed --workspace=@job-search/server -- --applications
npm run start --workspace=@job-search/server
```

In another terminal run `npm run dev --workspace=@job-search/web`, then open
<http://127.0.0.1:5173>. The five source contracts and contacts are fictional.
Use the synthetic PDF review/approval flow before matching and generating drafts.
The default seed without `--applications` keeps an unverified source-listed link.
Private source imports follow [G4_LOCAL.md](G4_LOCAL.md); the preview never imports
or polls live sources automatically. Stop the API, web server and emulators to end
the session. No emulator export or background scheduler is installed.

Anonymous authentication is held in memory. Refresh/signout can lose access to the
previous owner; signing in again creates a new demo identity. Export retained data
before ending a session if needed. The export is a private copy, with no supported
restore/import flow. This is not persistent pilot-account recovery or a backup system.

## Read-only diagnostics and alerts

With the same explicit emulator environment and a current build:

```sh
npm run ops:status --workspace=@job-search/server
```

The operator command reads at most 100 shared projections and 25 private profile
records, with one extra record per query to detect truncation. It writes no records.
Output contains counts, controlled codes and scan completeness, never owner IDs,
candidate facts, URLs, recipients, source quotes or raw transport errors. The data
scan has a five-second deadline and a bounded shutdown attempt.

Exit 0 means no alert in a complete scan of tracked local records. Exit 2 means
attention, incomplete/unavailable inspection or command failure. Empty or partial
inspection does not establish source availability, rights, model quality, all stored
objects or release readiness. Alerts are local output; no notification is sent.

| Alert family | Action |
| --- | --- |
| `shared_expiry_due`, `private_cleanup_due`, `private_expiry_due` | Run bounded cleanup; recheck status and read-expiry behavior. |
| `source_review_expired` | Source contract is no longer usable for generation/copying. Obtain fresh permitted evidence rather than extending its old deadline. |
| `private_reconciliation_required`, `private_deletion_in_progress` | Stop the relevant writer; inspect the private reservation and terminal-write evidence. Time alone cannot establish physical deletion. |
| `shared_record_invalid`, `private_record_invalid` | Stop affected work. Investigate schema/identity/hash failure privately; do not copy records into logs or silently repair ownership. |
| `shared_source_unavailable` | Inspect source/access diagnostics separately. A stored unavailable observation is not a vacancy. |
| Scan incomplete/unavailable or deadline code | Restore the local service or reduce the inspected backlog through authorized cleanup, then rerun. Never interpret a partial scan as all-clear. |

## Cleanup, export and deletion

```sh
npm run cleanup --workspace=@job-search/server
```

Cleanup removes at most 100 expired shared projections and processes at most 25 due
private profiles per invocation. Check output and status; repeat a full bounded
batch when more work remains. There is no installed cleanup schedule. Read, export
and copy boundaries hide expired data immediately, but physical deletion requires
the cleanup/deletion path. It covers application versions and their evaluation
references together. Retained history is not silently evicted to make capacity.

Raw PDFs/drafts expire within seven days; approved versions within 90 days.
Evaluations and application text expire no later than their source/profile/evaluation
inputs or seven days. New edits, review or replay do not renew those deadlines.
The profile panel exports retained owner data and requests deletion through an
immediate tombstone. Uncertain uploads retain minimal markers until terminal-write
evidence supports reconciliation. Do not report physical completion while writers
can still publish. Inspect only the authenticated owner's exported data.

G3/G4 capture trees have separate deadlines and private inventories. Use
`.local/g4/retention-inventory.json`; preserve minimized origin ownership, pacing,
cooldowns and cumulative usage after source retirement. Record actual deletion and
aggregate/digest provenance, without keeping expired bodies, quotes or labels in a
new report. Historical replay never renews source retention. A generic phrase match
alone does not establish capture lineage; preserve separately authorized evidence.

## Failure and recovery

| Failure | Safe recovery and evidence limit |
| --- | --- |
| Emulator unavailable | Stop dependent local work, restore the three explicit loopback targets, then rerun status. The service cannot fall through to a cloud project. |
| Expired/invalid authentication | Preserve visible unsaved edits, restore a valid session and retry the same operation only with the same input. Demo sign-in does not recover an old anonymous owner's data. Production persistent recovery remains unverified. |
| Source 403/challenge or missing access | Preserve the blocked/unavailable outcome. Do not bypass authentication or CAPTCHA, impersonate another source, or turn a lead into a verified vacancy. |
| Source 429 | Honor persisted Retry-After/cooldowns and origin pacing under the shared source lock. Retain the same technical owner and attempt accounting. |
| Robots metadata or unresolved rights | Apply ADR 0005: robots metadata alone is non-blocking; source-specific rights, authentication, SSRF/network and resource boundaries are separate. ADR 0016's private Brave exception is not a vendor grant. |
| Interrupted discovery | Stop the old worker before resuming the same persisted run/fence/checkpoint. Inspect the latest attempt; an uncertain paid dispatch requires explicit reconciliation, not automatic retry. |
| Model timeout/ambiguous usage | Keep the reservation, evidence and lock until reconciled. Never delete markers, switch providers, reset history or invent zero charges to regain allowance. |
| Cost/token/request or capacity refusal | Stop new work. Inspect the retained cap state; cleanup may free expired local storage but cannot reset spending or request history. A new day is not dispatch authorization. |
| Stale package or conflicting version | Refresh current profile/job/evaluation evidence. Regenerate explicitly into a new version; retain old edits and review the exact new hash. Copying never marks applied. |
| Clipboard permission failure | Keep the reviewed package and grant browser permission if intended, then click copy again. No external form is filled or submitted. |
| Pending deletion | Keep the tombstone; reconcile writers and rerun bounded cleanup. Do not recreate private state or remove uncertain markers merely to obtain a success result. |

Source lead URLs, source contracts and application addresses are untrusted input.
The applicant alone transfers text, attaches files and sends/submits. Questionnaire
start dates remain unanswered when unknown; consents, signatures and declarations
remain applicant actions. Freeform edited drafts do not inherit automatic grounding.

For the historical G3 investigation, `npm run experiment -- status` reports local
cap/attempt state without a provider call. CountTokens also consumes a model request.
The exact single five-package repair was observed on 2026-10-20 with two requests;
its outputs and independent review are immutable. Never replay its existing case.
No further source expansion or automatic model retry is scheduled.

## Release check and handover drill

```sh
npm run release:check
```

This builds current code and checks the 17 declared criteria, with fixed required
local/live scopes and a manifest hash. Current output is blocked (exit 2). The
manifest is an evidence register, not certification that referenced artifacts are
authentic or that release/deployment is authorized. Unknown, absent or insufficient
evidence cannot be promoted through a local test or a lower manifest scope.

`npm run verify` runs the safe-data handover drill: upload/correct/approve, match,
review/copy, preserve edits across regeneration and failures, mark manual status,
export and delete. Actual Firebase-emulator and Chromium checks establish local
behavior only. Operational tests also inspect due/invalid/partial records, prove
status does not mutate state and exercise unavailable-service reporting.

Remaining release work includes useful permitted real sources, adequate independent
extraction acceptance, an actually running daily Europe/Berlin schedule, persistent
identity/recovery, deployed ownership rules and unattended real-data operations.
The user's removed long-term test is not reinstated. No cloud scheduler, deployment,
billing change, real-CV processing or broader-user onboarding is enabled by this
runbook. Broader use remains V2; public distribution also needs the intended license
and attribution decisions recorded in [OPEN_QUESTIONS.md](OPEN_QUESTIONS.md).
