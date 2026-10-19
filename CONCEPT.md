# Job Search: current MVP concept

- Status: agreed product baseline; technical feasibility not yet validated
- Updated: 2026-10-19
- Pilot: one student based in Berlin; English as working language
- V1: one-person discovery and application assistant, including CV and manual-copy packages
- V2: multi-user use and user-managed search orders/configuration

## Document authority

This document records the current baseline. The [original technical proposal](berlin_job_research_pipeline_mvp_spec.md)
is preserved unchanged as detailed design input, not an implementation contract.
This document and accepted ADRs supersede it where they differ. Unresolved details
are tracked in [open questions](docs/OPEN_QUESTIONS.md); delivery state is tracked in
[the plan](docs/PLAN.md). User decisions take precedence over these documents.

## Problem and outcome

Finding suitable student work is repetitive: listings are duplicated, language and
remote restrictions are unclear, and preparing an application takes effort.
The tool discovers relevant opportunities, explains suitability using evidence,
and prepares applications for the applicant to review and send.

Success means a repeatable daily shortlist of new, traceable opportunities and
truthful application packages. V1 includes CV processing and reviewable email or
questionnaire application packages with manual copying. Discovery remains usable
during integration failures, but discovery alone does not complete V1. A shortlist is not a promise of a job offer
or a legal assessment of the candidate's right to work.

## Pilot and later reuse

The user agreed to a one-person pilot with explicit ownership from the start.
Use an authenticated owner identity and candidate ID for private records. Profiles,
profile versions, CV assets, evaluations, applications and authentication records must
never be selected through an unscoped global “current candidate.” Shared source
listings may be separate from private assessments and annotations.

For the pilot, one account has one active candidate profile. Languages, location,
availability and work preferences are profile/configuration
values, not global assumptions. The first interface can be provisioned privately.
Cross-owner denial is tested with synthetic users even during the one-person pilot.

Public signup, account administration, invitations, shared profile access, billing,
and a general service for multiple users are deferred to V2. Explicit ownership reduces
later restructuring; it does not complete multi-user onboarding, authentication readiness,
capacity planning, or privacy obligations. See [ADR 0002](docs/adr/0002-pilot-and-ownership.md).

V1 uses operator-configured search streams and one daily schedule. The candidate
can correct profile facts and preferences; creating, activating, pausing, and
scheduling separate search orders is V2. Profile personalization in V1 does not
require a general search-order management interface.

## Search and eligibility

- Search Berlin on-site/hybrid roles and remote roles explicitly compatible with
  working from Germany. Neither stream is secondary by default.
- Include Minijobs, part-time, working-student, and short-term employment.
  Freelance-only and inflexible full-time roles are excluded from the pilot.
- Pilot working language is English. Do not infer German fluency or other profile
  facts. Allow later profiles to express their own languages and preferences.
- Reject on confirmed incompatibility; use `needs_review` for missing or conflicting
  decisive evidence. English listing text and an unspecified remote location are
  insufficient evidence of suitability.
- Missing salary alone is not a rejection. Hours, location, language requirements,
  and work authorization uncertainty must remain visible and prevent a ready-to-use
  package where decisive conditions are unresolved.
- Employment limits and legal eligibility are not decided by an LLM. Verify current
  official rules before implementing date-dependent checks; no legal thresholds
  are adopted from the original proposal without that validation.

Candidate inputs still needed: approved CV facts, languages, schedule, start date,
commute, sectors, compensation preferences, and relevant work restrictions supplied
by the candidate. Do not assume nationality, residence status, or authorization.

## V1 scope

1. Secure PDF CV upload, factual extraction, correction, and explicit approval of
   an immutable profile version before personalized matching or generation.
2. Structured source adapters plus web search and targeted public-page extraction,
   including smaller employers outside major platforms; normalized postings,
   traceable references, conservative deduplication, revisions, and source health.
3. Deterministic eligibility checks followed by schema-validated LLM assessment;
   fit score and evidence confidence remain separate and explainable.
4. A login-protected, table-first UI sorted by match score, with title, employer,
   location/remote, employment type, freshness, and original application links.
   Provide concise evidence/unknowns, profile correction, a “View application draft”
   action opening the shared review/copy dialog, and manual application status.
5. A daily bounded pipeline, run diagnostics, isolated source failures, and
   restart/retry behavior that avoids duplicate processing and side effects.
6. English application packages using only approved candidate facts and verified
   job details: email subject/body or source-evidenced questionnaire answers, with
   per-answer copying. The applicant alone transfers text and approved attachments.
7. Authentication recovery, ownership enforcement, private storage, retention,
   export/deletion, cost controls, and operating documentation.

Delivery is incremental. Discovery, matching, and application slices are internal
V1 milestones. CV processing and reviewable application packages are required for
the V1 release; an integration-blocked discovery slice is not a finished V1.

## Application controls

The applicant alone sends or submits. The product prepares text for review and
copying; it never sends email, submits applications, fills forms, writes browser
forms, guesses recruiters or monitors a mailbox. A manual applied status is the
applicant's report, not proof of delivery or submission.

The table action “View application draft” opens a shared dialog. Email applications
show subject and body; questionnaire applications show stable internal field IDs,
source-evidenced question text and proposed answers, each with its own copy action
and original form link. Internal IDs do not claim to be employer DOM/source IDs.
Candidate claims must trace to approved immutable profile facts and job evidence.
Missing facts use `needs_input` with no invented answer; an unknown start date stays
unanswered. Consents, signatures and declarations use `applicant_action_required`
and are completed by the applicant. Generation never impersonates that action.

Use a verified application channel from the original posting or trusted company
source. Unknown channels remain review leads; never invent a recipient or form URL.

Preserve candidate/job/evaluator/package versions and evidence. Regeneration creates
a distinct version and must preserve user edits. Review the exact full package
content before use; a reviewed hash identifies that content, not a later revision.
Decisive unresolved eligibility prevents a ready-to-use package. No automatic
mailbox draft creation or automatic copying/submission is part of the workflow.

## Technical direction and feasibility

The proposed stack is TypeScript, React, Cloud Run Job/API, Firebase Auth/Hosting,
Firestore, private Cloud Storage, Secret Manager, and a replaceable LLM adapter.
A GCP/Firebase project has been designated privately with an EU preference; read-only
metadata checks failed, so API enablement, IAM, ADC and actual billing remain
unverified. Brave credentials and the exact storage-rights plan remain missing.
GCP-managed Gemini is the accepted first LLM route, with OpenRouter as an alternative behind the same
boundary; the exact model/endpoint remains unselected. See
[provider options and cost model](docs/PROVIDERS_AND_COSTS.md).

Prefer a deterministic pipeline; no agent orchestration framework, vector database,
message bus, or unrestricted crawler in v1. The proposal's package tree is a guide;
create packages when a delivery slice needs them rather than empty scaffolding.

Use three discovery paths in V1: structured job APIs/boards, a web-search provider,
and bounded fetching of employer career pages and linked vacancies. Smaller local
businesses, hostels, retailers, cultural venues, and university/local listings are
explicit coverage targets. A vacancy need not appear on a large platform to enter
the pipeline; a generic careers page without an actual vacancy is only a lead.

Adzuna, Greenhouse, and Lever remain candidates, not verified integrations. Brave
is a web-search candidate, with storage/AI-use terms and coverage to validate.
Google Custom Search JSON API is not the default for a new implementation: Google's
documentation says it is closed to new customers and ends on January 1, 2027.
See [source discovery](docs/SOURCE_DISCOVERY.md) for dated official references,
separate search/fetch/extraction stages, and the source-policy questions.

The accepted initial extraction approach is controlled HTTP retrieval plus Cheerio. Compare
Playwright rendering with Firecrawl only where static extraction misses useful
vacancies, and choose at most one additional fallback based on measured benefit.
Cheerio has an offline-tested bounded implementation; two documentation-only HTTP
diagnostics do not establish vacancy extraction accuracy.
See the delegated
[extraction market research](docs/EXTRACTION_OPTIONS.md).

The user explicitly requests coverage beyond robots-based exclusions. Do not
silently narrow this to API-only or previously registered domains. ADR 0005 makes
robots metadata non-blocking by itself for leads and public-page retrieval; source
terms, storage rights and actual access/network/resource controls remain separate.
Apply the [accepted public-fetch policy](docs/adr/0005-bounded-experiment-and-public-fetch-policy.md).
No universal retrieval guarantee, credential bypass, CAPTCHA evasion, or unlimited
retry/traffic mode is part of V1. Unretrieved leads remain visible with a link and
unknown evidence; they cannot trigger unsupported matches or draft generation.

A Gmail address is used exclusively for Firebase Auth login. Gmail API access,
mailbox OAuth scopes, mailbox credentials and mailbox integration are outside the
current V1/G3 contract; no later integration is promised. See
[ADR 0010](docs/adr/0010-manual-application-packages.md).

## Acceptance and measurement

V1 is complete only when the following have recorded evidence:

- [ ] At least two permitted source adapters produce normalized jobs; one viable
      source is enough to pass the initial feasibility gate, not V1 acceptance.
- [ ] Web-search discovery and direct-page extraction produce verifiable vacancies
      outside the structured-source set, with query/URL provenance and source policy.
- [ ] Unavailable pages, generic career leads, and confirmed vacancies have distinct
      states; extracted facts and application channels are verified against source content.
- [ ] A daily Europe/Berlin schedule runs with bounded work and visible diagnostics.
- [ ] Repeated/overlapping runs avoid duplicate canonical jobs and application
      packages; uncertain cross-source duplicates are linked for review.
- [ ] Candidate extraction is reviewed and approved before personalized assessment;
      profile changes retain immutable versions and invalidate affected results.
- [ ] Confirmed blockers, missing evidence, and supported eligibility are distinct;
      each assessment records version, score, confidence, and evidence.
- [ ] A human-labeled fixture of at least 50 varied postings includes language,
      Germany-remote, employment, expiry, duplication, and malicious-content cases.
- [ ] The labeled fixture has >= 90% eligible-shortlist precision and > 95% successful
      processing of valid supported samples; counts and label definitions are reported.
- [ ] Evaluated packages contain no unsupported candidate claims; no known blocker
      or unverified/invented recipient can enter a ready-to-use package.
- [ ] “View application draft” opens one shared review/copy dialog with email
      subject/body or questionnaire answers mapped by internal IDs to source-evidenced questions; each
      answer can be copied separately and missing facts remain unanswered.
- [ ] No send/submission, autofill or browser-form-write path exists; checks enforce
      the policy and consents/signatures/declarations require applicant action.
- [ ] Authentication expiry/revocation, source failure and interrupted generation
      have verified recovery paths without silent package replacement.
- [ ] Candidate can manually mark applied/ignored without implying delivery/submission.
- [ ] The authenticated job table is sorted by match score, explains decisive
      unknowns, opens original application URLs, and exposes prepared text/drafts.
- [ ] Unauthorized users cannot read or mutate another owner's private records,
      files, evaluations or applications.
- [ ] Data export/deletion, retention, privacy controls, and cost/run diagnostics
      are implemented and documented before unattended operation with real data.

Numerical targets measure the labeled fixture, not the whole job market. The first
real-world coverage benchmark is in [FEASIBILITY.md](docs/FEASIBILITY.md); its results
do not promise recurring market-wide coverage or a fixed daily shortlist volume.

## V2 direction

Make the tool available to additional users with onboarding, per-owner profiles,
CVs, authentication, quotas, and data lifecycle. Add user-managed search orders with
individual keywords, geography, employment preferences, frequency, and active/paused
state. These are a V2 direction, not a completed design or a V1 dependency.
See [ADR 0003](docs/adr/0003-release-scope-and-web-discovery.md).

## Outside V1

Automatic sending/submission, cold outreach, CAPTCHA bypass, uncontrolled crawling,
public multi-user onboarding, user-managed search orders, payments, reply parsing,
calendar automation, application success prediction, trained ranking models, and
default cover-letter PDF templating.

## Immediate next outcome

G1 is complete as a concept and [bounded feasibility brief](docs/FEASIBILITY.md).
G2's offline TypeScript foundation is complete with clean-checkout verification,
synthetic boundary tests, Biome, build, secret scanning and configured CI; see
[the delivery evidence](docs/PLAN.md#g2-development-foundation--complete).
G3's bounded feasibility experiment is in setup; live observations have not
started. [Current readiness](docs/G3_SETUP.md) distinguishes local control tests
from the source/model/manual-package evidence still needed. Offline C corpus and
validation work is in progress; no model observations or profile approvals exist.
Operator access, provider conditions and model/region remain live entry checks.
G2 authorizes no subscriptions, deployment or real CV use.
