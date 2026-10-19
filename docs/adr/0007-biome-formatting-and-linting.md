# 0007: Biome formatting/linting and explicit secret-scanner inputs

- Status: accepted
- Date: 2026-10-19
- Supersedes: ADR 0006's formatter/linter choice, associated TypeScript support
  rationale, document-formatting policy and CLI scanner dispatch; other decisions stand.

## Context

The user requested Biome instead of Prettier and ESLint. G2 review also identified
that Secretlint's CLI walker silently excludes some configuration-like filenames,
including forced-tracked ignored files. Disabling Git/CLI ignores is insufficient.

## Decision

- Replace Prettier, ESLint and typescript-eslint with exact `@biomejs/biome` 2.5.15;
  remove their configurations. Use Biome's recommended preset and require explicit
  `any` to fail. Do not reproduce the previous rule set rule-for-rule.
- `npm run check` invokes `biome ci . --error-on-warnings` for formatting, lint and
  import organization. Keep individual format, format-check and lint commands.
  `npm run verify` invokes this combined stage before types, tests, build and secrets.
- Retain TypeScript 6.0.3 and strict `tsc` checks as the type authority. Biome's
  documented TypeScript syntax level is 5.9; do not infer full TS 6 syntax support
  or type checking from a Biome pass. Revisit syntax compatibility when needed.
- Check supported source/configuration formats; ignore generated files, local
  scratch data and the generated lockfile. Markdown/YAML are not checked by Biome.
  Review repository documentation and workflow YAML separately.
- Pin `@secretlint/node` 13.0.7 directly and pass Git's enumerated regular files to
  its maintained `executeOnFiles` API, bypassing the CLI walker. Keep recommended
  rules, explicitly masked findings, relative paths and nonzero failure exits.
- Add subprocess regression tests in temporary Git repositories proving clean
  fixtures pass and generated synthetic credentials fail for ordinary, ignored
  dotfile and scanner-special filenames. Check masking and remove temporary files.
  AWS access-key-ID scanning remains disabled by the preset default; use an
  enabled secret-access-key rule for these tests, not an ID-only probe.

## Alternatives

Retaining the earlier tools conflicts with the user's request. Adding another
Markdown/YAML formatter increases scope; manual review is sufficient for G2.
CLI flags alone cannot override unconditional scanner exclusions; custom detection
regexes would duplicate maintained rules and are unnecessary.

## Consequences and sources

The gate stays offline and smaller. It does not establish production authorization,
Git-history coverage, full secret detection or live integration compatibility.
Official references reviewed 2026-10-19: [Biome quickstart](https://biomejs.dev/installation/quick-start/),
[CLI](https://biomejs.dev/reference/cli/), [language support](https://biomejs.dev/introduction/language-support/),
[configuration](https://biomejs.dev/reference/configuration/),
[Secretlint Node API](https://github.com/secretlint/secretlint/tree/master/packages/@secretlint/node).
