# 0009: synthetic model fixtures, prompts and reported evidence

- Status: accepted
- Date: 2026-10-19

## Context

G3 needs reproducible CV/model/proposal cases before a paid provider run. Fixtures,
expected answers and simulated test outputs are not model observations or human
approval. The current product prepares copy-only proposals under ADR 0010.

## Decision

- Validate a versioned synthetic corpus: three textual CVs, one scan-only and one
  malformed input, twenty labeled jobs (10/5/5), and five proposal cases. Bind
  profile/fact, document/page/quote, job/channel and questionnaire references.
- Canonically hash the parsed corpus. Reports and operator receipts bind that hash;
  changes invalidate prior evidence. PDF generation and visual QA remain separate
  from TypeScript schema checks and actual provider outcomes.
- CV prompts receive separately extracted page text only. Matching prompts project
  approved facts and source job text. Proposal prompts project approved facts,
  source text, channels and question IDs/prompts; never include expected labels,
  field answer policies, expected CV facts or private owner/candidate metadata.
- Matching and proposal prompts require an explicit private operator receipt for
  the current profile version/facts. Public approvals remain pending. A receipt is
  operator evidence, not authentication, a signature or real-candidate approval.
  No code generates receipts or activates a public profile automatically.
- Require exact result case IDs and linked actual attempts, fixed corpus/prompt/
  evaluator versions, model/HTTPS endpoint provenance and private usage references.
  Local scan/parse outcomes have no fabricated model attempts or zero billing.
  Record first-pass validity separately; permit at most one repair per case.
- Count input, output plus separately billed thinking, attempts, Berlin daily use
  and cost against the report caps. The live runner must also reserve cumulative
  experiment use in ADR 0008's ledger; reading/scoring a report makes no live call.
- Score CV recall per textual PDF with exact values and designated page/quotes;
  duplicates cannot inflate recall and unsupported facts fail. Require all five
  blockers/reviews and at least nine positives. Matching approval remains separate
  from reported classification threshold counts.
- Proposals contain email subject/body or exact questionnaire field answers. Missing
  facts stay `needs_input`; declarations/consent require `applicant_action_required`.
  Validate channels, field policies and fact scope. Human semantic review binds
  the complete canonical output hash; valid IDs alone cannot prove prose truth.
- Missing approvals, semantic review or selected-run provenance yields incomplete
  evidence. Default fixture checks say `approval_pending_model_not_run`; no empty,
  simulated, schema-only or unexecuted report establishes a model pass.

## Alternatives

Putting expected labels in prompts leaks the oracle. Pooled recall hides weak CVs.
Treating references or guessed answers as truth permits unsupported applications.
Production profile/version services and UI are outside this experiment slice.

## Consequences

The CLI can validate fixtures and score supplied private observations without
provider credentials. Evidence authenticity and honest operator review remain
external obligations; live access, model execution and UI are still separate work.
