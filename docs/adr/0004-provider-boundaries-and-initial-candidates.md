# 0004: provider boundaries and initial LLM/search candidates

- Status: accepted
- Date: 2026-10-19

## Context

Firebase/Blaze, a Gmail test account, and Brave API access are user-reported available.
The user wants provider flexibility and accepted the recommended GCP/Gemini, Brave
and HTTP/Cheerio baseline, with a EUR 50 total monthly ceiling. No live access is verified.

## Decision

- Keep structured LLM generation and web search behind small application-owned
  boundaries. Normalize outputs and usage; validate schemas independently of a provider.
- Implement one backend per boundary first. Use GCP-managed Gemini as the
  initial LLM route; keep OpenRouter as an alternative or later evidence-driven adapter.
- Do not require OpenRouter just to make provider switching possible. A router is
  itself a provider dependency and does not remove model quality/privacy differences.
- Begin search experiments with existing Brave access; compare one alternative
  from Serper/Tavily/Exa using the same query sample before expanding integrations.
- Use controlled HTTP/Cheerio extraction; compare Playwright and Firecrawl
  on unresolved pages and adopt at most one fallback when incremental yield warrants it.
- Pin and record model, endpoint/provider, prompt/evaluator versions, and costs.
  Restrict fallback routes; do not silently relax privacy, schema, or spend limits.
- Treat published USD rates as research snapshots. Recompute the forecast for the
  actual model/region/plan, including extraction, fixed fees, taxes, and currency effects.

## Alternatives

- OpenRouter first: convenient access to multiple model families, but adds routing,
  provider-policy configuration, and billing before the first model has been evaluated.
- Hardcode GCP model calls in domain code: initially simple but expensive to change.
- Integrate all search providers immediately: adds costs/maintenance before proving yield.

## Consequences

G2 can establish boundaries and synthetic contracts without selecting live credentials.
G3 needs a confirmed route, source/storage policy, and paid-test cap. No purchase,
cloud provisioning, automatic multi-provider fan-out, or deployment follows from this
decision. Exact models and provider plans remain unselected. See
[provider evidence and cost examples](../PROVIDERS_AND_COSTS.md).
