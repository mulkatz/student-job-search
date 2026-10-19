# Job Search: current MVP concept

- Status: agreed product baseline; technical feasibility not yet validated
- Updated: 2026-10-19
- Pilot: one student based in Berlin; English as working language
- Direction: reusable by other people later, without public onboarding in the pilot

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
truthful application packages. Gmail drafts are a later part of the full MVP;
discovery remains useful without them. A shortlist is not a promise of a job offer
or a legal assessment of the candidate's right to work.

## Pilot and later reuse

The user agreed to a one-person pilot with explicit ownership from the start.
Use an authenticated owner identity and candidate ID for private records. Profiles,
profile versions, CV assets, evaluations, applications, and OAuth credentials must
never be selected through an unscoped global “current candidate.” Shared source
listings may be separate from private assessments and annotations.

For the pilot, one account has one active candidate profile. Languages, location,
availability, work preferences, and mailbox connection are profile/configuration
values, not global assumptions. The first interface can be provisioned privately.
Cross-owner denial is tested with synthetic users even during the one-person pilot.

Public signup, account administration, invitations, shared profile access, billing,
and a general service for multiple users are deferred. Explicit ownership reduces
later restructuring; it does not complete multi-user onboarding, OAuth readiness,
capacity planning, or privacy obligations. See [ADR 0002](docs/adr/0002-pilot-and-ownership.md).

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
  and work authorization uncertainty must remain visible and prevent automatic
  drafting where decisive conditions are unresolved.
- Employment limits and legal eligibility are not decided by an LLM. Verify current
  official rules before implementing date-dependent checks; no legal thresholds
  are adopted from the original proposal without that validation.

Candidate inputs still needed: approved CV facts, languages, schedule, start date,
commute, sectors, compensation preferences, and relevant work restrictions supplied
by the candidate. Do not assume nationality, residence status, or authorization.

## Full MVP scope

1. Secure PDF CV upload, factual extraction, correction, and explicit approval of
   an immutable profile version before personalized matching or generation.
2. Permitted source adapters, normalized postings, traceable source references,
   conservative deduplication, content revisions, and source health.
3. Deterministic eligibility checks followed by schema-validated LLM assessment;
   fit score and evidence confidence remain separate and explainable.
4. A minimal authenticated dashboard for jobs, reasons/evidence, unknowns, source
   links, profile correction, application packages, and manually recorded status.
5. A daily bounded pipeline, run diagnostics, isolated source failures, and
   restart/retry behavior that avoids duplicate processing and side effects.
6. English application text using only approved candidate facts and verified job
   details. A verified recruitment email can receive an unsent Gmail draft with
   the approved CV; an ATS role gets text and the verified original application URL.
7. Disconnect/reconnect, ownership enforcement, private storage, retention,
   export/deletion, cost controls, and operating documentation.

Delivery is incremental. The discovery slice is an intermediate release, not a
claim that the full MVP has passed its application and Gmail acceptance criteria.

## Application controls

The applicant alone sends or submits. There is no automatic email sending, ATS
submission, recruiter email guessing, or mailbox monitoring. Applied status is
manually reported and does not establish Gmail delivery.

Use a verified recruitment channel from the original posting or trusted company
source. Unknown channels cannot create email drafts. Preserve candidate/job/evaluator
versions and evidence used to generate each package. Never overwrite an edited
Gmail draft automatically. An ambiguous draft creation result requires reconciliation
instead of an immediate retry.

Manual generation must work before optional automatic draft preparation is enabled.
The pilot starts with automatic drafting disabled. Later opt-in can use the original
proposal's provisional thresholds (fit >= 80, confidence >= 0.85, fresh verification,
approved profile, no unresolved decisive eligibility, verified email) only after
evaluation. These are policy defaults to validate, not calibrated probabilities.

## Technical direction and feasibility

The proposed stack is TypeScript, React, Cloud Run Job/API, Firebase Auth/Hosting,
Firestore, private Cloud Storage, Secret Manager, and a replaceable LLM adapter.
Prefer a deterministic pipeline; no agent orchestration framework, vector database,
message bus, or unrestricted crawler in v1. The proposal's package tree is a guide;
create packages when a delivery slice needs them rather than empty scaffolding.

Adzuna, Greenhouse, and Lever are source candidates, not verified integrations.
Employer boards need a curated list and may have limited Minijob coverage.
Evaluate actual coverage and permitted use before treating any source as primary.
LinkedIn/Indeed scraping, anti-bot evasion, and unsupported Bundesagentur access are
outside the initial implementation. A new source needs a recorded policy review.

Gmail OAuth scope, verification/testing constraints, refresh behavior, draft access,
and recovery must be checked against current official documentation and a real test.
The intended compose scope also allows sending; tests and code boundaries must
enforce the draft-only design. No OAuth connection or exemption is assumed.

## Acceptance and measurement

The full MVP is complete only when the following have recorded evidence:

- [ ] At least two permitted source adapters produce normalized jobs; one viable
      source is enough to pass the initial feasibility gate, not the full MVP.
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
      or unverified recipient can enter automatic drafting.
- [ ] Email applications produce correct unsent drafts and approved attachments;
      ATS-only roles produce text packages and verified links.
- [ ] No send/submission path exists in the product; checks enforce the policy.
- [ ] OAuth expiry/revocation, source failure, and ambiguous draft creation have
      verified recovery paths without silent duplicate drafts.
- [ ] Candidate can manually mark applied/ignored and distinguish that from API state.
- [ ] Unauthorized users cannot read or mutate another owner's private records,
      files, evaluations, applications, or Gmail credentials.
- [ ] Data export/deletion, retention, privacy controls, and cost/run diagnostics
      are implemented and documented before unattended operation with real data.

Numerical targets measure the labeled fixture, not the whole job market. Real-world
coverage and useful-shortlist volume need a separately agreed pilot benchmark.

## Out of scope

Automatic sending/submission, cold outreach, CAPTCHA bypass, uncontrolled crawling,
public multi-user SaaS, payments, reply parsing, calendar automation, application
success prediction, trained ranking models, and default cover-letter PDF templating.

## Immediate next outcome

Complete goal G1 in [the plan](docs/PLAN.md): resolve the blocking operating choices
and define a bounded feasibility experiment. Do not treat this documentation setup
as authorization to provision paid services, connect someone else's account, or
process a real CV without the candidate's consent.
