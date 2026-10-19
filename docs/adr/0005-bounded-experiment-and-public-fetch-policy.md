# 0005: bounded feasibility experiment and public-page fetch policy

- Status: accepted
- Date: 2026-10-19

## Context

The user agreed to continue with the recommended Gemini/GCP, Brave and HTTP/Cheerio
baseline and wants broad discovery beyond conventional job platforms, including
robots-independent reach. The pilot ceiling is EUR 50/month. G1 needs an executable
experiment contract, while G2 must remain possible without live credentials.

## Decision

- Use the seven-day, EUR 5 incremental-usage planning ceiling and shared resource
  caps in `docs/FEASIBILITY.md`; no subscriptions or live execution are requested here.
- Measure 10 verified compatible vacancies, including 3 incremental web discoveries;
  distinguish unknowns and report each stream, extraction, model and Gmail separately.
- Adopt manual reconciliation for ambiguous Gmail writes initially. Do not retry
  creates blindly, overwrite human edits, monitor mail, or infer that a draft was sent.
- Discover new public domains through search and career-page links. No fixed list
  of previously approved employers is required to retain a lead.
- Record robots rules, missing files and retrieval errors as metadata; they are not
  authentication and do not independently exclude a lead or block a public-page fetch.
- Direct fetches use the general public-source policy: unauthenticated HTTP(S),
  validated public destinations/redirects, bounded traversal, time/size limits,
  domain pacing and minimal retained evidence. Do not infer reuse/storage rights
  from public access or robots status. Record source-specific terms and retention;
  a known conflicting source restriction needs explicit resolution before that use.
- HTTP 401/403, login or CAPTCHA challenges stop that page attempt; no evasion.
  Respect 429/Retry-After; allow at most one bounded transient retry in the experiment.
  Missing/unreadable robots does not authorize an unbounded crawl or repeated probes.
- Reject internal/private/metadata destinations and unsafe redirects; apply the
  same controls to browser subrequests. No credential forwarding to discovered pages.
- Keep unavailable/policy-unresolved leads with an original link where retention
  permits. Their unknown claims/channels cannot become verified through scoring.
- Check hosted-provider behavior against this policy; library/API features cannot
  promise universal extraction or silently relax resource/network boundaries.

## Alternatives

- API-only or robots-based blanket exclusions: lose the user's intended discovery reach.
- Ignore every restriction or expand retries until extraction succeeds: no bounded
  cost/access contract and no reliable guarantee of availability or lawful reuse.
- Add full automated Gmail reconciliation/mail reading: unnecessary scope for the pilot.

## Consequences

Q7 has an explicit operating policy; page-specific rights and provider constraints
remain G3 checks, not a claim of universal permission or tested compatibility.
G1 can close with live-access prerequisites recorded; G2 starts offline, and G3
records actual evidence. Robots/access distinction follows
[RFC 9309](https://www.rfc-editor.org/rfc/rfc9309.html), not a legal clearance.
