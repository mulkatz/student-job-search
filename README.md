# Student Job Search

Find student-friendly jobs in Berlin and remote jobs that can be performed from
Germany. Review the evidence, prepare an application, and send it yourself.

**Status:** G2's offline TypeScript foundation is complete and locally verified.
G3's bounded feasibility experiment is in setup; see [current readiness](docs/G3_SETUP.md).
No deployed application, verified vacancy-source integration or Gmail connection
is available. No cloud resources have been provisioned.

The first pilot serves one person. Candidate data has explicit ownership from the
start so other people can use the tool later without rebuilding the core model.
Public onboarding and a multi-user service belong to V2. V1 includes CV processing,
application text, and unsent Gmail drafts as well as job discovery.

## Start here

- [Current product concept and acceptance criteria](CONCEPT.md)
- [Delivery plan and next goal](docs/PLAN.md)
- [Conception closure and implementation handoff](docs/IMPLEMENTATION_START.md)
- [Completed G2 execution contract](docs/START_PROMPT.md)
- [Bounded feasibility experiment for G3](docs/FEASIBILITY.md)
- [G3 setup, private access requirements and observation status](docs/G3_SETUP.md)
- [Open decisions and validation needs](docs/OPEN_QUESTIONS.md)
- [Agent working rules](AGENTS.md); `CLAUDE.md` links to the same file
- [Development workflow decision](docs/adr/0001-development-workflow.md)
- [Pilot scope and ownership decision](docs/adr/0002-pilot-and-ownership.md)
- [V1/V2 and broader discovery decision](docs/adr/0003-release-scope-and-web-discovery.md)
- [Web search and direct-page discovery](docs/SOURCE_DISCOVERY.md)
- [Provider options and pilot cost model](docs/PROVIDERS_AND_COSTS.md)
- [Page-extraction market research](docs/EXTRACTION_OPTIONS.md)
- [Original technical proposal](berlin_job_research_pipeline_mvp_spec.md)

`CONCEPT.md` is the current product baseline. The original proposal is preserved
unchanged as design input; its “build-ready” label does not establish feasibility.
Conflicts and unresolved design details are tracked in the documents above.

## Product boundaries

- Discover Minijobs, part-time, working-student, and short-term roles.
- The pilot profile uses English as its working language; other profiles can
  specify different languages, availability, and preferences later.
- Distinguish confirmed suitability, uncertainty requiring review, and blockers.
- Prepare fact-grounded application packages and unsent Gmail drafts when the
  recruitment address is verified. The applicant sends or submits applications.
- Discover jobs through structured sources, web search, and targeted employer-page
  retrieval, including smaller businesses outside the major job platforms.
- Keep discovery usable during Gmail outages; Gmail remains a V1 release requirement.

V1 has one pilot profile, a login, a table sorted by match score, original application
links, and operator-configured daily searches. V2 adds use by multiple people and
user-managed search orders, preferences, and schedules. The table is sufficient for
V1; it does not need a complex dashboard to include a useful application assistant.

## Delivery sequence

1. Completed: define the initial providers, public-fetch policy, feasibility
   experiment, planning cost limits, and required evidence.
2. Completed: establish the offline TypeScript workspace, one locally verified gate,
   and configured CI with Biome, strict types, tests, build and secret scanning.
3. In progress: prepare and validate source/API access, web search/page extraction, Berlin/Germany
   coverage, and Gmail OAuth/draft behavior with authorized test access.
4. Build discovery, CV/profile matching, and applications as internal slices of V1.
5. Release V1 after Gmail, privacy, recovery, and operating acceptance pass; scope
   multi-user use and user-managed search orders as V2.

Each goal has a measurable outcome, scoped tasks, and recorded verification.
See [the plan](docs/PLAN.md) for exit criteria and dependencies.

## Local development

Use Node.js **24.22.0** (pinned in `.nvmrc`) and npm **11.11.0**. With nvm already
installed, select the runtime and package manager:

```sh
nvm install
nvm use
npm install --global npm@11.11.0
```

From the repository root, install the locked dependencies and run the complete gate:

```sh
npm ci
npm run verify
```

Dependency installation needs access to the public npm registry. Verification uses
synthetic local data and needs no provider credentials, cloud account, `.env` file,
or paid/live API. The same gate is configured in GitHub Actions for pushes and pull
requests, including fork contributions; a local pass does not establish a remote
CI run. No deployment command is provided.

The gate checks runtime versions, formatting, lint, strict types, synthetic tests,
build output, and secrets in sequence; a failure stops it. Individual commands:

| Command | Purpose |
| --- | --- |
| `npm run check` | Biome formatting, lint and import checks without changes. |
| `npm run format` / `npm run format:check` | Apply/check Biome formatting. |
| `npm run lint` | Biome lint checks. |
| `npm run typecheck` | Strict TypeScript validation of source and tests. |
| `npm test` | Run offline core, experiment and secret-scanner regression tests. |
| `npm run build` | Rebuild both workspace ESM packages and declarations. |
| `npm run secrets` | Secretlint with its recommended maintained rule preset. |

Biome **2.5.15** checks supported JavaScript, TypeScript and JSON files. Markdown
and YAML are reviewed manually; the gate does not claim automated formatting or
lint coverage for them. Strict `tsc` validation remains independent of Biome.
The tooling choice and its limits are recorded in
[ADR 0007](docs/adr/0007-biome-formatting-and-linting.md).

`packages/experiment` holds G3's bounded local runner and synthetic tests. Its
setup commands and limits are documented in [G3_SETUP.md](docs/G3_SETUP.md); it is
not production authentication or a completed live benchmark.

`packages/core` contains runtime-validated offline configuration, owner/candidate
scope checks, and synthetic candidate/job fixtures. Configuration is an explicit
object with `mode: "offline"` and `logLevel: "silent"`, `"error"`, or `"info"`;
there is no environment loader or live provider client. Unknown evidence remains
unknown. Identity checks establish a domain boundary, not authenticated access or
database/storage authorization. Those controls remain required in later slices.

Secret scanning covers tracked and nonignored untracked regular working-tree
files, including dotfiles and forced-tracked ignored files; it skips symlinks.
It is not proof of private or secret-free runtime artifacts. Scan Git history
separately before publication. Keep private experiments in ignored `.local/`; inspect staged changes before each commit. No real CVs,
provider captures or credentials belong in fixtures. Browser and emulator checks
will be added with the UI and persistence layers; neither exists in G2.

## Development status

The proposed stack is TypeScript, React, Google Cloud, and Firebase. The initial
provider route is GCP-managed Gemini, Brave and HTTP/Cheerio. The offline foundation
uses private `packages/core` and `packages/experiment` workspaces; application
framework and deployment tooling remain later choices. The G3 model/region route
is provisional until actual operator access and terms are checked.
No cloud resources have been provisioned.

Repository content and commits are written in English; discussion can be German.
Use atomic semantic commits, such as `docs: define source feasibility criteria`.
Keep CVs, candidate details, credentials, provider responses, and local experiments
out of Git. Use `.local/` for private scratch work; ignore rules are not access
controls or a substitute for checking staged content.

GitHub repository: [mulkatz/student-job-search](https://github.com/mulkatz/student-job-search).
`main` tracks `origin/main`. A license has not yet been selected; licensing and
attribution remain an open decision before broader distribution.
