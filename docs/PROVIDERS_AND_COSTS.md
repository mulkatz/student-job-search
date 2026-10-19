# Provider options and pilot cost model

Updated/researched: 2026-10-19. Recommendations and published price examples below
are not live integration results, selected subscriptions, or a complete monthly quote.

## Available access

User-reported: Firebase project with Blaze enabled, a Gmail test account, and Brave
Search API access. These are available for future integration work, not verified
connections. Project/region/IAM, enabled APIs, OAuth client/consent, refresh behavior,
and Brave plan/storage conditions still need checking. No OpenRouter account, model
endpoint access, alternative search account, or credential is assumed.

The total monthly operating ceiling is **EUR 50**, across cloud, search, LLM, and any
hosted extraction. A per-experiment paid-test ceiling remains open. No account,
billing setting, subscription, API key, or live provider request was changed by
this research.

## LLM recommendation

Keep an application-owned structured-generation boundary with typed inputs, schema
validation, timeouts, token limits, versioning, and usage/cost reporting. Provider
SDKs and routing settings stay behind it. Start with one backend; a provider-neutral
boundary does not require implementing every adapter in V1.

**Recommended first backend:** Gemini directly through the GCP-managed model service
(Vertex AI; current documentation redirects to Gemini Enterprise Agent Platform).
This reuses the existing cloud/billing context and avoids adding a router for the
first working slice. Blaze alone does not prove model access. Select a supported
cost-effective model and region after checking lifecycle, access, structured output,
and synthetic CV/matching/draft evaluations; do not pin a model from a price example.

**OpenRouter alternative:** useful for comparing model families or adding an adapter
when measured quality/availability justifies it. It is not required to preserve the
ability to switch providers. It adds routing/data-policy configuration and another
billing relationship; it does not make different models equally good at our tasks.

| Route | Relevant published facts | Pilot implication |
| --- | --- | --- |
| GCP-managed Gemini | Token/model/endpoint-dependent prices. Google documents no training without permission, while retention has feature-specific exceptions. | Use server-side identity, a reviewed endpoint and minimal CV facts; do not equate no-training with zero retention or EU-only processing. |
| OpenRouter | Provider inference list prices are passed through; Standard credit purchases have a 5.5% fee. Routing offers collection/ZDR/required-parameter filters. | Pin model and reviewed providers, constrain fallbacks, retain schema validation, and configure privacy explicitly before real CV facts. |

For OpenRouter, evaluate `data_collection: deny`, `zdr: true`, and
`require_parameters: true` against the selected endpoint; review underlying terms.
Filters can remove all available routes. Fail visibly rather than silently relax
privacy, region, schema, or cost restrictions. Do not default to arbitrary free or
automatically changing model routes for applicant data.

Official references: [GCP pricing](https://cloud.google.com/vertex-ai/generative-ai/pricing),
[GCP data governance/retention](https://docs.cloud.google.com/vertex-ai/generative-ai/docs/vertex-ai-zero-data-retention),
[OpenRouter pricing](https://openrouter.ai/pricing),
[routing and privacy parameters](https://openrouter.ai/docs/guides/routing/provider-selection).

## Search comparison

Use the existing Brave access as the first test candidate behind a search adapter.
Compare alternatives on the same query set before adding another production connector.
Search-provider prices are USD snapshots, not EUR invoices or grants of page/storage rights.

| Candidate | Published usage price | What to measure for this project |
| --- | --- | --- |
| Brave Search | USD 5 / 1,000 requests; published USD 5 monthly credit, subject to the actual plan. | Baseline with existing access; useful small-employer coverage and compatible storage rights. |
| Serper | Starter USD 50 prepaid for 50,000 queries, nominally USD 1 / 1,000; credits valid six months. | Alternative Google-result coverage; distinguish prepayment from marginal price and review service/retention terms. This is a third-party SERP service, not Google's official search API. |
| Tavily | PAYG USD 0.008 / credit; basic search 1 credit, advanced 2. | Search plus optional extraction; compare credit cost per operation, not just request count. |
| Exa | Lite USD 4 / 1,000 requests; Auto USD 7 / 1,000, up to 10 results; contents and extras separately priced. | Complementary retrieval/contents coverage; compare additional unique verified jobs after deduplication. |

References: [Brave](https://brave.com/search/api/), [Serper](https://serper.dev/),
[Tavily](https://docs.tavily.com/documentation/api-credits), [Exa](https://exa.ai/pricing).
Alternative-provider accounts, retention/redistribution rights, and availability
are not yet verified. Do not automatically query every provider on every run.

Proposed comparison: 20 fixed English/German queries spanning the two search streams,
review the top 10 results per query, and test Brave against one available alternative
within an agreed test cap. Measure confirmed suitable vacancies, incremental unique
employer/job coverage, freshness, errors, and total search/extraction/model cost per
useful vacancy. Search-result count alone is not the selection criterion.

## Cost illustration and controls

At 20 search requests/day for 30 days, Brave's published base usage is USD 3 before
credits or plan-specific charges. This does not price a storage-rights agreement.
For 40 job evaluations/day, assuming the entire request averages 4,000 input and
600 billed output tokens, monthly volume is 4.8M input and 0.72M output tokens.
The pricing page lists Gemini 3.1 Flash-Lite global standard text rates at USD 0.25/M
input and USD 1.50/M output: **USD 2.28** for that illustrative evaluation volume.
This is not the selected model/endpoint or a total LLM bill: regional pricing,
reasoning output, retries, parsing, package generation, and other calls change it.
Use the [current GCP price table](https://cloud.google.com/vertex-ai/generative-ai/pricing)
to recompute once model/region and observed token use are known.

Proposed monthly envelopes: cloud EUR 15, search/hosted extraction EUR 15, LLM EUR 10,
reserve EUR 10. These divide the EUR 50 ceiling; they are not provider quotes or
individually authorized purchases. Include tax, currency effects, fixed fees, and
extraction credits in the forecast. Hosted rendering/extraction may dominate token cost.
The [extraction comparison](EXTRACTION_OPTIONS.md) recommends HTTP/Cheerio initially;
a Firecrawl subscription is not part of this baseline. Rebalance the total forecast
before adding a paid fallback rather than silently adding it above the ceiling.

Apply deduplication and deterministic filtering before LLM calls, cache/reuse only
where allowed, and budget all retries/fallbacks. Enforce run/month request and token
limits with reservations before paid work; show stopped/partial runs honestly.
Keep model cost and search/extraction cost separate, and do not log CV/request text.
Firebase budget alerts alone do not pause services. Check available spend caps for
the actual services and add application limits; do not promise an instantaneous
aggregate hard EUR cap across independent providers.
[Firebase billing controls](https://firebase.google.com/docs/projects/billing/budget-alerts).

## Next decisions

Confirm the first LLM route after discussing this recommendation; then check model
access, lifecycle, region/privacy, and schema support with synthetic inputs in G3.
Resolve the actual Brave plan, source-policy questions, extraction approach, and
paid experiment cap before live tests. G2 can still proceed entirely offline.
