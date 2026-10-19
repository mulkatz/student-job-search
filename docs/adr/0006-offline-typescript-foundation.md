# 0006: minimal offline TypeScript workspace and validation boundary

- Status: accepted
- Date: 2026-10-19

## Context

G2 needs reproducible private development and offline checks before any live
provider or persistence work. The concept proposes packages but needs no complete
application tree. Q5's persistence/version/state decisions remain downstream.

## Decision

- Use private npm workspaces with only `packages/core`; publish nothing. Pin
  Node 24.22.0 (LTS line), npm 11.11.0, direct dependencies and the npm lockfile.
- Use TypeScript 6.0.3 with strict checking, unchecked-index and exact-optional
  checks; compile Node ESM JavaScript and declarations. TypeScript 7 is outside
  typescript-eslint's currently supported range (`>=4.8.4 <6.1.0`).
- Use ESLint/typescript-eslint, Prettier, Node's built-in test runner, and
  Secretlint's maintained recommended rules. `npm run verify` checks runtime,
  format, lint, types, compiled synthetic tests, build and secrets sequentially.
- Use Zod strict boundary schemas for explicit offline configuration, distinct
  owner/candidate IDs and scopes, shared job facts, and unknown/confirmed evidence.
  Scope comparison rejects either mismatch or missing identifiers. The caller must
  later derive a trusted scope server-side; this is no authentication system.
- Keep synthetic fixtures in tests. Unknown evidence stays unknown; source URL
  syntax establishes neither rights nor safe network access. Shared facts reject
  private annotations. No persistence/version/state or eligibility engine is added.
- Scan tracked plus nonignored untracked regular working-tree files, including
  dotfiles and forced-tracked ignored files. Disable scanner ignore handling,
  retain masking and failing exits, and never write findings through `--output`.
  Skip symlinks rather than following external targets. This is neither a Git
  history scan nor evidence that runtime artifacts or private data are secret-free.
- Configure read-only push/pull-request CI with pinned official action SHAs and
  no persisted Git credentials. It installs locked dependencies and invokes the
  same offline gate without provider secrets or live API calls.
- Preserve historical document formatting; check the changed setup/handoff docs
  and all new runtime/configuration files. Add UI/browser checks with a real UI.

## Alternatives

A full framework/package tree adds unused surface. A second package manager or
custom test/secret tooling adds maintenance. TypeScript 7 would leave the lint
parser's supported range. Production authorization/storage schemas belong to the
slice that can implement and verify their real enforcement.

## Consequences and sources

The foundation supplies executable local contracts, not V1 or live integration
acceptance. Keep the lockfile updated deliberately and recheck compatibility.
Official sources reviewed 2026-10-19: [Node releases](https://nodejs.org/en/about/previous-releases),
[npm workspaces](https://docs.npmjs.com/cli/v11/using-npm/workspaces),
[TypeScript strict](https://www.typescriptlang.org/tsconfig/strict.html),
[typescript-eslint support](https://typescript-eslint.io/users/dependency-versions/),
[Zod](https://zod.dev/basics), and [Secretlint CLI](https://github.com/secretlint/secretlint/tree/master/packages/secretlint).
