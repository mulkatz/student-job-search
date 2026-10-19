# Source discovery for V1

Status: provider research and bounded experimental HTTP fetching; a partial live
extraction pilot is recorded in [G3_SETUP.md](G3_SETUP.md#first-live-extraction-pilot).
No production source connector or successful discovery benchmark is established.
Official documentation reviewed: 2026-10-19. Access, costs, coverage, and page-level
conditions still need a bounded feasibility test.

## Coverage goal

Discover publicly advertised vacancies beyond major job platforms, including small
Berlin employers and Germany-compatible remote employers. Search for actual jobs
and discover employer career pages that can lead to jobs. An employer website or
“we welcome applications” message is not evidence of a specific open vacancy.
Jobs that have not been published anywhere cannot be promised as crawlable results.

V1 uses operator-configured queries and a daily schedule derived from the approved
pilot preferences. It does not expose a general search-order editor. V2 adds
individually managed searches, schedules, and multiple users.

## Three complementary discovery paths

| Path | Purpose | V1 treatment |
| --- | --- | --- |
| Structured job APIs and employer boards | Normalized vacancies with stable source IDs | Adzuna/Greenhouse/Lever candidates; validate access and useful coverage. |
| Web-search API | Find vacancies and career pages outside the structured set | Existing Brave access as first test candidate behind a replaceable adapter; validate plan/retention and coverage against alternatives. |
| Direct public-page retrieval | Extract and recheck the actual vacancy | Bounded fetch/extract/follow pipeline for discovered or operator-seeded employer pages. |

Search and extraction feed the same normalization, canonical identity, deduplication,
eligibility, matching, and application pipeline. Do not keep three independent job
lists or use search snippets alone as verified application evidence.

## Search strategy

Use both English and German discovery queries: a German-language page may still
offer English-compatible work. Query language is not evidence of workplace language.
Mix role, location, employment-type, and employer/sector terms, for example:

- `Berlin hostel receptionist part time English jobs`
- `Berlin Aushilfe Englisch Minijob Karriere`
- `Berlin museum event staff student jobs`
- `Germany remote working student customer support English`

Include smaller retail, hospitality, cultural, university, and local/community
sites where relevant. Avoid making a fixed major-platform exclusion the only way
to find them; preserve provenance and compare incremental coverage after deduplication.
Do not put candidate names, contact information, full CV text, or private identifiers
in search queries. Query/fetch budgets are set after the operator's cost ceiling.

## Lead-to-vacancy pipeline

1. Generate bounded queries from operator configuration and approved preferences.
   Keep the provider/query/run reference only where provider retention permits.
2. Treat returned URLs as untrusted leads. Separate provider response/snippet data
   from content subsequently obtained from the original source.
3. Classify the target as vacancy detail, careers/listing page, aggregator, unrelated,
   or unavailable. New employer domains can enter through this path; they need not
   have a handwritten adapter or belong to the initial curated board list.
4. Apply an explicit source/fetch policy, normalize the URL, and validate the target,
   DNS resolution, redirects, and any rendering subrequests. Reject internal/private/
   metadata targets; search results and redirects are not trusted network destinations.
5. Fetch bounded public HTML and extract JobPosting structured data when present,
   then relevant visible text. Cross-check structured claims against visible content;
   stale or contradictory markup becomes uncertainty, not confirmed suitability.
6. From a careers/list page, follow a small number of relevant job links within a
   configured depth/page budget. Crossing to a recognized ATS target goes through
   target validation and the same policy, not unrestricted recursive traversal.
7. Normalize an actual vacancy with original URL, source/evidence, content revision,
   application route, and separate discovered/checked/verification timestamps.
8. Deduplicate across all paths before scoring, model calls, or package generation.
   Record inaccessible or inconclusive leads separately from confirmed job records.

Use controlled HTTP retrieval plus Cheerio for the first extraction slice.
The [extraction market research](EXTRACTION_OPTIONS.md) compares Cheerio, Crawlee,
Playwright, and Firecrawl. Benchmark browser rendering against a hosted extractor
only where the feasibility sample demonstrates useful missed vacancies; choose
at most one additional fallback. This does not imply CAPTCHA solving, credential
bypass, or stealth scraping infrastructure.
No provider search call, page fetch, or rendering step is allowed an unbounded retry.

## Public-page fetch policy

The user wants coverage independent of robots-based exclusions. The accepted
[policy in ADR 0005](adr/0005-bounded-experiment-and-public-fetch-policy.md) records
robots metadata without using it alone to exclude leads or block public-page
fetches. There is no fixed preapproved-employer-only discovery scope. Source-specific
rights, storage conditions and technical access/network/traffic boundaries remain
separate checks; the policy is not a claim of universal permission or compatibility.

Record robots information separately from authentication, source terms, HTTP status,
and extraction success. RFC 9309 explicitly distinguishes robots rules from access
authorization; neither a missing file nor an allowed path establishes reuse rights.
See [RFC 9309](https://www.rfc-editor.org/rfc/rfc9309.html).

The implementation must distinguish `discovered`, `fetched`, `vacancy_verified`,
`needs_review`, and `unavailable` outcomes (exact schema to follow). An unavailable
page is not proof the vacancy is closed. An indexed snippet is not proof it is open.
Keep a lead and original link where retention permits instead of fabricating facts
or silently losing the discovery. None of these outcomes guarantees every public
page is extractable or permits bypassing access controls.

## Provider findings

- **Brave Web Search:** offers programmatic web results, country/language parameters,
  and freshness filters. These can support discovery; they do not prove job location,
  accepted work language, or vacancy publication time. Access is user-reported
  available; the actual plan and integration remain unverified.
  [Official API reference](https://api-dashboard.search.brave.com/api-reference/web/search/get).
- **Brave retention and content rights:** its FAQ requires a plan explicitly granting
  storage rights to retain API results, and says API access grants no rights to
  third-party webpages. The published base terms restrict persistent result storage.
  Check the actual contracted plan and AI-use conditions before designing a persistent
  shortlist around returned data. Separate search-response retention from original-
  page content retention; do not assume refetching changes rights to copied data.
  [Provider FAQ](https://brave.com/search/api/),
  [published terms](https://api-dashboard.search.brave.com/documentation/resources/terms-of-service).
- **Google Custom Search JSON API:** official documentation states that it is closed
  to new customers and that existing customers must transition by January 1, 2027.
  Do not choose this API as the default for a new project. This finding concerns
  that specific API, not every Google search product.
  [Official overview](https://developers.google.com/custom-search/v1/overview).

Compare Brave with Serper, Tavily, or Exa on useful incremental job coverage before
adding production providers. Published rates, prepayment/credit differences, and a
bounded comparison proposal are in [PROVIDERS_AND_COSTS.md](PROVIDERS_AND_COSTS.md).
Search-provider selection is separate from the page-fetch/parser/rendering choice.

## Feasibility evidence and V1 acceptance

Test both Berlin on-site and Germany-remote streams, with structured-source and
web-search samples over the same observation period. Include smaller employers in
the sample and report these measures separately:

- Queries, returned leads, distinct employer domains, fetched pages, rendering needs,
  confirmed vacancies, and request/token costs.
- Additional unique vacancies beyond the structured-source set after deduplication;
  a duplicated aggregator result is not extra coverage.
- Language/location/hours evidence, freshness, expiry, verified application channel,
  and manually judged student suitability.
- Unavailable pages, reasons, extraction errors, stale snippets, and generic careers
  pages without a vacancy; zero useful results is a valid failed experiment.

G1 defined numerical thresholds and limits in [FEASIBILITY.md](FEASIBILITY.md). V1 needs an
operational web-search/direct-page path that finds verifiable vacancies outside the
structured set; documentation research alone cannot pass that acceptance criterion.
Keep captures private unless storage and redistribution are permitted. Offline tests
use synthetic HTML/JSON for pagination, malformed markup, SSRF redirects, conflicting
evidence, duplicate URLs, prompt injection, failures, and bounded traversal.
