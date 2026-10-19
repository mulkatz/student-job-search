# 0003: V1 application assistant and broader web discovery; V2 broader use

- Status: accepted for release boundaries and discovery architecture; crawl policy remains Q7
- Date: 2026-10-19

## Context

A discovery-only V1 was discussed but the user explicitly kept CV processing,
application text, and Gmail drafts in V1. V2 should provide the tool to additional
users and add individually managed search orders. Conventional job sources may
miss relevant smaller employers; actual coverage needs validation.

## Decision

- V1 includes login, a table sorted by fit score, CV extraction/profile approval,
  matching, application text, and verified-channel Gmail drafts. Sending stays manual.
- Treat discovery, matching, and applications as internal V1 slices. Gmail failure
  permits degraded discovery operation, not declaring V1 complete.
- V2 adds multi-user onboarding and user-managed search orders/configuration,
  including create/edit, active/paused state, and individual schedules.
- Keep V1 search streams operator-configured and candidate preferences editable;
  retain ADR 0002's ownership boundary without building V2 administration.
- Add web-search discovery and bounded employer-page extraction alongside structured
  source adapters. Include small employers outside major platforms and avoid a fixed
  curated-domain-only coverage limit. No universal extraction guarantee is possible.
- Separate leads, fetch outcomes, and verified vacancies; preserve provenance and
  use one normalization/deduplication/matching pipeline across source paths.
- Evaluate Brave as a candidate with plan-specific retention/AI-use checks. Do not
  assume Google Custom Search JSON API access for a new project.
- Track the user's request for robots-independent coverage and the unresolved exact
  automatic-fetch policy in Q7. Robots metadata, technical access, and reuse rights
  must not be collapsed into one permission flag.

## Alternatives

- Discovery-only V1, Gmail in V2: smaller release but does not meet the user's scope.
- Structured APIs/ATS boards only: simpler, but leaves smaller-employer coverage untested.
- Unbounded recursive crawling: unpredictable cost, irrelevant links, and no reliable
  guarantee of content access or correct vacancy evidence.

## Consequences

V1 remains a one-person product with a simple interface and an end-to-end application
assistant. Broader discovery adds source-policy, extraction, and coverage work now;
multi-user search management stays out of V1. No source/API/crawler has been tested.
This extends ADR 0002; it does not supersede its ownership decision. Dated provider
findings and official references are in [source discovery](../SOURCE_DISCOVERY.md).
