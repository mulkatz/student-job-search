# G3 setup and resumable experiment

Status: bounded remediation implemented; G3 acceptance remains unmet, updated 2026-10-19.
The original investigation and its failed observations remain preserved below.
The user removed duration (ADR 0017) and requested independent completion of G3/G5
gaps before G6/G7. Source retention, 70 model requests/day, 100 total, token caps
and EUR 5 remain unchanged. Historical checkpoints retain their original counts.

## Current findings and decisions

| Branch | Actual finding | Decision |
| --- | --- | --- |
| A: discovery | Original 20 queries/200 leads plus 8 next-page searches/80 entries; 38 further target observations yield 26 HTML bodies and no independently confirmed compatible vacancy | Coverage target of 10 unique compatible vacancies, including 3 incremental web discoveries, remains unmet |
| B: extraction | Known-cohort v3 development: 47/49 recovery and 47/47 precision. Independent new-source first run: 8 correct details, 16/32 recovery, 16/24 precision, zero false confirmations; only 2 confirmed local sources | Generic fixes and development replay recover the new fields; B remains incomplete because adequate independent acceptance is absent and old exact diagnostics still fail |
| C: model | New single batch classifies all 20 jobs correctly, but all 5 packages fail strict reference/format/content checks; earlier CV outcomes still pass | Matching remediation observed; package quality still fails. Sole bounded repair prepared offline; today's 70-request allowance is exhausted |
| D: packages | All five exact corrected editorial versions passed independent semantic review and conditional approval | Complete under ADR 0021; neither human line-by-line review nor original model success |

G5's separate independently authored/adjudicated 50-case synthetic benchmark passed
under ADR 0022: 50/50 correct, 100% processing/shortlist precision, 49 canonical jobs
and 20 unique eligible jobs. This is agent review of synthetic data, not human labels,
real-market coverage, real CV permission or full V1 acceptance. Decisive source
conditions and v2 stale-result handling are recorded in ADR 0024.

The original B oracle omitted four genuine application routes and penalized some
equivalent encodings. Its original negative report remains intact. A corrected v2
oracle was independently checked before the new full replay; because the cohort
and failures were already known, this is development evidence, not a blind holdout.
Optional rendered/hosted extraction comparison remains unsupported/unexecuted.

The intended GCP/Firebase project is designated privately, with an EU preference.
After the earlier permission failure, current CLI and ADC project reads succeeded,
and enabled billing was verified. The existing project's Vertex AI API
(`aiplatform.googleapis.com`) was enabled successfully; no deployment, IAM or
billing change was made. These setup checks established access prerequisites;
actual inference observations are recorded below. Private evidence: `gcp-current-check.json`,
`vertex-api-setup.json` and `adc-check.json` under `.local/g3/`.
The local Brave variable was normalized to `BRAVE_API_KEY`; no value was printed.
The user confirmed Search/Postpaid by text and dashboard screenshot. No explicit
storage grant was displayed; current public terms/help do not establish an
applicable vendor exception. The user subsequently authorized bounded private use
despite this condition (ADR 0016); URL-only discovery day one is now observed.
Firestore does not confer Brave's contractual storage rights.

The offline synthetic corpus has three profiles, three textual PDFs, one scan-only
PDF, one malformed PDF, twenty labeled jobs and five package cases. The five pages
across valid PDFs were visually inspected and their page/text behavior checked;
the scan has no extractable text and the malformed input fails local parsing.
The strict corpus, prompts and report scorer are implemented and locally verified.
The parsed corpus SHA-256 is
`46d5eae10c2d38673429817e9da772ca9e14cb975825561a1a7a52697a160df3`.
The user explicitly approved Alpha's ten synthetic facts; the corpus-bound receipt
is private at `.local/g3/profile-approval.json`. This is test-only approval, not real
applicant data or approval of generated package content. The synthetic corpus is committed; exact corrected package approval is recorded above. Final private PDFs,
page-text JSON and the source-hash manifest are under
`.local/g3/model-fixtures-v1-final/`; their five PDFs are byte-identical to the
visually inspected inputs. The final manifest matches the current corpus file.

## Runner boundary

The earlier 40 direct-HTTP requests/day was an internal G3 planning throttle,
enforced by `assertResourceCaps` in `packages/experiment/src/ledger.ts`; it was not
a Firebase, Brave or browser quota. At the user's request, ADR 0012 removes this
HTTP daily restriction. The cumulative 200-HTTP cap, explicit bounded runs,
per-origin pacing, source-specific limits and 429/Retry-After handling remain.
Search's 40/day and model's 30/day are separate internal experiment controls;
neither is evidence that an external provider has rejected a request at that count.
No existing ledger/configuration is reset or migrated.
The updated integrated `npm run verify` passed Biome, strict types, 75 offline
tests, both builds and Secretlint. Synthetic restart coverage admits all 200 HTTP
attempts on one Berlin date and refuses attempt 201, retaining failed/outstanding
accounting. No test calls an external provider or changes the private live ledger.

The first runner slice manages local control state. Initialize it only once:

```sh
mkdir -p .local/g3
cp -n experiments/g3/config.example.json .local/g3/config.json
chmod 700 .local/g3
chmod 600 .local/g3/config.json
npm run experiment -- init --config .local/g3/config.json
npm run experiment -- status
```

If the private config/state already exists, inspect it and run only `status`; do
not copy over existing settings or initialize another ledger. Initialization
freezes the twenty-query manifest and allocations but does not start day one or
make a provider call. The example allocates EUR 1 each to discovery and model work,
inside EUR 5; it contains no credentials or live-provider configuration.

The CLI rebuilds the experiment package before execution. It exposes init, read-only
status, offline fixture validation and scoring of private observed reports; no cloud
schedule or browser job is installed. Library
reservations account for aggregate/daily requests, upper token/record counts and
conservative branch cost before a future dispatch. Pending/ambiguous reservations
remain counted across restarts; an overrun blocks new work. Persisted version-1
state/config may contain dormant zero-valued Gmail allocation/count controls from
the historical contract. Preserve cumulative state; those controls neither
authorize mailbox access nor impose a current Gmail requirement. No command can mark
G3 passed. Status reports attempted observation dates, next due date and gaps.

Validate the versioned synthetic corpus without provider calls:

```sh
npm run experiment -- fixture-check
```

Score an actual private observed report; approval and run configuration are optional
inputs, and absent approval cannot yield a passing approved-profile result:

```sh
npm run experiment -- score --report .local/g3/model-report.json
npm run experiment -- score --report .local/g3/model-report.json --approval .local/g3/profile-approval.json --run-config .local/g3/model-run-config.json
```

These inputs must be owner-only regular JSON files under `.local/`, without symlink
traversal. Use the versioned schemas; do not manufacture observations or approvals.
The scorer does not call a model, approve profiles or replace exact-content review.

Optional local PDF authoring uses Python 3.12.10 and four pinned dependencies in
`scripts/g3/requirements.txt`. Create the environment only if it is absent, then
install its locked requirements and generate into a new exclusive output directory:

```sh
# Only if .local/g3/pdf-tools does not already exist:
uv venv --python 3.12.10 .local/g3/pdf-tools
uv pip install --python .local/g3/pdf-tools/bin/python -r scripts/g3/requirements.txt
.local/g3/pdf-tools/bin/python scripts/g3/generate_pdfs.py --output .local/g3/model-fixtures-v1-final
```

Never overwrite an existing environment or evidence directory; choose a new output
path when it exists. The generator creates five PDF inputs, actual-page JSON evidence
and a manifest; it performs no OCR or model calls. Generated PDFs/evidence stay
ignored and private. Rendering inspection and profile/content approval are separate.

Provider-specific pricing/rights checks, search follow-up selection and its eight
requests/day protocol, retry/fallback URL limits, sample labels/metrics and all
live dispatch adapters remain separate responsibilities before live execution.
The controlled public-fetch/extraction library uses public DNS validation and
pinned HTTP/TLS connections, checks redirect permissions, and requires a durable
pre-request hook. Its conservative limits include default ports only, no compressed
bodies, no rendering, a default 15-second whole-operation deadline and 2 MB body
limit. It never forwards credentials or cookies and does not retry automatically.
Its caller must account for every request/redirect/robots fetch in the ledger and
persist Retry-After across restarts; pacing/backoff inside one fetcher is in memory.
HTML challenge-marker matching stops strong challenges and isolated widgets while
ignoring incidental CAPTCHA text on substantive public pages. Its marker outcome
does not prove an authentication wall; actual 401/403 status outcomes remain distinct.
A request hook that completes after a deadline can leave a conservative outstanding
reservation and must be reconciled. Neither this library nor its synthetic tests
establish live vacancy coverage, source rights or extraction accuracy.

Extraction recognizes only supported JSON-LD JobPosting facts and explicitly
labeled application links. It returns plain evidence, keeps language and
Germany-remote eligibility unknown, and marks all application routes unverified.
It is not an HTML sanitizer or a general extractor for arbitrary career pages.

Store experiment state, credentials and permitted captures only under ignored
`.local/g3/` or another explicitly approved private store. Keep private files
owner-readable, retain only needed evidence, and follow shorter provider retention
limits. A Git ignore rule is not authorization, encryption or deletion assurance.
Do not delete/reset the cumulative ledger between sessions. Investigate outstanding
or ambiguous writes and locks before resuming; preserve cumulative accounting.

## Executed evidence and next observation

On 2026-10-19, the documented init/status commands succeeded with the version-1
manifest and credential-free allocation example. Status is read-only; the ledger
has no discovery start, no scheduled next observation, and no benchmark result.
The frozen manifest SHA-256 is
`49be10b193f4838353d9a12cbe8874a9b1248f4cfeaca9bf4eb8921bb42fd147`.

After independent review of the real transport, a private exact-target diagnostic
script ran with the mandatory durable HTTP/extraction hook and explicit live opt-in:

```sh
node .local/g3/http-smoke.mjs
```

This private diagnostic is retained as local evidence, not a clean-checkout live
command. It used no credentials, retained no response HTML, allowed only the two
reviewed official documentation URLs, and counted every send in the same ledger.

| Target | Observed outcome | HTTP attempts |
| --- | --- | --- |
| `https://developers.google.com/robots.txt` | Text retrieved, 93 bytes | 1 |
| `https://developers.google.com/workspace/gmail/api/auth/scopes` | Stopped at HTML authentication/challenge marker; no retry | 1 |

The original private record uses the then-current `authentication_or_challenge`
label. Review clarified that heuristic label to
`authentication_or_challenge_marker`, retaining the stop behavior and separate
401/403 outcomes. The second observation does not establish an actual login wall.
Private evidence: `.local/g3/http-smoke-result.json` and `.local/g3/state.json`.
Paid provider calls: zero; counted HTTP attempts: two; incremental paid API spend:
EUR 0. The EUR 2 allocation is a reservation envelope, not spent money. Existing
account billing was not inspected. No A-window clock or vacancy/sample count started.

The historical setup integrated `npm run verify` passed with strict types, Biome, 33 offline tests,
both workspace builds and Secretlint. A fresh local clone of setup commit
`9009001` also passed `npm ci` and `npm run verify` with the pinned runtime;
its tracked worktree stayed clean. Installation reported no audit findings and
one upstream deprecation warning for Cheerio's transitive `whatwg-encoding`.
Independent review separately ran experiment and affected network tests; the concurrency and marker-label findings were fixed
and rechecked. Markdown/YAML and relative documentation links were reviewed
manually. CI remains configured; no remote CI run or push is claimed.

The current follow-up `npm run verify` also passed: Biome, strict workspace types,
47 offline tests (5 core, 39 experiment, 3 secret-scanner), both builds and
Secretlint. `npm run experiment -- fixture-check` validates the actual corpus and
reports `approval_pending_model_not_run`. Python source syntax, relative document
links, whitespace, and private PDF file/directory modes were checked separately.
The optional generator verified actual page quotes, scan-only absence of text and
malformed-input rejection without OCR. These are local checks, not model results,
profile approval, manual package-content review or a browser dialog test.
Independent review rechecked the corpus, approval gates, prompt isolation, scorer,
private-input boundary, generator and current scope documentation; strict types
and all fourteen model tests passed independently. Question/source and channel/source
binding findings and the generator identifier-path guard were fixed and rechecked;
no material findings remain.

The ten-target pilot below is partial B evidence; C has partial first-pass observations.
A/D remain unexecuted and no branch is passed. Resolve the remaining source/model
conditions and complete the actual live adapters, then start A's seven-day coverage window with the frozen
queries. After that first discovery dispatch, use `status` for the next due Berlin
date and record gaps; do not keep an agent waiting for calendar time.

## Current provider references

Reviewed 2026-10-19. Project/ADC access, billing enablement and API setup have private
observations above. First synthetic inference is observed below. Storage/use
entitlements, credits, quotas and account-specific billed rates remain unverified.

- Brave currently lists USD 5 per 1,000 Search requests. One hundred attempts are
  forecast at USD 0.50 before account-specific credits, currency and taxes. Do not
  assume credits. Result storage requires an entitlement expressly granting it;
  search access grants no rights to third-party pages. Confirm the actual plan
  for general storage use; ADR 0016 records the current bounded private operator
  exception without claiming that grant. [Pricing and storage](https://brave.com/search/api/).
  Use the documented [Web Search endpoint](https://api-dashboard.search.brave.com/app/documentation/web-search/get-started),
  not an additional LLM-context or Answers product. Respect actual
  [rate-limit headers](https://api-dashboard.search.brave.com/documentation/guides/rate-limiting),
  while the experiment counts all attempts, including errors and retries.
- Greenhouse documents unauthenticated GET access for published job-board data.
  This establishes technical access only. Check each selected employer's terms,
  permitted storage, attribution, retention and useful coverage. Never call its
  application POST endpoint. [Job Board API](https://docs.greenhouse.io/job-board).
- Provisional model: `gemini-3.5-flash-lite`, Standard PayGo, EU multi-region.
  Verify the operator's project and supported endpoint first; EU is not a
  Germany-only processing promise. [Model](https://docs.cloud.google.com/gemini-enterprise-agent-platform/models/gemini/3-5-flash-lite),
  [locations](https://docs.cloud.google.com/gemini-enterprise-agent-platform/resources/locations).
  Non-global standard list prices are USD 0.33/million input and USD 2.75/million
  output tokens, including reasoning: all 500k input/100k billed output tokens
  forecast USD 0.44, shared by the 100 attempts. Reprice against actual EUR SKUs,
  taxes, account terms and overhead. [Pricing](https://cloud.google.com/gemini-enterprise-agent-platform/generative-ai/pricing).
  Structured output still needs independent schema validation and at most one
  repair. [Structured output](https://docs.cloud.google.com/gemini-enterprise-agent-platform/models/capabilities/control-generated-output).
  Retention is not automatically zero: current docs describe project-scoped
  caching, including supported durable caching up to 24 hours; logging exceptions
  also apply. Use only synthetic facts and GenerateContent without additional
  grounding/storage features. [Retention](https://docs.cloud.google.com/gemini-enterprise-agent-platform/resources/zero-data-retention).
  CLI login does not establish ADC. [Local ADC setup](https://docs.cloud.google.com/docs/authentication/set-up-adc-local-dev-environment).
  Gemini 3's `MINIMAL` thinking does not disable billed reasoning. The
  GenerateContent-specific guide now explicitly describes a combined
  thought/answer cutoff. Together with the Cloud model's maximum output limit,
  this supports the conservative 65,536-token per-call reservation below; the
  exact Cloud v1/model page does not itself repeat the combined definition.
  [Combined cutoff](https://ai.google.dev/gemini-api/docs/generate-content/thinking#token-limits-and-max_output_tokens).
  The 2.5 Flash/Flash-Lite alternatives document thinking-off controls but retire
  on 2026-10-20; they are not selected as a lasting default to evade this issue.
  [Lifecycle](https://docs.cloud.google.com/gemini-enterprise-agent-platform/models/model-versions).
Historical Gmail scope research and the documentation URL in the smoke table are
retained as investigation history, not an integration prerequisite. ADR 0010
replaces that branch with manual package review; do not request mailbox scopes,
credentials, client setup or test-draft access. Actual review/copy dialog and
clipboard behavior are G6 work, with no autofill or external form writes.

Before paid calls, allocate provider shares inside EUR 5 and the EUR 50/month
ceiling. A possible conservative reservation uses EUR 1 for discovery and EUR 1
for the model, leaving EUR 3 unallocated. A planning multiplier of EUR 2 per listed
USD provides currency/tax headroom for the above USD 0.94 subtotal; it is not an
exchange-rate quote or invoice guarantee. Recompute if actual prices or tax/FX
conditions do not fit. No new subscriptions, prepaid purchases, provisioning,
automatic top-ups or deployment are authorized by this setup.

## First live extraction pilot

On 2026-10-19 an independently reviewed private operator script fetched ten
operator-seeded Berlin employer URLs: four detail candidates, four career/list
pages and two negative/unavailable candidates. This is a partial pilot, not the
required 12/6/6/6 benchmark, a Brave result or an A coverage observation.
Every page, redirect and robots send used the shared public-fetch boundary and
durable `extraction`/`http` reservation. No credential, cookie, form interaction,
rendering or automatic retry was used. Source-policy review and permitted private
captures remain under `.local/g3/extraction/`; no raw listing is redistributed.
Private retention is capped at seven days from capture, with shorter source
restrictions taking priority. This is an operator limit, not a source licence.

Three pages returned HTML; seven stopped at the original conservative challenge
marker. Independent source inspection labeled one specific advert, one multi-role
career page with a stale update date, and one maintenance page. Blocked captures
retain ambiguous facts. Four decisive values were present on the specific advert;
no candidate compatibility or current-vacancy coverage is inferred.

Labels were frozen before the first extractor run and bound to capture hashes:
manifest `e0a76c49fb51f4f9b1bb3688da7b9d26c4cd82b98c6ae9b289b382b746104b4a`,
labels `dc72ba974708f80272b6e2093bd22b83925a5f7d204098b2d36b24e69e2bb2f9`.
The JSON-LD-only extractor at `e4dbb153baf68bab3e320dcec3f75a3846917fb5`
missed that visible-text advert: 0 correct details, 0/4 recovered decisive values,
0 populated claims and 0 false confirmations. Recall is 0%; precision is undefined,
not 100%. The scorer reports `incomplete` because the sample is too small.
Private evidence: `captures.json`, `labels.json`, `freeze-receipt.json` and
`baseline-report.json` in the same private directory.

One separately reviewed diagnostic repeated a selected marker-blocked URL with
identical anonymous headers and pinned transport. It retained only bounded inert
metadata, not HTML: HTTP 200, ordinary job title/heading and readable text, without
the inspected access-gate signals. That supports correcting incidental CAPTCHA
word matching; it is not proof that all seven stops were false positives.
The correction preserves strong Cloudflare loaders, password gates, explicit human
checks and isolated widgets. It neither interacts with a challenge nor changes
network/source limits. Original captures and baseline scores remain unchanged;
new measurements must record the changed fetch method separately.

At the first pilot's close, HTTP attempts totaled 21: 2 documentation diagnostics, 18 pilot sends
(10 pages and 8 robots requests), and 1 marker diagnostic. All are settled, paid
API spend remains EUR 0, and A's seven-day clock remains unstarted. The offline
benchmark rejects changed evidence, duplicate final pages and unsupported claims;
synthetic tests do not establish live accuracy, source rights or human approval.

After affected-code and evidence re-review, `npm run verify` passed Biome, strict
types, 59 offline tests (5 core, 51 experiment, 3 scanner), both builds and
Secretlint over 68 repository files. Independent review separately passed all
10 benchmark and 13 fetch tests and adjudicated the three captured HTML pages.
Documentation links, whitespace and the relative instruction symlink also passed.
No new UI/browser journey, remote CI run, paid inference or source coverage pass is
claimed by these checks.

## Post-correction transport check

A separately prepared and independently reviewed one-target follow-up used fetch
method `8321304372e1c58326eb96bc129102b5f282ab4a`, with guarded source/build/script
hashes. It shared the original lock, persisted cooldowns and robots cache.
One new career-page URL returned HTML in one request on 2026-10-19 at 17:41:45 UTC.
Independent inspection found a readable list with three role summaries/detail
links and incidental CAPTCHA text, without inspected access-gate evidence.
Applying the old marker offline to these same captured bytes would have stopped
the page. This is one concrete post-correction observation, not proof that all
seven earlier stops were false positives. It establishes no vacancy freshness,
candidate compatibility, extraction accuracy or full B pass.

Private evidence is under `.local/g3/extraction-followup/`: `method.json`,
`reeham_careers/capture.json`, `source-inspection.json` and `marker-comparison.json`.
The capture uses the same maximum seven-day private retention; original pilot
captures, frozen labels and baseline scores are unchanged. HTTP attempts now
total 22, all settled, with no retained live lock or reconciliation requirement.
Before model dispatch, paid API spend was EUR 0; the discovery clock had not started. No solver,
browser, new dependency or provider account was used.

## Prepared extraction continuation

Session handoff, 2026-10-19: the user requested a pause before further execution.
An additional eight-static-detail cohort across six hosted employer origins is
prepared under `.local/g3/extraction-expansion-v1/`. Its manifest, source policy
and capture script are hash-guarded to commit `13c8b6d`; syntax checking passed.
The operator has not received independent review, refusal-path checks have not run,
and no target has been fetched. Review those boundaries before dispatch. This
preparation changes neither the original extraction results nor the cumulative
22-HTTP/30-model ledger. G3 is incomplete; the seven-day discovery clock is unset.

## Conservative synthetic model dispatch

The tested configuration is Gemini 3.5 Flash-Lite Standard PayGo in EU,
with a single direct v1 `generateContent` response, `candidateCount: 1`, JSON
response schemas, first-pass `maxOutputTokens: 2048` and `thinkingLevel: MINIMAL`.
No tools, grounding, continuation loop, explicit cache or thought summaries are
requested. The smaller configured output is not treated as thinking-off: reserve
the full documented 65,536 model output maximum before each generation.
[ADR 0011](adr/0011-settled-model-token-accounting.md) accounts for complete settled
input/candidate/thought usage while retaining original bounds and every existing
500k/100k, daily/whole-attempt and monetary cap. Unknown usage retains its bound;
unexpected overruns remain recorded and stop further dispatch.

Pure helpers validate request shapes, one-candidate text responses, complete usage
totals and conservative EUR cost. These offline checks do not establish live
compatibility. The private single-case operator must be reviewed before execution;
its source/build/script hashes, actual synthetic PDF/text and raw provider evidence
remain private. First-pass observations are recorded below.

Each case first uses the same payload in `CountTokens`, then reserves the greater
of its estimated input plus 1,024 tokens or full request UTF-8 bytes plus 1,024.
The preflight is free but conservatively counts as an LLM request in the ledger;
it consumes no billed generation tokens. Thus preflight calls and actual generation
results are reported separately, with both counted against request caps.
[CountTokens pricing and quota](https://docs.cloud.google.com/gemini-enterprise-agent-platform/models/capabilities/get-token-count#pricing-and-quota),
[request fields](https://docs.cloud.google.com/gemini-enterprise-agent-platform/reference/rest/v1/projects.locations.publishers.models/countTokens).
Google's pricing states non-200 responses are not charged for input/output tokens;
that does not authorize inventing usage metadata or releasing unknown generation
token bounds. [Pricing](https://cloud.google.com/gemini-enterprise-agent-platform/generative-ai/pricing).
The operator has no automatic retry, and persists 429 cooldowns. A timeout or
unusable usage response retains the reservation and requires reconciliation.

After independent review resolved incomplete-usage and cooldown-concurrency
findings, `npm run verify` passed Biome, strict types, 74 offline tests (5 core,
66 experiment, 3 scanner), both builds and Secretlint over 72 repository files.
Independent isolated checks also passed all eight Vertex and seven usage tests.
The private operator passed syntax and three opt-in/input rejection checks without
changing the real ledger. Fresh local parsing of all three textual PDFs matches
the inspected artifact hashes/text. These are pre-dispatch checks, not C/D results.

## First live model observations

The reviewed operator at `4b23efecf40aac1b1bdf01f0bde8d94a155a3aa6` ran three textual
CV cases and the five approved-Alpha package cases. Each used a free CountTokens
preflight and one generation, with no retries. All eight generations reached the
selected EU model; four outputs passed the independent task schema on first pass.

| Cases | Actual first-pass finding |
| --- | --- |
| Alpha CV | 9/10 exact values/quotes; student status normalized to `true`; strict CV acceptance fails despite 90% recall |
| Beta CV | 8/8 exact values/quotes, no unsupported facts |
| Gamma CV | 3/4 exact values/quotes; the same student-status normalization; strict CV acceptance fails |
| Email package 01 | Missing required channel evidence reference |
| Questionnaire package 02 | Missing required metadata/answers and excessive instruction-like boilerplate |
| Email package 03 | Schema-valid, but unsupported “strong” skill proficiency; human review pending |
| Questionnaire packages 04/05 | `MAX_TOKENS`, truncated JSON; no complete package or manual-review pass |

Raw outputs, exact payloads, method hashes, usage receipts and the CV comparison
are under `.local/g3/model-live-v1/`. No oracle values, expected decisions or answer
policies were sent. Every original 65,536-token reservation remains immutable;
complete usage settles to 5,625 input and 6,067 billed output tokens. Conservative
accounted model cost is EUR 0.037084 at the documented headroom rate, not an invoice.
At that first-pass checkpoint the ledger had 16 LLM attempts (8 free preflights +
8 generations) and 22 HTTP attempts. Later observations follow; the original
failures and their usage remain unchanged.

### Single repairs and current model checkpoint

A separately reviewed, hash-guarded operator under `.local/g3/model-repair-v1/`
made exactly one repair for Alpha/Gamma CVs and packages 01/02/04/05. It used
`maxOutputTokens: 4096`, the same full reservation, original source/prompt and
previous untrusted output, with generic format/value constraints rather than oracle
answers. All six repairs stopped normally and passed their task schema. Final
CV comparisons recover 10/10, 8/8 and 4/4 exact facts with page/quote evidence and
zero unsupported facts. The scan-only and malformed PDFs produce local
`needs_review` and `parse_failed` outcomes without model calls.

Independent semantic review found two remaining package failures: package 02's
experience answer cites the approved spreadsheet skill outside that field's frozen
fact scope; package 03 adds unsupported “strong” skill proficiency. The other three
packages have no identified content finding. Schema validity does not pass either
failed package. No second model repair is allowed; editorial corrections must be
new versions and cannot turn the original generated outputs into C successes.

The first matching case (`job-01`) is schema-valid and agrees with its expected
eligible decision. Nineteen matching cases remain unobserved; the full report
schema correctly rejects this incomplete sample. Private partial inventory:
`.local/g3/model-live-v1/partial-inventory.json`. Human review of all five full
packages remains pending; C/D and G3 have no passing result.

Separately versioned editorial proposals and a complete offline review document
are under `.local/g3/model-review-v2/` (`manifest.json`, `review.html` and five
package JSON files). Only package 02's experience sentence/reference and package
03's unsupported qualifier change; the other three outputs are unchanged.
The manifest binds original/final hashes and marks both original model findings
as failures. Independent re-review verified the exact changes, schemas, hashes,
source mappings, inert HTML and unchanged original evidence/ledger. These corrections
require fresh exact-content human review; they
do not change model scoring, consume another repair or establish G6 UI acceptance.

The current cumulative ledger has **30 LLM attempts: 15 free CountTokens preflights
and 15 generations** (9 first passes plus 6 repairs), and 22 HTTP attempts.
Complete receipts settle to **17,534 input and 7,461 billed output tokens**;
conservative accounted model cost is **EUR 0.052615**, not an invoice. Every original
bound is retained. Independent review reconciled all 30 receipts/totals. There is
no outstanding attempt, overrun, live model lock or reconciliation requirement;
search/structured requests remain zero and the discovery clock remains unstarted.
The 30/day model cap prevents further model calls on 2026-10-19 Europe/Berlin.
The next possible model date is 2026-10-20, subject to cumulative caps and current
operator/source checks; do not reset the ledger or wait in a loop for midnight.
The model operators remain frozen against their original source/build hashes.
After the HTTP-cap code change, prepare/review a new guarded operator version
before further model dispatch; do not edit old manifests to hide that change.

## Brave account and storage condition

The user confirmed Search/Postpaid and supplied a dashboard screenshot without
an explicit storage grant. Minimized private evidence is `.local/g3/brave-plan.json`.
Current public help says retaining API data requires contacting Brave, and the
general terms limit storage to operationally transient use and restrict AI
evaluation/benchmark uses. No applicable exception has been established for this
account. Do not infer rights from the tariff name, payment or choice of Firestore.
[Provider help](https://api-dashboard.search.brave.com/documentation/resources/help-feedback),
[terms](https://api-dashboard.search.brave.com/documentation/resources/terms-of-service).
At that checkpoint no Brave request, account change, purchase or support message
was made, and the discovery window had not started. The user subsequently instructed
bounded private use without a vendor grant. [ADR 0016](adr/0016-private-brave-operator-authorization.md)
supersedes the waiting condition only for that explicit private exception. It keeps
provider permission unverified, URL/provenance retention at most seven days, the
existing caps and actual-dispatch start of A's seven-day clock. It authorizes no
provider account change, new subscription or result-to-model processing.


## G4 private source follow-up

On 2026-10-19, a separately prepared and independently reviewed operator fetched
one previously inspected employer detail candidate twice. Both returned HTML in
one request each. Exact source/redirect policy, public-fetch boundaries, hash guards,
non-overwrite capture directories, the existing extraction lock/robots cache and
persisted cooldowns were preserved. No browser interaction, credentials, new paid
provider or model/search request was used. Source policy permits only this bounded
private observation under ADR 0005; no unrestricted mirroring licence is asserted.

Private source evidence: `.local/g4/source-probe-v1/`. The actual two capture bodies
were independently inspected for one title/employer pair. Separately hash-bound
offline normalization of those real bytes yields one source-pair job and one
content revision on repeat. That replay is not another live request or a completed
G3 extraction benchmark. The maximum seven-day retention also applies to normalized
copies and projections. G4's actual local evidence is tracked in [PLAN.md](PLAN.md).

The cumulative G3 ledger now has 24 HTTP attempts (the earlier 22 plus these two),
all settled. Model attempts remain 30 and search/structured attempts remain zero;
A's discovery clock remains unset. Existing captures, model content failures,
original reservations and all unfinished G3 branch criteria remain unchanged.


## G4 bounded search and targeted source observations

Following the explicit private operator exception in ADR 0016, twenty frozen Brave
queries ran on 2026-10-19 (ten per stream), retaining 200 URL/provenance leads and
no snippets/provider titles/raw response bodies. Fourteen subsequent public HTTP
attempts yielded no specific vacancy details; a same-day completed repeat sent zero
requests. The generic career-link prioritization was then corrected offline; improved
live v2 yield is unmeasured. This is not a passed A coverage sample.

A separate reviewed four-target extraction packet used actual retained Brave URLs
without new search calls or resetting the first run. Four HTTP attempts returned
three HTML pages and one unavailable result. Inert review kept an unsolicited museum
page as a lead, an explicitly 2022-expired advert unavailable, and a specific hostel
cleaner advert as a source observation with freshness/eligibility unknown. Reviewed
source-specific normalization of the real bytes and authenticated Chromium passed;
this does not prove generic extractor accuracy or a compatible/current G3 vacancy.
See [G4 evidence](PLAN.md#g4-discovery-slice), private packet/replay references and
retention instructions there. All copies expire within original parent retention.

The preserved cumulative ledger now has 42 HTTP, 20 search and 30 model attempts,
all settled; no outstanding/writer reconciliation or overrun remains. Conservative
search accounting is EUR 0.20, with prior model accounting EUR 0.052615; these are not
provider invoices. Existing caps/allocations were unchanged. The first actual search
dispatch started A at `2026-10-19T19:18:01.181Z`; the seven Berlin calendar dates end
2026-10-25 and the next observation is due 2026-10-20. Only one live discovery date
is observed. The extraction cohort, nineteen matching cases, human exact-content
package review and the full A/B/C/D outcomes remain incomplete. G4 completion does
not waive these requirements or authorize new subscriptions/deployment/real CV use.


## Bounded-snapshot and delegated-review continuation

The user removed duration only. `ExperimentStore.adoptBoundedSnapshotPolicy` records
ADR 0017 authorization in existing state; original start/manifest/config/attempts stay
unchanged and status reports `bounded-snapshot`/`waived_by_operator`, never a passed
seven-day test. The separate `adoptModelRequestPolicy` records ADR 0020's explicit 70/day
remaining-G3 authorization; free CountTokens still counts. No total/cost/token cap
or source-retention waiver occurred. Private policy receipts are separately preserved.

The new `.local/g3/matching-snapshot-v1/` exact-module/hash-guarded operator executed
job02–20 sequentially, with 19 CountTokens and 19 inferences, no retries. All 19 returned
schema-valid STOP outputs. `.local/g3/model-snapshot-report-v1/` combines these with
original CV/package/job01 evidence and copies the actual policy receipt. Independent
reparse/receipt/scorer review agrees: all 5 CV outcomes pass; matching is 9/10 eligible,
5/5 blocked and 2/5 needs_review. Two unknown cases became eligible, one unknown became
blocked, and one supported eligible case became review. Original package 02/03/04/05
semantic failures are preserved. C is a measured **failed** outcome, not incomplete
sampling or a claimed clean pass. G5 must enforce decisive unknown/blocker constraints
before any optional model scores; this result does not establish live-model readiness.

A fresh separate agent review of the five editorial packages found unsupported
six-month-duration wording in package 04/05. New `.local/g3/model-review-v3/` corrects
only that wording, preserves all source/fact mappings and old versions, and passes
independent exact-content re-review. `operator-approval.json` binds exact versions,
outputs, review HTML and manifest under the user's conditional delegated approval.
D is complete under ADR 0021; direct human line-by-line review is not claimed.

At this checkpoint the preserved ledger has 68 model requests (34 CountTokens plus
34 generations), 42 HTTP and 20 search, all settled without pending locks/reconciliation
or overrun. Conservative model accounting is EUR 0.061393 and search EUR 0.20, total
EUR 0.261393, not a provider invoice. A/B continuation retains these cumulative caps
and prepares separately versioned capture/independent-label/extraction phases.


## Final bounded source measurement and investigation decision

The reviewed `.local/g3/snapshot-extraction-v1/` capture-only method made 59 HTTP
attempts for 30 primary URLs and robots metadata, plus one structured accounting
attempt for a documented API example that returned 404. Primary outcomes were
23 HTML, six access/challenge stops and one 404. Independent agent inspection,
completed before extraction, labeled 12 specific adverts, eight career leads,
three negative pages and seven unavailable pages. Planned strata are selection
categories; they do not establish observed JavaScript dependence or currentness.

The label freeze bound actual body hashes and preceded the first scorer execution.
The existing static baseline's complete sample has 30 rows, ten small/local sources,
12 detail labels and 45 present decisive fields across the required families.
It identifies seven details and recovers 16/45 fields (35.6%). Exact-string diagnostic
precision is 16/18 (88.9%), with two mismatches and zero false confirmations.
The oracle cannot express every genuine plaintext/form application route and may
penalize equivalent metadata/visible encodings. Do not call these exhaustive semantic
or channel metrics. Even crediting both mismatches gives only 18/45 recovery (40%),
below the 80% target; seven details also misses the ten-correct-detail minimum.
The negative quality decision therefore does not depend on those two mismatches.
Original captures, independent notes, frozen labels and failed report are preserved.
No default generic extractor improvement or rendered-fallback success is claimed.

A separate `.local/g3/structured-snapshot-v1/` method then fetched three individually
addressed real public employer job records from Greenhouse, with three HTTP and
three structured accounting attempts. No unbounded listing or application endpoint
was called. All returned valid JSON with matching job identities. Independent
inspection confirms specific Berlin student-work adverts, including additional
German or Russian requirements and explicit hours; none establishes candidate
compatibility. No exact job identity overlaps the retained Brave/B sample, but
unobserved listing contents can hide overlap. These independently selected records
receive no frozen-Brave incremental-discovery credit. Public GET and update dates
alone do not establish deadlines, legal eligibility or compatible yield.
[Official GET documentation](https://docs.greenhouse.io/job-board), reviewed 2026-10-19.

The final cumulative ledger is **104 HTTP, 20 search, four structured and 68 model
attempts**, with 266 conservatively reserved observations. All attempts are settled;
no outstanding reservation, writer/source/model lock, overrun or reconciliation
requirement remains. Model attempts comprise 34 free CountTokens calls and
34 generations. Conservative accounted cost is **EUR 0.261393** (search EUR 0.20,
model EUR 0.061393), not a provider invoice. No new paid source or fallback was used.

Decision: close G3 as an executed investigation with negative A/B/C findings and
approved corrected D artifacts. This does not pass the unmet V1 quality/coverage
criteria or G5's human benchmark. Continue synthetic G5 guards and improve source
extraction/compatible coverage before broad operational use; do not adopt an
unmeasured fallback or trust model eligibility. No further G3 dispatch is scheduled.
The duration waiver removes calendar waiting only. Latest future origin state is
`.local/g3/structured-snapshot-v1/ownership.json` plus shared persisted cooldowns;
future operators reread cooldowns inside the shared lock. Do not reuse a fresh source
ID or stale ownership snapshot to bypass pacing. The older 30-URL method remains
immutable; its pre-lock cooldown read was safe only in the coordinated exclusive run.

Both packets, all labels/notes, archived inputs, logs and derived copies inherit
their actual recorded expiry, which can be earlier than seven days. The private
retention inventory records those deadlines; replay never renews them. Retain only
minimal technical ownership/cooldown/cumulative-cap state needed after cleanup.


## Autonomous quality remediation evidence

The unchanged synthetic corpus fed one CountTokens call and one generation under
ADR 0023 in `.local/g3/remediation-model-v2/`. Its exact frozen method hash is
`ff96149b3860cdbd8c663b8f418865ee9d08ab8a5512201f3486f3b0dc11924f`.
All 20 matching outputs have correct decisions. The five packages omit required
channel references, proposed-answer fact references and/or include duplicate fields
and internal analysis in applicant copy. The actual failed output remains preserved;
no editorial correction is represented as model success. One generation produced
all 25 outputs, not 25 independent calls. Reviewed per-question fact scopes assisted
generation and do not test general question-to-fact selection. Usage: 7,895 input,
2,413 candidate and zero thought tokens; conservative cost EUR 0.018483.

`model-remediation.ts` validates complete case identities, channels and field-specific
fact scopes. `package-remediation.ts` adds a stricter provider schema and final-copy
instructions for the sole permitted repair of that failed generation. It is tested
offline; the repair is not dispatched while the explicit 70/day allowance is full.
No calendar polling, daily-cap increase or alternative-provider bypass is scheduled.
The five D editorial versions and earlier CV observations remain separate evidence.

`.local/g3/extraction-remediation-v2/` preserves the original v1 labels/report and
corrects only four demonstrable application-route omissions. A separate agent
checked those changes against actual source bytes. The v2 label hash is
`3d9cb5e520facda9f896ed0a638f7f6dc7638197e0351e911c3f223db066c26d`;
exact source closure is
`ec6fa5ef55943e8673fe81c2585850bbdd7af0f2876649625e2d091a99faeeb9`.
The known 30-row development replay identifies 11 of 12 details, recovers 47 of 49
present fields, has 47 correct of 47 extracted decisive fields and zero false
confirmations. Source quotes, form intent, safe routes, missing values and true
oracle facts beyond extractor limits have focused regressions. This does not
establish independent source generalization or live browser-rendering benefit.

`.local/g3/coverage-followup-v2/` executed eight unchanged queries at offset one:
four Berlin and four Germany-remote. All eight searches succeeded; 80 URL-only
entries contain 76 distinct target URLs, 61 absent from the original search set.
No search snippets/raw provider payloads or titles were retained. The failed v1
startup exceeded a local run-duration bound and made zero calls/reservations;
its failure and exact reconciliation remain preserved separately. The reviewed v2
method is `9b3ecbd8b75c6e44264f7b5befddadc6caf6570b2c0beea2581f35d76b56b6f9`.

At this checkpoint the cumulative ledger is 104 HTTP, 28 search, four structured
and 70 model requests, 346 reserved observations, no outstanding attempts or
reconciliation fences. Conservative accounted cost is EUR 0.359876, not an invoice.
Latest future origin state is `.local/g3/coverage-followup-v2/ownership.json` plus
shared cooldowns reread inside the source lock. Subsequent captures must inherit
that state and stay within the remaining 96 HTTP/54 observations. Known source
restrictions remain in force; extra search entries are not verified vacancies.


The first combined gate exposed a reviewed-selector compatibility regression:
generic extraction's new no-evidence reason skipped an existing explicit reviewed
selector path. The fix restores that path while retaining distinct multiple-role,
non-vacancy and no-opening refusals. Independent focused extraction/discovery
checks pass. `.local/g3/extraction-remediation-v3/` preserves the v2 report and
replays the same previously frozen corrected labels against the final fixed bytes:
11 correct details, 47/49 recovery, 47/47 precision and zero false confirmations.
Its source closure is
`7d81ff81b71df9e23beec079a06cf7419359b7a7e04446d9fda8058e5c120a00`.
Reports retain the base commit in `methodVersion`; archived source/runtime closure
hashes identify the actual modified code, not an unmodified base checkout. This
remains known-cohort development evidence, with no new external requests.


### Independent new-source capture

The separately frozen `.local/g3/source-capture-followup-v1/` method
`a17850a4c634443a36cee6b318a13b92b62a525b443289aa876cb32a7f7b3506`
ran once after independent review and zero-network refusal proofs. It made 58 HTTP
requests for 31 fixed targets plus seven navigation children, with no rechecks.
The fixed 30-case benchmark was selected before fetching; the remaining eight
observations are supplements and cannot replace its failures. Actual benchmark
outcomes: 19 HTML, five source-policy stops, one access stop and five unavailable.
Seven further HTML bodies and one policy stop are supplemental. All 26 successful
page final URLs are distinct. Requested strata/local-business flags were sampling
hypotheses, not actual content or local-employer evidence.

Independent source inspection identifies eight formal specific TU vacancies,
seven career leads, four negative/expired pages and eleven unavailable cases.
Only two formal cases establish local-business membership. Additional mandatory
German or specialist requirements, missing hours/language evidence, old deadlines
and explicit no-openings content prevent a compatible-vacancy claim. This is an
observed bounded cohort, not a determination that the wider market has no jobs.
The independently grounded labels must freeze before the first extractor replay.

There are 38 page diagnostics but 37 new record reservations: one operator-picked
target failed before its first HTTP reservation; its specific transport/DNS cause
is unknown. Every one of the 58 HTTP attempts is accounted and settled, including
robots and redirects. The cumulative ledger is 162 HTTP, 28 search, four structured,
70 model and 383 reserved records, no outstanding attempt, lock or reconciliation
fence. Conservative accounted cost remains EUR 0.359876; the HTTP reads add no
metered provider charge. Remaining allowance: 38 HTTP/17 records, zero model calls
today. Latest technical origin state is this packet's `ownership.json` plus shared
cooldowns. New bodies, labels, notes and derived copies expire at the earlier
actual dispatch ceiling **2026-10-19T21:58:33.168Z**, never the later planned ceiling.


A separately reviewed canonical-host recovery supplement corrected an overly narrow
private operator rule: three exact initial paths were read on already approved
apex counterparts, with actual robots redirects as provenance. It made three HTTP
requests and three record reservations: two HTML pages and one preserved 404.
Method `74c599975c81bd87cdef5beec61f744d7d6f9587ba7034514e4aecd4bb4fbf03`
and all 29 input/archive hashes were independently checked before and after.
The fixed 30-case benchmark and its failures are unchanged. This is not another
fresh benchmark or an original first-pass success. No public runtime code changed.

Current cumulative usage after recovery is **165 HTTP, 28 search, four structured,
70 model and 386 reserved records**; all settled with zero locks/fences/outstanding
attempts. Conservative cost remains EUR 0.359876. Latest origin snapshot is
`.local/g3/source-capture-recovery-v1/ownership.json`, plus shared cooldowns reread
inside the source lock. Remaining allowance is 35 HTTP/14 records, zero model calls
today. Both new packets and their derived evidence expire at 21:58:33.168Z today.


### First independent extraction result

The independent author froze labels before extraction. Pure validation first refused
missing `policyRef` metadata; all initial artifacts are preserved unchanged in
`independent-v1-schema-refused/`. Only policy references and bound freeze metadata
were corrected, with the same 30 identities/order/strata, kinds, facts and capture
hashes. The evaluated freeze is **21:06:35.329Z**, not the invalid earlier receipt.
Manifest hash `3ba6d738be2f8a5629fb929ea463d03d2ad9d13afea366e2b65398dca97745d8`
and label hash `aa464b803b060b9e93f790c5bae86311ae93d8f2f1fdda8ac1229ac43daa7b3a`
passed separate pure oracle validation before the first actual scorer invocation.

The preserved first report at 21:06:52 identifies all eight specific details but
recovers only **16/32** decisive fields (50%) with **16/24** precision (66.7%) and
zero false confirmations. All eight normalized language values lose source
qualifications or conditions; all eight application routes are missed. Attached
full evidence quotes do not repair a lossy normalized fact. Independent review
reproduced every case/aggregate/stratum result and confirmed those are substantive
quality failures, not merely interchangeable encodings. Formal sample readiness is
also incomplete: eight details, two confirmed local sources, unbalanced planned
strata and no demonstrated JS cohort. No benchmark or source-coverage pass follows.
The first failed result remained immutable through review and repair; subsequent
runs on these exposed pages are development evidence. The early cleanup below
retains its digest and aggregate history rather than the raw source artifacts.

A final independently reviewed actual-anchor supplement fetched five exact retained
recruitment links in five HTTP attempts, all HTML with matching body hashes.
Its method is `a4c2f973efea16b8e884d973104dc0feb780d45fe6b8227e77fe270237426c7e`.
The three capture batches therefore contain 46 page observations/diagnostics and
33 retained HTML bodies, using 66 HTTP and 45 new record reservations. No search,
structured or model call occurred inside them. Source expansion is stopped; the
fixed 30 cases and their failures never change or absorb supplemental successes.

Latest cumulative accounting: **170 HTTP, 28 search, four structured, 70 model,
391 reserved records**, all settled, no locks/outstanding attempts/fences. Cost
remains conservatively EUR 0.359876; 30 HTTP/nine records remain, zero model calls
today. Latest future origin state is
`.local/g3/extraction/ownership-retained-v1.json` plus shared cooldowns under the
source lock. The three new packets had a 21:58:33.168Z ceiling and were deleted
early after verification, as recorded below.


Separate independent source review of all three new packets binds all 33 HTML
body hashes and the retained parent-anchor/redirect proofs. The 46 observations
contain 16 specific detail pages, two Silo role sections and one truncated Father
teaser. There are **zero confirmed compatible/current unique vacancies**, zero
compatible Germany-remote vacancies and zero proven incremental Brave-compatible
vacancies. Additional German levels, specialist/enrollment/shift conditions and
missing accepted-language/hours/currentness evidence remain decisive. The 10+3
coverage criterion therefore remains unmet. Original formal benchmark membership
and all failed observations are preserved; supplemental source observations do not
supply missing benchmark strata or confirmed-local membership retroactively.


### Final bounded extraction repair and development replay

The generic repair preserves the entire bounded language requirement clause,
including proficiency, written/spoken scope, conjunction/alternatives, preference
versus obligation and missing-language learning commitments. Independent or
incomplete clauses remain unknown. A shared narrowly scoped mailto-context helper
requires an explicit same-line recruitment direction and rejects inquiry, privacy,
support, negation, multiple recipients and conflicting visible/href recipients,
including nested plaintext fallbacks. Generic application-word anchors cannot
bypass those checks. All discovered channels remain unverified. Synthetic
positive/adversarial cases and independent code re-review cover these behaviors;
no actual source page, email address or recruiter identity enters committed tests.

The final exact source/runtime closure is
`81352867d89c43087f6ac3cabad50fcf958dd1d41fb2f47d7e2159f8cadd5437`.
The unchanged new-source labels pass pure validation, then a separately versioned
**development** replay recovers 32/32 fields with 32/32 precision, eight correct
details and zero false confirmations. Status remains **incomplete** because the
formal sample still has only eight details/two confirmed local sources and missing
planned strata. This is not an independent first-pass acceptance or a replacement
for the preserved 66.7%/50% first result.

The old corrected known-cohort oracle was also replayed unchanged against final
code in `extraction-remediation-v4/`: 40/49 recovery (81.6%), 40/47 exact precision
(85.1%), eleven correct details, zero false confirmations; its method-bound outcome
is **failed**. The historical v3 report remains 47/49 and 47/47 for its own exact
bytes. No oracle values or precision thresholds were loosened after seeing output.
Neither development report establishes full G3 B acceptance.

Independent inspection grounds the seven exact-value differences in complete
source language blocks rather than the old oracle's shorter accepted strings.
One block also retains adjacent teamwork/learning context. These are not seven
fabricated source claims, but the unchanged exact diagnostic still fails; no
replacement semantic score or retrospective acceptance is claimed.

### Verified early source cleanup

After independent reproduction and the final integrated gate, all three new
task-owned source packet trees and their derived copies were deleted at
**2026-10-19T21:24:05Z**, before their retention ceiling. The cleanup removed 439
files. The private aggregate receipt
`.local/g3/source-remediation-closure-v1.json` retains method/report/tree digests,
numeric results and deletion provenance without source URLs, quotes, addresses or
bodies. Raw-source reproducibility for these packets ended at deletion. The first
failure and final development result remain distinct aggregate observations.

The cumulative ledger, shared cooldowns and minimized 53-origin ownership/pacing
snapshot remain unchanged. Old B/G4/structured evidence and synthetic model parents
were outside this cleanup and retain their separate deadlines or purposes. The
final isolated gate passed 200 offline tests, two emulator integrations, two
synthetic Chromium journeys and a separate actual-source Chromium regression, with
zero external provider calls. No G3 acceptance criterion is waived by cleanup.
