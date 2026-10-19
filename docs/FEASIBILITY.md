# G3: bounded feasibility experiment

- Status: G3 in progress; partial live B pilot recorded, A window not started
- Defined: 2026-10-19
- Prerequisite: G2's reproducible tooling and applicable live-access checks below
- Initial route: GCP-managed Gemini, Brave, controlled HTTP retrieval with Cheerio

This is the G1 deliverable and G3 execution contract. It defines observations and
stop conditions. A ten-target B pilot is measured but incomplete; documentation
diagnostics are separate. Synthetic Alpha facts are approved privately; partial
live C outputs exist, with no generated package-content approval yet.
Current access readiness and setup commands are in [G3_SETUP.md](G3_SETUP.md).
Prices and provider features researched earlier remain dated inputs in
[PROVIDERS_AND_COSTS.md](PROVIDERS_AND_COSTS.md) and
[EXTRACTION_OPTIONS.md](EXTRACTION_OPTIONS.md); recheck the actual plan before use.

## Questions to answer

1. Can permitted structured sources and broad public-web discovery find enough
   distinct student-compatible opportunities in Berlin and Germany-remote work?
2. Does direct HTML extraction capture decisive facts with traceable evidence, and
   does a rendering/hosted fallback add useful vacancies at an acceptable total cost?
3. Can the selected Gemini endpoint extract synthetic CV facts, distinguish matching
   evidence from unknowns, and prepare truthful English application text?
4. Do the same five generated packages pass exact-content manual review, including
   truthful email text and source-evidenced questionnaire answers for manual copying?

## Entry checks and execution boundaries

- Use G2's documented install/verify commands. G3 adds an experiment-only local
  runner; [G3_SETUP.md](G3_SETUP.md) distinguishes its control-state commands from
  the live branch adapters and observations still required.
- Resolve operator access privately to the existing Firebase/Blaze project, region,
  service identity, enabled APIs, and a supported GCP Gemini model/endpoint. Check
  schema support, current rates/lifecycle, retention and processing-region behavior.
- Verify the actual Brave plan, quotas, attribution, retention and AI-use conditions
  before enabling persistent storage of its results. Choose at least one usable
  structured source; public Greenhouse/Lever boards need no assumed Adzuna account.
- Gmail is exclusively a Firebase Auth login identity. Do not configure Gmail API
  access, mailbox OAuth scopes/credentials or draft creation. D is manual content
  review under [ADR 0010](adr/0010-manual-application-packages.md).
- Use only synthetic applicant PDFs and profile facts. Never send CVs, private
  candidate identifiers, authentication tokens, or authenticated content to search/extractors.
- Use the [public-fetch policy](adr/0005-bounded-experiment-and-public-fetch-policy.md)
  below the shared network boundary, including for redirects/rendering subrequests.
- Missing access blocks only its experiment branch. Record the unmet prerequisite;
  do not invent credentials or substitute mocks for live-integration evidence.
- The brief defines limits. It does not request new subscriptions, prepaid purchases,
  billing changes, production deployment, or live execution during G1/G2. G3 live
  work must be opted into with the relevant operator/account access in that session.

## Work and cost limits

The experiment lasts seven consecutive calendar days in Europe/Berlin, beginning
with the first live discovery run. A setup-only day is not a coverage observation.
If access interrupts observations, report the actual interval and gaps; an incomplete
window cannot be reported as a passed seven-day benchmark.
Collect observations with a bounded runner across sessions if needed; record the
next due observation. Do not keep an agent spinning while waiting for calendar time.

Planned incremental paid-usage ceiling: **EUR 5**, inside the **EUR 50/month** total.
Forecast current provider prices, currency/tax effects, and cloud overhead before
starting. Allocate provider sublimits so concurrent work cannot reserve the same
remaining budget. Count all retries, fallback calls, rendering requests and billed
reasoning/output. Stop new paid work if its conservative upper-bound reservation
cannot fit; record delayed/partial results instead of silently exceeding a cap.
Billing delays and independent providers prevent an instantaneous bill guarantee;
usage limits and provider controls are both required. No automatic top-ups.

| Resource | Whole-experiment limit | Additional bound |
| --- | --- | --- |
| Search requests across all providers | 100 attempts | Max 40/day; pagination/retries count |
| Structured-source API requests | 100 attempts | Up to 5 initial employer boards; provider quotas also apply |
| Direct-page HTTP traffic | 200 requests | Max 40/day; robots, redirects, retries and browser subrequests count |
| Raw job/lead records examined | 400 | Stop backfill expansion at this bound |
| LLM requests across all tasks/providers | 100 attempts | Max 30/day, 500k input and 100k billed output tokens total |
| Optional fallback sample | 10 unresolved URLs per candidate | At most one browser and one hosted comparison; shared global caps apply |
| Manual package review | Same 5 packages as C | 2 email + 3 questionnaire; exact full-content review, no external writes |

Limits are experiment defaults, not the unattended production configuration. Do not
buy a subscription or credit bundle to satisfy a sample. If a provider cannot bound
its cost or fit within the plan, record that constraint and leave its branch blocked.

## A. Discovery and useful coverage

Freeze 20 queries before observing yield: 10 Berlin on-site and 10 Germany-remote,
including English/German discovery terms and student/part-time/Minijob sectors.
Do not include candidate names or contact information. Save the non-personal query
definition and observation dates where provider terms permit; do not tune a failing
query set mid-window and describe the changed test as the original benchmark.

On day one, run Brave on the frozen queries. Compare one available alternative on
the same queries/top 10 results if account/terms/cost gates permit. Lack of another
account does not block baseline discovery; mark the comparison unexecuted. On days
two through seven, use up to 8 follow-up search requests/day split across both
streams. All paths share the 100-attempt cap, leaving room for bounded retries.

Sample at least one structured source over the same window and compare after
cross-source deduplication. Record direct employer/local/university discoveries
separately from aggregator duplicates and generic career-page leads. Recheck a
vacancy before counting it as current; absence of a date is not proof of freshness.

**Coverage pass:** at least 10 unique current vacancies manually judged compatible
with affirmative language, location and work-format evidence, including at least
3 additional web/employer-page vacancies outside the structured-source sample.
Report both streams separately; zero suitable results in a stream is a material gap
to resolve, even if the combined threshold passes. Unknown decisive requirements
remain review leads and do not count toward the ten. Work authorization is never
inferred from student status or a CV; disclose candidate-specific unknowns separately.

## B. Extraction comparison

Manually label 30 public URLs: 12 static vacancy details, 6 JS-dependent candidates,
6 careers/list pages and 6 negative/expired/unavailable cases. Include at least
10 small-employer/local pages. Record expected page kind and decisive field evidence;
a fabricated test page cannot stand in for live small-employer coverage.

Run HTTP/Cheerio first. On at most 10 unresolved URLs, compare Playwright and/or
Firecrawl under the entry/cost gates. Attempt a candidate at most once per URL,
apart from one bounded transient retry within shared caps. A career-page follow
must have bounded depth (2), at most 5 job links, and validated cross-domain targets.

Label at least 30 explicitly present decisive field values across the fetchable
detail-page sample, covering work language, location/remote scope, work format and
application route. Mark genuinely absent/ambiguous values separately before testing.

**Extraction pass:** at least 10 detail pages yield a correctly evidenced job title,
employer and original vacancy URL. Across the labeled decisive values, require at
least 90% precision in populated claims and 80% recall of explicitly present values.
Report the denominators, missing-field rate and method/fallback contributions.
Zero invented application recipients or known wrong verified channels.
Negative/unavailable pages must not become confirmed vacancies. An empty output or
too few fetchable/labeled examples is incomplete evidence, not a passing result.

Choose at most one fallback for later implementation. Adopt it only if the sample
shows additional verified vacancies or materially better supported field coverage
within the cost envelope. A documented no-fallback result is legitimate; unresolved
leads remain visible and the V1 coverage criteria still need evidence.

## C. Synthetic CV, model and application checks

Current setup: an offline corpus of three profiles, five PDFs, twenty jobs and five
packages plus strict schemas/prompts/scoring is implemented and locally verified.
The five PDF pages have been
visually inspected; scan-only text absence and malformed-PDF rejection were checked
locally. These checks do not approve profiles, observe a model, or pass C/D.
Fixture hashes, commands and the 47-test integrated gate are recorded in
[G3_SETUP.md](G3_SETUP.md).

Use three synthetic textual PDFs (including multi-page and missing-field examples),
one scan-only PDF and one malformed input. Record facts with page/text evidence;
scan-only/unparseable input must produce an explicit outcome rather than invented
facts. OCR is not introduced implicitly. Human approval activates a profile version.

Run a 20-case labeled synthetic job fixture: 10 clearly eligible, 5 confirmed
blockers and 5 needs-review cases, with email/ATS/unknown channels and embedded
malicious instructions represented across the set. Generate 5 application packages
from approved synthetic profiles and verified fixture
channels: two email packages and three questionnaire packages. Questionnaire
question text and its association require source evidence; IDs are internal mappings,
not employer DOM/source IDs; unknown start dates remain unanswered.
Do not require real applicant facts or real recruiter addresses for this branch.
Include all parse/evaluation/generation/validation retries in the LLM cap.

**Model pass:** all 3 textual CVs produce schema-valid profiles recovering at least
90% of each PDF's pre-labeled profile facts with correct page/text evidence. The
scan-only and malformed inputs produce the expected explicit failure/review outcome.
All 20 valid job fixtures yield schema-valid evaluations, with all 5 blockers
rejected, all 5 uncertain cases marked needs-review and at least 9 of the 10 clear
positives marked eligible. All 5 packages are produced and map every candidate
claim to approved facts; no unsupported claims or invented recipients/channels.
Allow at most one repair request per generation within the shared caps. All-error,
empty-profile or missing-package outputs fail the positive-case criteria. Report
first-pass schema validity, repairs, confusion counts, fit/confidence, tokens and cost.
Record the model, endpoint, prompts and evaluator versions. This small feasibility
fixture does not replace G5's 50-posting final evaluation or its acceptance targets.

## D. Manual application-package review

Review the same five packages generated in C: two email subject/body packages and
three questionnaire packages. This is a bounded content-review experiment; no
Gmail API, mailbox OAuth, mailbox credential, autofill, browser-form write, send or
submission is involved. Gmail addresses serve Firebase Auth login only.

For email packages, inspect the complete subject and body, source-evidenced
recipient/channel, and every candidate claim against the approved profile version.
For questionnaire packages, inspect every internal field ID, source-evidenced question text, proposed answer,
evidence reference and status. Missing facts use `needs_input` with no proposed
answer; the fixture's unknown start date must remain unanswered. Consents,
signatures and declarations use `applicant_action_required`, never an answer
claiming the applicant already performed that action.

**Manual-review pass:** all five complete packages have explicit human review of
the exact generated content, bound to its full-content hash and profile/package
versions. All candidate claims are supported, all internal field IDs map to
source-evidenced questions, zero recipients/facts/answers are invented, and missing/action
states are correct. Corrections create a new package version requiring a fresh
review/hash. Schema/scorer success alone is not human content approval. Pending
profile approval, absent generated content or unreviewed packages keeps D incomplete.

The product's “View application draft” shared dialog, email subject/body copying,
per-answer questionnaire copying and actual browser/clipboard exercise are G6
acceptance work. G3 introduces no UI and does not claim clipboard usability.

## Evidence and experiment decision

Keep private captures, account IDs, tokens, raw provider responses and permitted
HTML samples under ignored local storage or approved private cloud storage. In Git,
record only sanitized aggregate findings, decisions and commands in this plan/related
ADRs, with private evidence references when necessary. Respect source-specific
retention; no fixed global TTL overrides shorter limits. Remove disposable uploads
and local captures when the experiment ends unless an explicit permitted need remains.

Report A/B/C and manual-review D as passed, failed, or blocked with sample counts,
actual interval, commands, model/provider configuration, costs, evidence and limitations. Report any
unexecuted optional comparison separately. Proceed to the affected slice only when
its evidence supports it. If coverage fails, improve the source/query strategy and
define a new bounded measurement. Incomplete model/manual-package evidence keeps
the corresponding V1 acceptance incomplete while independent discovery can continue.
Do not label an adjusted or incomplete test as passed.
G3's investigation can finish with a supported negative result and explicit
follow-up decision; an unexecuted required branch or incomplete observation window
keeps it incomplete. Optional comparisons can remain unexecuted without waiving
required branch criteria or V1 acceptance.
