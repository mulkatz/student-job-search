# Operations and private pilot handover

The local preview remains synthetic and loopback-only. The user subsequently
authorized a private Firebase pilot with consented real-PDF intake under ADR 0027.
The pilot is distinct from full V1 release. Check [V1_READINESS.json](V1_READINESS.json)
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
batch when more work remains. The local emulator has no cleanup schedule; the
[deployed private pilot](#private-firebase-pilot) has authenticated daily maintenance. Read, export
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
The user's removed long-term test is not reinstated. The authorized private pilot
below has deployed infrastructure and a cleanup schedule; a daily discovery
schedule and real applicant acceptance remain separate. No subscription/top-up or
broader-user onboarding is authorized. Broader use remains V2; public distribution also needs the intended license
and attribution decisions recorded in [OPEN_QUESTIONS.md](OPEN_QUESTIONS.md).


## Private Firebase pilot

The requested site is `https://student-job-search.web.app`. Hosting serves only
public application assets; every job/profile/application/search API needs a valid,
revocation-checked, verified Google identity on the private server allowlist.
Direct Firestore/Storage clients are denied by `firestore.pilot.rules` and
`storage.pilot.rules`; the API uses a dedicated platform service account. The
local emulator guard and synthetic processing defaults remain separate.

Sign in with the invited account. Open **Profile & preferences**, consent to
private document processing, and select a CV or up to three PDFs (each 2 MiB,
ten pages). Review the extracted page text and correct/attest facts. Ordinary CV
prose is not automatically understood as qualifications: the bounded parser
recognizes explicit labeled facts; the questionnaire supplies reviewed languages,
levels, hours, employment/workplace preferences and optional experience/skills.
Unknown answers remain unknown. Desired roles/industries are search preferences,
not proof of experience. Approve the combined immutable version before searching.

Use **Run 30-job dry run** to enqueue a bounded job. The server uses controlled
job vocabulary from approved preferences/skills, never raw CV text, contacts,
quotes, names or authorization details in search queries. Result rows are fetched
vacancy details with title/employer evidence, not merely search URLs. Fewer than
30 may be found. Freshness, compatibility, industry and channels can remain
unknown; no hiring probability or full source acceptance is implied. Industry
currently has no sourced field and displays unknown. Avatars use initials, with
no external logo requests. Apply opens the original source; View Draft requires
independently reviewed channels and grounded inputs. Real discovered channels
are not automatically certified by extraction.

A separate durable pilot ledger reserves at most EUR 1 per run and EUR 5 per month
for search. Each run has at most 20 search calls, 120 public HTTP sends including
metadata/redirects, 300 observations, 30 displayed deduplicated rows and no model
calls. Cloud jobs have finite timeouts and no automatic retries; ambiguous paid
attempts or dispatch need private operator reconciliation. These are application
bounds, not a provider billing hard stop. Cloud hosting/build/storage costs are
separate within the existing EUR 50 monthly operating constraint. No G3 cap,
original failure or retained technical origin ownership is reset.

Source frontiers expire within seven days and are cleared at terminal completion.
Private search metadata expires with its exact approved profile version (at most
90 days), or earlier on generation change/profile deletion. Read/export boundaries
omit expired content. Authenticated daily cleanup physically removes due PDFs/profile
history and expired private search runs/attempts/references. Candidate-free monthly
budget totals and technical origin ownership/pacing remain for enforcement.

Cloud Scheduler invokes the bounded maintenance job daily at **03:00 Europe/Berlin**
with a dedicated service identity permitted to invoke only that cleanup job. It
has zero retries and cannot dispatch discovery. The deployed profileState.nextCleanupAt
collection-group index is declared in `firestore.indexes.json`. Index readiness,
a direct maintenance execution and the Scheduler invocation chain were checked
against the deployed project. Inspect failures and repeat full batches until
drained; a bounded successful batch does not prove an arbitrary backlog is empty.
For manual recovery:

```sh
gcloud run jobs execute job-search-cleanup --region europe-west3 --project YOUR_PROJECT --wait
```

After data deletion, the same Google identity retains a terminal tombstone; signing
in again does not reset it. New intake after deletion needs operator reconciliation
of completed physical cleanup and a separately safe restart. Do not remove uncertain
writer markers or change the candidate UID to bypass that boundary.

Deployment uses the existing locked Node tooling and `Dockerfile` with maintained
Poppler. Build in a reviewed source snapshot excluding `.local`, credentials,
`.env`, PDFs, dependency trees and generated artifacts (`.gcloudignore` and
`.dockerignore`). Use explicit project/region/service identities, never an ambient
gcloud default. Keep the allowlist, bucket/project configuration and search API key
private; mount the key only into the search job through Secret Manager. The API
has scale-to-zero, one maximum instance and concurrency one. Search jobs use one
task, parallelism one, zero retries and a finite execution timeout.

Deploy Hosting with `firebase.json`; deploy production deny-all rules with
`firebase.pilot.json` (rules and the cleanup index) after mapping its
`private-profiles` storage target in ignored
local Firebase configuration. Google sign-in is enabled using the Firebase CLI
provider provisioning flow; the requested Hosting domain is explicitly authorized.
The runtime reads public Firebase SDK configuration from `/__/firebase/init.json`,
without committing account-specific API configuration to source.

HTML includes robots and Googlebot noindex metadata; Hosting/API responses add
`X-Robots-Tag`. Robots crawling stays allowed so Google can read noindex, as
[Google documents](https://developers.google.com/search/docs/crawling-indexing/block-indexing).
No sitemap is published. Authentication protects private content independently of
crawler behavior. Verify actual deployed headers, unauthenticated denial and
approved-account UI behavior; configured rules alone are not live proof.

Deployment verification on 2026-10-20 confirmed noindex headers/HTML metadata,
unauthenticated private-API denial, desktop/mobile login rendering and exact served
HTML/JS/CSS hashes against the verified build. No actual Google-account sign-in,
real CV intake or real-source search was performed; upload/review/approve/run in
the invited account is the next applicant action.
