# G3 setup and resumable experiment

Status: partial live extraction pilot recorded, 2026-10-19. G3 is not complete.
No discovery benchmark or model call has run. Gmail now serves Firebase
Auth login only under [ADR 0010](adr/0010-manual-application-packages.md); no mailbox
API/OAuth integration is part of current V1/G3. The pilot and separate diagnostics
are recorded below; they do not pass branch acceptance. The
seven-day observation window has not started. [FEASIBILITY.md](FEASIBILITY.md)
remains the experiment contract.

## Current readiness

| Branch | Evidence available | Remaining prerequisites or measurements |
| --- | --- | --- |
| A: discovery | Twenty frozen non-personal queries; local Brave credential located without disclosure | Exact plan/storage entitlement; source-specific rights and up to five useful initial boards; reviewed live runner |
| B: extraction | Ten-target live pilot and frozen, independently reviewed labels; measured JSON-LD-only baseline; corrected access-marker heuristic | Complete 30-URL stratification, at least 30 present decisive values, sufficient retrieved details and a separately versioned next measurement |
| C: model | Project/ADC access and enabled billing verified; Vertex API enabled; synthetic Alpha facts explicitly approved privately; offline CV/model corpus and scorer | Supported EU model configuration with conservative billed-token bounds, actual model compatibility/usage, reviewed live runner and generated results |
| D: manual packages | Revised bounded rubric for same 5 C packages (2 email + 3 questionnaire) | Generated full content, source-evidenced questions mapped by internal IDs, supported claims, exact reviewed content hashes and explicit human review; no UI/clipboard acceptance yet |

The intended GCP/Firebase project is designated privately, with an EU preference.
After the earlier permission failure, current CLI and ADC project reads succeeded,
and enabled billing was verified. The existing project's Vertex AI API
(`aiplatform.googleapis.com`) was enabled successfully; no deployment, IAM or
billing change was made. This establishes access prerequisites, not GenerateContent
compatibility or an inference result. Private evidence: `gcp-current-check.json`,
`vertex-api-setup.json` and `adc-check.json` under `.local/g3/`.
The local Brave variable was normalized to `BRAVE_API_KEY`; no value was printed.
The user has not confirmed the tariff/storage entitlement, so persistent Brave
result storage and the discovery benchmark remain disabled. Firestore is the
planned database; it does not confer Brave's contractual storage rights.

The offline synthetic corpus has three profiles, three textual PDFs, one scan-only
PDF, one malformed PDF, twenty labeled jobs and five package cases. The five pages
across valid PDFs were visually inspected and their page/text behavior checked;
the scan has no extractable text and the malformed input fails local parsing.
The strict corpus, prompts and report scorer are implemented and locally verified.
The parsed corpus SHA-256 is
`46d5eae10c2d38673429817e9da772ca9e14cb975825561a1a7a52697a160df3`.
The user explicitly approved Alpha's ten synthetic facts; the corpus-bound receipt
is private at `.local/g3/profile-approval.json`. This is test-only approval, not real
applicant data or approval of generated package content. Public fixtures remain
pending; no model output or package-content review exists. Final private PDFs,
page-text JSON and the source-hash manifest are under
`.local/g3/model-fixtures-v1-final/`; their five PDFs are byte-identical to the
visually inspected inputs. The final manifest matches the current corpus file.

## Runner boundary

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
HTML challenge-marker matching is deliberately conservative and can flag ordinary
pages mentioning CAPTCHA/login. Its marker outcome does not prove an authentication
wall; actual 401/403 status outcomes remain distinct.
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

The ten-target pilot below is partial B evidence. A/C/D remain unexecuted against
their required samples; no branch is passed. Resolve the remaining plan/model
conditions and complete the actual live adapters, then start A's seven-day coverage window with the frozen
queries. After that first discovery dispatch, use `status` for the next due Berlin
date and record gaps; do not keep an agent waiting for calendar time.

## Current provider references

Reviewed 2026-10-19. Project/ADC access, billing enablement and API setup have private
observations above. Actual plan entitlements, credits, inference compatibility,
quotas and account-specific billed rates remain unverified.

- Brave currently lists USD 5 per 1,000 Search requests. One hundred attempts are
  forecast at USD 0.50 before account-specific credits, currency and taxes. Do not
  assume credits. Result storage requires an entitlement expressly granting it;
  search access grants no rights to third-party pages. Confirm the actual plan
  before retaining URLs/snippets/raw results. [Pricing and storage](https://brave.com/search/api/).
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
Paid API spend remains EUR 0; the discovery clock has not started. No solver,
browser, new dependency or provider account was used.

## Conservative synthetic model dispatch

The next selected configuration is Gemini 3.5 Flash-Lite Standard PayGo in EU,
with a single direct v1 `generateContent` response, `candidateCount: 1`, JSON
response schemas, `maxOutputTokens: 2048` and `thinkingLevel: MINIMAL`.
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
remain private. No generated result exists yet.

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
