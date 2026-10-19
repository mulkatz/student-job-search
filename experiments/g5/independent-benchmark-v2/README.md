# Independent synthetic matching benchmark

This exact fixture passes the delegated synthetic acceptance method in
[ADR 0022](../../../docs/adr/0022-independent-synthetic-benchmark-acceptance.md).
It contains fictional postings and approved synthetic profiles, with complete
source text, evidence and two separately frozen label sets. No external calls or
real candidate data are required.

The first production evaluation and independent reproduction correctly classify
all 50 scenarios: 21 eligible, 13 blocked and 16 needing review. Processing success
and eligible-shortlist precision are both 100%. H01 and H50 intentionally represent
one canonical job: there are 49 distinct jobs and 20 distinct eligible jobs.

From the repository root, reproduce through the normal offline test suite:

```sh
mise exec node@24.22.0 -- npm run build
mise exec node@24.22.0 -- npm run test --workspace=@job-search/server
```

The dedicated regression invokes the production evaluator, validates source/profile
identities and hashes, and verifies the label/receipt chain. The fixed evaluation
instant is fixture metadata; running later does not renew real source evidence.

[The projection manifest](projection-manifest.json) binds the public artifact bytes
to the original reviewed bytes and identifies omitted audit-only records. Two
public JSON files were reformatted without changing parsed values. Original freeze,
adjudication and acceptance chronology remains preserved.

This is independent agent review, not human labeling or real-market validation.
Prior implementation familiarity is disclosed; unusually explicit synthetic source
conditions do not establish arbitrary-language extraction accuracy. The fixture is
now exposed and cannot serve as a fresh holdout for subsequent tuning. Other G3,
application-package and release criteria require their own evidence.
