# Technical MVP Specification — Job Discovery & Application Drafting

**Version:** 1.0  
**Date:** 2026-10-19  
**Status:** Build-ready proposal; source access and Google OAuth configuration require validation  
**Primary user:** One English-speaking university student based in Berlin  
**Implementation language:** TypeScript  
**Cloud:** Google Cloud / Firebase

## 0. Executive Summary

Build a scheduled, source-compliant research pipeline that discovers student-suitable jobs in Berlin and jobs that may be performed remotely from Germany. It normalizes and deduplicates job postings; applies conservative language, location and employment-type eligibility checks; evaluates candidates against a CV-based profile; and creates personalized **unsent Gmail drafts** for high-quality matches when a confirmed recruitment email address exists. Jobs requiring an Applicant Tracking System (ATS) form receive an application package and a verified application URL, not an invented email recipient.

**Non-negotiable:** The student alone sends applications. No automatic email transmission, no invented qualifications, no scraping that violates source terms, and no unverified claims that a role is English-speaking or remote from Germany.

**Architecture:** one scheduled Cloud Run Job plus a small authenticated Cloud Run API and Firebase-hosted React UI, backed by Firestore, private Cloud Storage, Secret Manager, and an LLM adapter. No agent orchestration platform, message bus or vector DB in v1.

### Success definition

The MVP is successful when a daily run reliably generates an auditable shortlist of new relevant jobs, creates at most one application package per job/profile version, and safely prepares valid Gmail drafts for vacancies with verified application email addresses—without ever sending a message.

## 1. Audience, constraints, and assumptions

### Confirmed requirements
- Candidate is a university student, based in Berlin.
- Candidate only speaks English for working purposes. Do not assume German fluency.
- Search scope: on-site jobs in Berlin **and** remote jobs legally operable from Germany; both are equally desirable.
- Employment types: Minijob, part-time, working-student jobs, temporary/short-term employment. Do not require every role to be a Minijob.
- Personalization based on an uploaded CV and confirmed candidate profile.
- Gmail drafts with manual sending, ideally with the PDF CV attached.
- Preferred stack: Google Cloud, Firebase, TypeScript.

### Inputs not yet known (profile fields, not implementation blockers)
- CV, previous work experience and skills.
- Work authorization/residence restrictions (if applicable), weekly availability, preferred start date, study timetable, sectors to exclude.
- Hourly wage expectations, commuting radius, remote hardware/location requirements.
- Gmail OAuth consent and preferred applicant email address.

Default unknown attributes to `unknown`, not `false` or `eligible`.

### Legal/operational guardrails
- In 2026, the German Minijob regular earnings threshold is **€603/month** and the statutory minimum wage is **€13.90/hour**. Treat this as one employment category, not an overall salary cap. Source: https://www.minijob-zentrale.de/DE/die-minijobs/arbeitsrechte-im-minijob/mindestlohn/mindestlohn_node.html
- Working-student and short-term arrangements have different labor, insurance and tax implications; classification is not inferred from title alone.
- Student work rights may depend on residency/work authorization. For non-EU students holding a study residence permit, additional work-day/hour rules can apply; do not auto-declare legal eligibility. Source: https://www.make-it-in-germany.com/en/study-vocational-training/studies-in-germany/work
- Job postings are externally controlled and may be removed/changed; never promise availability without rechecking.

## 2. Scope

### In scope — v1
1. CV upload (PDF, optionally DOCX in future) and applicant-profile extraction with human correction.
2. Connector adapters for Adzuna and selected employer career boards powered by Greenhouse and Lever.
3. Normalization, exact/fuzzy deduplication, role and location validation, evidence citations/snippets.
4. Hybrid deterministic + LLM relevance assessment, reasoned score and separate evidence-confidence metric.
5. Daily scheduling, run metrics, error handling, idempotent upserts and revision tracking.
6. Email application text generation using only verified profile facts; Gmail draft creation for verified email applications.
7. ATS application packages where an online form is required.
8. Minimal UI to review matches, see evidence, open links, manage application status and correct profile.
9. Manual sent/ignored/applied status; no mailbox reading needed.

### Out of scope — v1
- Auto-sending, auto-submitting ATS forms, CAPTCHA bypass, cold-email address guessing.
- LinkedIn/Indeed scraping, uncontrolled general web crawling, anti-bot evasion.
- Public multi-user SaaS, payments, recruiter reply parsing, calendar scheduling.
- Machine-learning models trained on application success; agents that make independent external decisions.
- Cover letter PDF templating unless a posting explicitly requires it (can be prepared as plain text first).

## 3. Architecture

```text
Cloud Scheduler (daily, Europe/Berlin)
         |
         v
Cloud Run Job: discover-and-evaluate
  ├─ source adapters: Adzuna / Greenhouse / Lever
  ├─ source policy & rate limiter
  ├─ canonicalize + content extraction
  ├─ upsert and deduplicate
  ├─ hard eligibility & uncertainty checks
  ├─ LLM matcher (strict JSON schema)
  ├─ shortlist builder + draft policy
  └─ generation requests for qualified matches
         |                    |
         v                    v
      Firestore             LLM provider
         |
         +-------------> Cloud Run API (Firebase Auth)
                                 |
                            React dashboard
                                 |
                        Gmail OAuth + draft service
                                 |
                         Gmail Drafts (UNSENT)

Private Cloud Storage: original CV, optional generated attachments
Secret Manager: API keys, Gmail OAuth refresh token
Cloud Logging / Monitoring: per-run structured metadata
```

### Responsibility split
- **Cloud Run Job:** batch fetch, normalize, rank, package-prepare; can call a separate Gmail-draft-writing module for jobs meeting exact policy.
- **Cloud Run API:** OAuth callback, signed CV-upload flow, profile edits, listing, flags, manual re-evaluation and retry. Auth required for all non-OAuth routes.
- **React app:** one-person dashboard; show source evidence, score and confidence, controls, and safe Gmail entrypoint.
- **Firestore:** normalized posting data, review snapshots, pipeline progress, and application states.
- **Cloud Storage:** private originals and attachments; do not put CV bytes in Firestore.
- **Secret Manager:** least-privilege access to keys/tokens; separate service identities for fetcher and Gmail writer if practical.

No queue in v1: use a bounded sequential/batched run; add Cloud Tasks only after volume or retry isolation justifies it.

## 4. Source strategy

| Source | Intended use | Constraints | MVP status |
|---|---|---|---|
| Adzuna Search API (DE) | Broad discovery: Berlin / German remote jobs | Credential, quotas, terms, attribution; results may lack full details | **Primary**, conditional on access |
| Greenhouse Job Board API | Selected companies | GET public, each employer board/token is a separate source | **Primary**, curated board list |
| Lever Postings API | Selected companies | Company/site-specific; EU and global API regions | **Primary**, curated employer list |
| Bundesagentur jobsuche via community documentation | Broad local discovery | Unofficial/unsupported interface; legal/operational reliability requires review | **Experimental**, feature flag only |
| Career page HTML/RSS | Retail and hostel coverage | Robots/terms, rate limits, and site-specific maintenance | **Later**, approved domains only |
| Email job alerts | Additional leads | Requires Gmail read or separate subscribed mailbox; consent | **Later** |

Primary documentation:
- Adzuna: https://developer.adzuna.com/docs/search and https://developer.adzuna.com/docs/terms_of_service
- Greenhouse: https://docs.greenhouse.io/job-board
- Lever: https://github.com/lever/postings-api
- Community Bundesagentur interface: https://github.com/bundesAPI/jobsuche-api

**Important:** Adzuna's default terms permit personal research but contain quotas, attribution obligations and restrictions for other/commercial uses. Confirm proposed use and data-retention rights before enabling its connector; do not interpret a public endpoint as blanket authorization to reuse listings.

### Initial search streams

```yaml
search_streams:
  berlin_onsite:
    location: "Berlin, Germany"
    keywords:
      - "student assistant"
      - "working student"
      - "part time english"
      - "retail assistant"
      - "sales assistant"
      - "customer service english"
      - "hostel receptionist"
      - "event staff"
      - "minijob english"
  remote_germany:
    country_of_work: "Germany"
    keywords:
      - "remote customer support"
      - "working student remote"
      - "remote data annotation"
      - "part time content moderator"
      - "remote virtual assistant"
      - "student support remote"
```

Search phrases are **recall-oriented** discovery terms, not proof of role suitability. Do not conclude English is allowed because the advertisement is written in English.

### Source adapter contract

```ts
export interface JobSource {
  id: 'adzuna' | 'greenhouse' | 'lever';
  fetch(input: {
    since?: string;
    cursor?: string;
    limit: number;
  }): AsyncIterable<RawJob>;
}

export interface RawJob {
  source: string;
  sourceJobId: string;
  sourceUrl: string;
  companyName: string;
  title: string;
  description?: string;
  locationText?: string;
  publishedAt?: string;
  lastUpdatedAt?: string;
  applicationUrl?: string;
  contactEmail?: string;
  rawPayload?: unknown; // retention strictly per source policy
}
```

### Collection defaults (configurable, not facts)
- 1 run/day, local scheduling `Europe/Berlin` to handle DST.
- 30-day freshness window for initial backfill; subsequent incremental pulls.
- Request timeout 15s; limited retries for 429/5xx using exponential backoff and jitter; obey Retry-After.
- Cap per-run requests and candidates; persist adapter cursors only after successful page processing.
- Source health tracked independently, so one failed source does not prevent the others.
- Check original posting before drafting if the previous verification is stale.

## 5. Normalized data model

Firestore collections for a **single candidate**:

```text
candidateProfiles/{candidateId}
cvAssets/{assetId}
sources/{sourceId}
sourceCursors/{sourceId}
jobs/{canonicalJobId}
jobEvaluations/{canonicalJobId_profileVersion_modelVersion}
applications/{candidateId_canonicalJobId}
pipelineRuns/{runId}
```

Sample schema:

```ts
type Evidence<T> = {
  value: T | null;
  status: 'explicit' | 'inferred' | 'unknown' | 'conflicting';
  sourceQuote?: string;       // short verified text from listing
  sourceField?: string;
};

type EmploymentType =
  | 'minijob'
  | 'part_time'
  | 'working_student'
  | 'short_term'
  | 'freelance'
  | 'full_time'
  | 'unknown';

type WorkMode = 'onsite' | 'hybrid' | 'remote' | 'unknown';

type ApplicationChannel =
  | { type: 'email'; verifiedEmail: string; verificationSource: string }
  | { type: 'ats'; verifiedUrl: string }
  | { type: 'unknown' };

interface JobRecord {
  id: string;
  sourceRefs: Array<{ source: string; sourceJobId: string; sourceUrl: string }>;
  company: string;
  title: string;
  descriptionText: string;
  location: Evidence<string>;
  workMode: Evidence<WorkMode>;
  germanyRemoteAllowed: Evidence<boolean>;
  languageRequirements: Evidence<string[]>;
  germanRequired: Evidence<boolean>;
  employmentTypes: Evidence<EmploymentType[]>;
  hoursPerWeek: Evidence<number>;
  payPerHourEur: Evidence<number>;
  applicationChannel: ApplicationChannel;
  publishedAt?: string;
  lastCheckedAt: string;
  contentHash: string;
  sourcePolicyId: string;
  status: 'active' | 'stale' | 'closed' | 'unknown';
}

interface FitEvaluation {
  jobId: string;
  candidateProfileVersion: number;
  evaluatorVersion: string;
  eligibility: 'eligible' | 'needs_review' | 'rejected';
  blockers: string[];
  fitScore: number;               // 0..100, relevance NOT hiring probability
  evidenceConfidence: number;     // 0..1
  goodReasons: Array<{ reason: string; evidence: string }>;
  unknowns: string[];
  missingRequirements: string[];
  summary: string;
}

type ApplicationStatus =
  | 'identified'
  | 'shortlisted'
  | 'needs_review'
  | 'package_ready'
  | 'draft_created'
  | 'applied_manually'
  | 'rejected_by_candidate'
  | 'expired';

interface ApplicationRecord {
  candidateId: string;
  jobId: string;
  status: ApplicationStatus;
  latestProfileVersion: number;
  generatedVersion?: string;
  gmailDraftId?: string;
  gmailDraftCreatedAt?: string;
  applicationUrl?: string;
  applicantMarkedSentAt?: string;
  events: Array<{ at: string; type: string; details?: string }>;
}
```

### Deduplication
1. Normalize/canonicalize the source URL (drop known tracking query parameters).
2. Primary key: `sha256(source + ':' + sourceJobId)`; per-source identity is stable.
3. Cross-source clustering: same employer, normalized title, location, and similarity of description/application URL.
4. When uncertain, link suspected duplicates rather than merge automatically.
5. Store posting content hash and evaluation/profile versions. Reprocess only on meaningful changes.
6. Preserve the canonical original posting and all source references.

## 6. Candidate profile from CV

### Processing
1. Candidate uploads PDF; malware/type/size checks before parsing.
2. Extract text via a trusted parser. If parsing fails, report failure; OCR only as separately approved fallback.
3. LLM generates structured factual profile, with page or extracted-text evidence for each fact.
4. UI displays extracted values for correction and approval; only approved profile becomes `active`.
5. Store immutable profile versions; re-evaluate existing shortlisted jobs after meaningful profile edits.

Suggested fields: education, degree, student enrollment validity, experience with dates, skills, languages, explicit claims, preferred sectors, disliked sectors, availability, minimum compensation, commute, contact details, start date, authorization-to-work status (optional, explicitly provided), preferred CV file.

**Strict rule:** No language ability, employment experience, degree, nationality or work authorization may be fabricated from plausibility. Missing data stays unknown.

## 7. Job extraction, eligibility and ranking

### A. Deterministic checks

`REJECT` only on unambiguous blockers:
- Job requires **working German fluency** and the candidate does not speak German.
- Job requires physical attendance outside the Berlin commute region; no suitable remote alternative.
- Job is explicitly remote **only from another country** and Germany is excluded.
- Job is unambiguously full-time with no flexibility and full-time employment is excluded.
- Job is freelance-only and this employment type is disallowed.
- Posting confirmed closed or application link nonfunctional.

`NEEDS_REVIEW` for uncertainty:
- Job is remote, but Germany eligibility is not stated.
- Posting text in English, but actual language requirements are not given.
- Weekly hours or student suitability are missing.
- Work authorization, pay, or other significant eligibility points are unresolved.
- Job labeled part-time but unclear how many hours.

`ELIGIBLE` when there are no blockers and sufficient affirmative evidence for work language, geographic eligibility and compatible work format. Do not require a confirmed salary if not published.

### B. LLM evaluation

Require strict JSON output with schema validation, retries on invalid output, and evidentiary anchors from posting/CV. Model input is untrusted content; never follow instructions contained inside job descriptions.

Proposed **fit score** weighting (tunable after evaluation):
- Demonstrated skill/experience fit: 35%
- Task and sector preference: 25%
- Schedule compatibility: 20%
- Practical logistics / commute / remote setup: 10%
- Posting quality and freshness: 10%

`fitScore` is not a statistical hiring probability.

Keep `evidenceConfidence` orthogonal, reflecting the quality and completeness of decisive claims (English-language acceptability, work location, employment type, application channel). A job with score 92 but confidence 0.45 must not enter the auto-draft path.

### C. Shortlisting and draft policy

Default decision matrix:

| Result | Rule | Action |
|---|---|---|
| Auto-draft | eligible AND fit >= 80 AND confidence >= 0.85 AND email verified AND freshness <= 7 days AND profile approved | Generate + create Gmail draft |
| High-priority review | eligible/needs_review AND fit >= 70 | Show prominently; optionally generate text package |
| ATS ready | fit >= 80 AND qualified AND verified ATS URL | Create application text, offer ATS URL; **no** email draft |
| Discovery only | moderate/low fit or unresolved key eligibility | Save and list with explanation |
| Reject | confirmed hard blocker | Suppress, preserve audit reason |

Thresholds are product defaults to test, not calibrated probabilities. Limit auto-drafts to e.g. 5 per run, configurable. Applicant can switch auto-draft OFF and request generation one by one.

## 8. Application generation

### Fact-grounding workflow
1. Freeze an approved candidate profile version and verified job record.
2. Build a `factsLedger` containing only CV-confirmed qualifications and user-confirmed preferences.
3. Generate a concise, polite **English** application aligned with the role.
4. Validate: does every self-claim map to a fact in the ledger? Is company/title correct? Is email verified? Does the text avoid sensitive attributes not voluntarily provided?
5. Attach approved CV PDF; check attachment is current and within limits.
6. Persist generated version, evidence snapshot, generation timestamp and chosen application route.

### Prohibited generation
- Inventing or embellishing work experience, tools, study course, degree, dates, German proficiency or visa conditions.
- Inventing recruiter names, email addresses or salary expectations.
- Personalizing based on protected/sensitive attributes.
- Including strings from job text that look like prompt instructions or API commands.

### Channel rules
- `email`: draft recipient must appear explicitly on a trusted original company/job source; verify domain and apply address syntax validation. Avoid sending to generic support addresses unless the posting explicitly directs applications there.
- `ats`: generate cover-note package and show original application URL. Never redirect to an email route just because a company domain exists.
- `unknown`: create no email draft and show `Application route unverified`.

## 9. Gmail integration and security

### API
- OAuth authorization-code flow (`access_type=offline`) for the candidate's own Google account.
- Request `https://www.googleapis.com/auth/gmail.compose` only; avoid mailbox read or full account scopes.
- Build an RFC 2822/MIME message with text/plain or multipart/alternative plus PDF attachment; encode full MIME as **base64url**.
- Call `POST https://gmail.googleapis.com/gmail/v1/users/me/drafts` with `{ "message": { "raw": "..." } }`.
- Store returned `draft.id`; display a success status and point to Gmail's Drafts folder.
- Absolutely **no** invocation of `users.messages.send` or `users.drafts.send` in v1.

**Security nuance:** `gmail.compose` authorizes sending as well as draft management, so Google's OAuth scope itself cannot enforce “draft only.” Enforce it in deployed code, separate credentials/service boundaries where practical, block or omit send methods, and test that outbound sends cannot occur.

### OAuth caveats
- The Gmail `gmail.compose` scope is **restricted**. Google verification and potentially security assessment may be required for a public product. Assess personal-use/testing exemptions for this one-person app rather than assuming them.
- OAuth consent screens configured as **External / Testing** issue refresh tokens that usually expire in **7 days** for this kind of scope. Document this early; test reconnect UX before depending on unattended daily runs.
- Keep refresh tokens encrypted in Secret Manager, readable only by the draft-writer identity; do not log tokens or email content.
- Implement disconnect/revoke and clear token references.

Docs:
- https://developers.google.com/workspace/gmail/api/guides/drafts
- https://developers.google.com/workspace/gmail/api/auth/scopes
- https://developers.google.com/identity/protocols/oauth2
- https://developers.google.com/identity/protocols/oauth2/production-readiness/restricted-scope-verification

### Draft idempotency and race control
- Reserve an `ApplicationRecord` in a Firestore transaction using `(candidateId, jobId, profileVersion)` as dedupe key.
- Mark generation as `pending` with a run ID before external request; workers skip existing pending or completed package where valid.
- Gmail draft creation and Firestore write are not transactional; on partial failure, record an ambiguous state and require reconciliation/manual review instead of blindly retrying and duplicating Gmail drafts.
- Never rewrite an existing Gmail draft that a human may have edited without an explicit request.
- Since Gmail is not read in v1, **do not** claim the draft was sent or track its real send state automatically. Candidate manually marks applied.

## 10. APIs, dashboard, and user journey

### Minimal API surface

```text
POST   /api/cv/upload-url
POST   /api/cv/confirm
GET    /api/profile
PATCH  /api/profile
GET    /api/jobs?status=&minFit=&workMode=&source=&pageToken=
GET    /api/jobs/:id
POST   /api/jobs/:id/re-evaluate
POST   /api/jobs/:id/create-application-package
POST   /api/jobs/:id/create-gmail-draft
PATCH  /api/applications/:id
GET    /api/runs
GET    /api/integrations/gmail/status
GET    /api/oauth/google/start
GET    /api/oauth/google/callback
POST   /api/integrations/gmail/disconnect
```

All user APIs are authenticated and authorized to the one candidate. OAuth `state` + PKCE where applicable, secure server callback handling, CSRF defense, rate limits and audit logs.

### UI views
- **Today:** number discovered / shortlisted / drafts ready, connector failures and last successful run.
- **Jobs:** sortable list of job, company, mode, employment category, source, date, fit score and evidence confidence.
- **Detail:** original URL, relevant excerpt/evidence, reasons for match, mismatches, unknowns and verified application channel.
- **Applications:** package, Gmail status, manual `applied/ignored` buttons, notes.
- **Settings:** profile and CV review, search streams, draft automation toggle, Gmail connection, data deletion and run limits.

### Candidate flow
1. Upload and approve CV/profile.
2. Connect Gmail with explicit informed authorization (or continue in discovery-only mode).
3. Review daily shortlist.
4. Open prepared Gmail draft or ATS package.
5. Applicant personally sends/submits.
6. Mark application as applied manually; annotate outcomes.

## 11. Operational safeguards

### Source compliance and safe fetching
- Track a source registry: rights/terms, rate quotas, last review date, permitted fields, deletion TTL, attribution requirements.
- Request company or job documents only through approved endpoints.
- Treat source content as **untrusted input**, never as system instructions.
- Do not crawl linked pages indiscriminately, evade bot protection, or reuse forbidden data.
- Enforce egress target allowlist for HTTP fetchers and deny metadata/cloud-internal addresses to avoid SSRF.
- Sanitize extracted HTML before UI display and parse structured text where possible.

### Privacy
- Explicit candidate consent to processing and Gmail actions.
- Private CV bucket; no public URLs; access via signed short-lived URLs.
- Collect only relevant employment data; keep data deletion and export paths.
- Configurable retention for raw posting snapshots, generated application text, logs and candidate data; respect provider source terms.
- Do not send entire CV or sensitive IDs unnecessarily to the LLM. Redact contact details unless necessary for the output.
- Avoid personal data in telemetry and exceptions.

### Monitoring
- Log structured metrics per run: fetched, new, duplicate, rejected, needs_review, eligible, LLM-evaluated, packages, drafts, API errors, cost/tokens.
- Alert on: zero results across all sources, repeated authentication failures, quota exhaustion, malformed model JSON, duplicate-draft risk, Gmail 401, and pipeline not completing.
- Use stable prompt/model/evaluator versions in every evaluation.

### Budget guards
- Example initial caps: max 400 raw listings and 40 LLM evaluations per day; max 5 auto-drafts per run.
- Apply deterministic filtering and near-duplicate detection before model calls.
- Alert on token budget overruns; fall back to discovery-only if a paid dependency fails.

## 12. Testing and evaluation

### Unit tests
- Source normalization and URL canonicalization.
- Berlin location recognition and remote-country constraints.
- German-required vs German-optional classification.
- Employment-type normalization, including working-student/part-time ambiguity.
- Duplicate identification, state transitions, rank calculations and invalid model output.
- Candidate fact-grounding validator.

### Integration tests
- Mock each source and verify pagination/rate-limit behavior.
- Firestore emulator: transactions and idempotency under overlapping scheduled runs.
- Gmail stub: correct recipient, subject, MIME encoding, CV attachment, metadata recording.
- **Assert no send route/method exists**; static CI check for Gmail send methods.
- Reauthorization when OAuth refresh token expires.
- Forced crash immediately after successful draft creation: system must not silently create duplicates on retry.

### Evaluation set
Create a human-labeled fixture of at least 50 varied job postings with examples of:
- Explicit German requirement, implied language only, clear English acceptance.
- Berlin-based on-site, Germany-eligible remote, remote restricted to elsewhere.
- Minijob, working-student, part-time, full-time, freelance-only, unknown type.
- ATS-only, explicit verified recruitment email, ambiguous recruitment channel.
- Duplicate repostings, expired jobs, malicious embedded prompt text.

Target acceptance metrics for **the labeled fixture**, not promises about the real market:
- 0 auto-drafts for a known hard blocker.
- 0 auto-drafts to unverified or guessed recipients.
- 0 false statements about candidate work history/languages in evaluated generated drafts.
- >= 90% precision on automatically short-listed `eligible` examples (requires manual test labels).
- Idempotent restart does not cause duplicate packages or unreviewed additional Gmail drafts.
- > 95% successful processing of valid sample postings from enabled sources.

## 13. Implementation plan / milestones

### Milestone 0 — One-day proof of feasibility (before deeper build)
- Obtain Adzuna development credentials; test Germany/Berlin result coverage and terms.
- Identify five employer Greenhouse/Lever board tokens; fetch sample posts.
- Create GCP project, enable Gmail API, and create an OAuth test client.
- Connect the candidate's Google account with consent; create a **single test Gmail draft addressed to the candidate** with dummy text and a test attachment (never send).
- Check OAuth refresh-token behavior and source consistency.

**Exit criterion:** at least one viable job source, authentic postings, and a valid draft created and visible in Gmail. If OAuth policy blocks, deliver discovery-only MVP first.

### Milestone 1 — Discovery pipeline
- `JobSource` interface and Adzuna/Greenhouse/Lever adapters.
- Job normalization, deduplication, versioned snapshots and logging.
- Daily Cloud Scheduler → Cloud Run Job execution.
- Minimal Firestore-backed listing UI.

**Exit criterion:** repeatable daily execution and traceable, nonduplicated discoveries.

### Milestone 2 — Profile and matching
- Secure PDF upload, text parsing, factual extraction, UI human approval.
- Hard filters, `NEEDS_REVIEW` logic, LLM strict JSON evaluation.
- Evidence and confidence UI, manually labeled 50-posting fixture.

**Exit criterion:** reviewers understand why each job passes/fails; benchmark thresholds met.

### Milestone 3 — Application assistant
- Template prompts and fact grounding.
- Channel verification and applicant package generation.
- Gmail OAuth token handling, MIME with CV attachment, draft creation.
- Idempotency and failed/retry reconciliation.

**Exit criterion:** end-to-end discovery → fit → Gmail draft / ATS package with no transmissions.

### Milestone 4 — Hardening and handover
- Privacy controls, observability, failure alerts, source compliance record, cost caps.
- Document deployment, secrets rotation, reconnect, incident handling, and manual workflow.

**Exit criterion:** can run unattended while limiting side effects and allowing safe recovery.

## 14. Suggested repository structure

```text
job-hunter/
├── apps/
│   ├── web/                       # React + Firebase Hosting
│   ├── api/                       # Cloud Run HTTP API + OAuth callbacks
│   └── worker/                    # Scheduled Cloud Run Job
├── packages/
│   ├── domain/                    # Zod schemas, types, rules
│   ├── sources/                   # Adapters, source policy registry
│   ├── matching/                  # Filters + LLM evaluator
│   ├── applications/              # Fact ledger, templates, routing
│   ├── gmail/                     # Draft-only integration
│   ├── persistence/               # Firestore repositories
│   └── observability/             # Structured logging/metrics
├── tests/
│   ├── fixtures/jobs/
│   ├── integration/
│   └── evaluation/
├── infra/                          # Terraform or gcloud deployment scripts
├── docs/
│   ├── source-policy.md
│   ├── runbook.md
│   ├── threat-model.md
│   └── evaluation.md
└── pnpm-workspace.yaml
```

## 15. Decision log and risks

| Decision / risk | Choice for MVP | Rationale |
|---|---|---|
| Agent framework | Do not use | Deterministic workflow is more testable, cheaper and safer |
| Vector database | Do not use | Small job set + structured profile is sufficient |
| Real-time crawling | Do not use | Daily freshness is adequate and reduces API costs |
| Gmail sending | Disabled by product design | Human retains final control; `gmail.compose` nevertheless also allows send |
| Unofficial Bundesagentur API | Off by default | No official contract or stability guarantees |
| Job not clearly English-friendly | Needs review | Written-in-English is not proof of spoken-language acceptability |
| Remote unspecified country | Needs review | 'Remote' alone does not mean remote from Germany |
| Gmail OAuth verification | Early feasibility check | Restricted scope may materially affect deployment |
| Automatic success feedback | Deferred | Would require mailbox access or human marking |
| Student's nationality / immigration status | Not assumed | Must not infer from the CV or relationship; seek explicit relevant information |

## 16. Definitive MVP acceptance criteria

- [ ] At least two enabled, compliant source adapters produce normalized vacancies.
- [ ] Daily Cloud Scheduler-triggered execution works in the intended time zone.
- [ ] Idempotent upserts and re-runs do not duplicate job records.
- [ ] Candidate approves extracted CV facts before matching/application generation.
- [ ] Language, Germany-remote and work-format hard gates are conservative and explainable.
- [ ] Each scoring record includes evaluator version, score, confidence and evidence.
- [ ] Verified direct email produces a Gmail draft with correct attachment and recipient.
- [ ] ATS-only jobs produce packages and original application links, not fabricated recipient addresses.
- [ ] No automatic send or ATS submission is implemented; tests enforce this.
- [ ] No generated email contains unverifiable claims from the candidate's background.
- [ ] OAuth disconnect, token-expiry recovery, source failure and ambiguous draft creation are handled safely.
- [ ] User can manually mark each application status.
- [ ] Cost and run diagnostics are visible to the operator.

## 17. Official reference links

- Gmail draft endpoint: https://developers.google.com/workspace/gmail/api/reference/rest/v1/users.drafts/create
- Gmail drafts guide: https://developers.google.com/workspace/gmail/api/guides/drafts
- Gmail OAuth scopes: https://developers.google.com/workspace/gmail/api/auth/scopes
- OAuth server-side flow: https://developers.google.com/identity/protocols/oauth2/web-server
- OAuth testing token expiry: https://developers.google.com/identity/protocols/oauth2
- Restricted scope verification: https://developers.google.com/identity/protocols/oauth2/production-readiness/restricted-scope-verification
- Cloud Run scheduled jobs: https://docs.cloud.google.com/run/docs/execute/jobs-on-schedule
- Adzuna docs: https://developer.adzuna.com/docs/search
- Adzuna ToS: https://developer.adzuna.com/docs/terms_of_service
- Greenhouse job board API: https://docs.greenhouse.io/job-board
- Lever postings API: https://github.com/lever/postings-api
- Minijob wages and earnings: https://www.minijob-zentrale.de/DE/die-minijobs/arbeitsrechte-im-minijob/mindestlohn/mindestlohn_node.html
- International students' work conditions: https://www.make-it-in-germany.com/en/study-vocational-training/studies-in-germany/work

---

**Next practical implementation action:** Execute Milestone 0 with dummy/test data. Verify one admissible Germany/Berlin job source and one unsent Gmail draft before investing effort in matching prompts or a dashboard.
