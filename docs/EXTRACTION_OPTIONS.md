# Public-page extraction options

Status: research and recommendation, not an accepted dependency decision or tested integration.
Official sources opened and reviewed: 2026-10-19. No provider calls, accounts,
subscriptions, installations, or real candidate data were used.

## Recommendation for V1

Start with controlled HTTP retrieval plus Cheerio, extracting structured JobPosting
data and relevant HTML text. Benchmark a bounded Playwright rendering fallback
against Firecrawl only on pages where HTTP extraction misses useful vacancies.
Select at most one fallback from that comparison, rather than implementing both
by default. Keep a small extraction adapter; do not build a crawling platform.
This recommendation minimizes fixed spending within the EUR 50 total monthly
budget while preserving discovery on newly encountered small-employer domains.

Search finds URLs; retrieval obtains content; parsing finds fields; verification
establishes evidence. None of these alone establishes an open, suitable vacancy.

## Options and responsibilities

| Option | What it supplies | JavaScript sites | Operation and cost | V1 assessment |
| --- | --- | --- | --- | --- |
| Controlled HTTP + Cheerio | Node/TypeScript HTML/XML parser and selectors; Cheerio also has URL-loading helpers | No page JavaScript execution | In our Cloud Run process; no parser subscription; compute/network charges remain | Smallest baseline; own fetch controls and extraction rules |
| Crawlee | Node/TypeScript crawl orchestration, queues, concurrency and retries; CheerioCrawler or browser crawlers | CheerioCrawler does not render; PlaywrightCrawler does | Self-hosted library; no mandatory Apify subscription; browser/compute costs remain | Useful if bounded traversal and recovery outgrow a small worker |
| Playwright directly | Browser control, rendering and DOM access, rather than vacancy extraction | Yes, for technically accessible pages | Browser image, patches, CPU/memory, startup and egress | Small fallback before adopting a full crawler framework |
| Firecrawl Cloud | Hosted scrape/crawl API; HTML/Markdown and optional LLM JSON; official Node SDK | Provider-managed rendering | Free and subscription credits; less browser operation, additional processor | Compare as fallback; do not make it a paid baseline before measured benefit |

Capabilities: [Cheerio introduction](https://cheerio.js.org/docs/intro/),
[Crawlee quick start](https://crawlee.dev/js/docs/quick-start),
[Firecrawl Node SDK](https://docs.firecrawl.dev/sdks/node).
Cheerio's `fromURL` follows redirects; use our controlled retrieval layer rather
than treating a loader as the network-security boundary.
[Cheerio loading documentation](https://cheerio.js.org/docs/basics/loading/).

Cheerio is MIT, Crawlee Apache-2.0, and Playwright Apache-2.0. Firecrawl's core is
AGPL-3.0, while SDKs and some UI components use MIT; check the selected directory.
Hosted API consumption and self-hosting the core are different choices.
[Cheerio repository](https://github.com/cheeriojs/cheerio),
[Crawlee repository](https://github.com/apify/crawlee),
[Playwright license](https://github.com/microsoft/playwright/blob/main/LICENSE),
[Firecrawl repository](https://github.com/firecrawl/firecrawl).

Current official repositories/docs provide maintained upstream options, not a
support guarantee. Pin compatible releases and Node/browser versions at adoption.
Self-hosted Firecrawl brings multiple supporting services and explicit upgrade,
storage, security and recovery work; its default stack has Cloud feature gaps.
It is disproportionate for the first pilot unless a benchmark proves otherwise.
[Firecrawl self-hosting guide](https://docs.firecrawl.dev/contributing/self-host).

## Firecrawl pricing and practical cost

Published pricing is in USD, effective September 4, 2026:

- Free: 1,000 credits per month, two concurrent requests, no card required.
- Hobby: USD 19 per month on monthly billing for 5,000 credits; USD 16 per month
  requires annual billing. Unused Hobby credits do not roll over.
- Hobby overage: 1,000 credits per USD 5; automatic top-ups can be disabled.
- Standard is displayed at USD 83 per month with annual billing, beyond this pilot's budget.
- Pricing lists a countersigned DPA from Standard and ZDR only on Enterprise;
  confirm actual lower-plan contractual options with the provider if required.

[Official pricing](https://www.firecrawl.dev/pricing). Confirm checkout, applicable
tax and exchange-rate effects before comparing a USD subscription with EUR 50.
No subscription or allocation of that budget is authorized by this research.

Basic scrape costs one credit per page; LLM JSON adds four, totaling five.
PDF parsing adds one per PDF page. A returned error document, including 403/404,
is billable; a basic scrape returning no document is generally uncharged, but
optional checks and other endpoints have exceptions. Check returned HTTP status.
[Official billing rules](https://docs.firecrawl.dev/billing).

Calculated illustration, not a measured workload: at full Hobby utilization,
USD 19 / 5,000 = USD 0.0038 per basic page or USD 0.019 per five-credit JSON page.
At 20% unique useful-vacancy yield, those become USD 0.019 and USD 0.095 per
useful vacancy respectively, excluding search, matching, cloud, tax and rechecks.
If only 100 useful vacancies are obtained, the full USD 19 subscription alone
costs USD 0.19 each. Free capacity is 1,000 basic or 200 JSON pages before extras.
These are arithmetic scenarios using the cited rates, not achievable-yield claims.

Do not pay an extraction subscription initially. Prefer a capped free experiment
on permitted public pages if its data conditions fit; keep automatic top-ups off.
Free parser software still consumes cloud resources. An extraction success can be
a generic careers page, duplicate or expired job, so measure cost per additional
verified useful vacancy rather than cost per successful HTTP/API response.

## Evidence, freshness and data handling

Extract JSON-LD JobPosting objects, including arrays/graphs, before text heuristics.
Fields such as employmentType, jobLocationType, applicantLocationRequirements,
datePosted and validThrough have useful structured meanings, but are optional and
can be stale or contradictory. Cross-check decisive claims against visible content.
[Schema.org JobPosting](https://schema.org/JobPosting).

Proposed evidence contract: original and final URL, discovery/run reference,
retrieval time, provider/method/version, HTTP outcome, content revision hash,
field-level quoted evidence with selector/JSON pointer, and application channel.
Store minimal permitted excerpts; preserve raw HTML privately only with an explicit
retention basis. A source timestamp, provider-cache age and our retrieval time must
remain distinct. Unknown language or Germany-remote eligibility stays unknown.

Firecrawl documents a default two-day cache freshness window. Request fresh content
when rechecking an application channel; `storeInCache: false` controls caching,
not an enterprise ZDR contract. Its documented ZDR requires Enterprise activation.
Do not send CVs, private profile data, credentials or authenticated pages to the
extractor. Public pages can contain personal data; review processor conditions
before routing those pages through a hosted fallback.
[Firecrawl scrape/cache/ZDR documentation](https://docs.firecrawl.dev/features/scrape).

Cheerio is not an HTML sanitizer. Display escaped text or use a dedicated sanitizer;
validate extracted schemas and treat page/model instructions as untrusted content.
[Cheerio security documentation](https://cheerio.js.org/docs/advanced/security/).

## Access policy and Cloud Run operation

Resolve [Q7](OPEN_QUESTIONS.md#q7-broad-public-page-crawl-policy) before automatic
fetching. Keep new domains discoverable; no fixed approved-domain list is proposed.
Robots directives are distinct from access authorization under
[RFC 9309](https://www.rfc-editor.org/rfc/rfc9309.html); neither robots metadata
nor technical extractability establishes source reuse rights. Firecrawl states
that it respects robots by default and leaves site-policy compliance with users;
this may limit its fit for the user's requested coverage. Test actual behavior
against the agreed policy rather than assuming the provider bypasses restrictions.
[Firecrawl upstream access statement](https://github.com/firecrawl/firecrawl).

No option guarantees universal retrieval. Track authentication, 403/429, terms,
robots state and extraction failure separately. Preserve unavailable leads where
retention permits; do not convert snippets or blocked pages into verified jobs.
Use bounded depth/pages, domain pacing, response-size/time limits, redirect/DNS
checks and internal/metadata-network denial. Rendering must cover subrequests too.
Do not enable stealth, proxy rotation, CAPTCHA solving or access-control bypass
merely because a library/provider offers related features.

Google documents Chromium/Playwright operation in Cloud Run containers. Start with
low browser concurrency, bounded execution and no always-on browser pool; measure
memory and startup before sizing. Isolate the worker from candidate/OAuth secrets.
[Cloud Run browser automation](https://docs.cloud.google.com/run/docs/browser-automation).
Follow browser/container hardening and keep browser dependencies patched;
[Playwright Docker guidance](https://playwright.dev/docs/docker) explicitly treats
untrusted websites as a different isolation case from trusted tests.

## Bounded comparison before adoption

Proposed G3 experiment, subject to the agreed live-test budget and Q7: manually
label 30 public URLs spanning static detail pages, JS vacancies, careers lists,
expired/missing pages and small employers. Compare HTTP first; test each fallback
only on the same unresolved subset. Count correct fields with traceable evidence,
additional unique useful vacancies, unsupported claims, blocked outcomes, latency,
browser seconds and credits. A provider claim or mock is not coverage evidence.
Choose a fallback only when its incremental benefit justifies measured total cost;
if none helps, retain leads and reconsider sources rather than expanding retries.
