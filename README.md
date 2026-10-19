# Student Job Search

Find student-friendly jobs in Berlin and remote jobs that can be performed from
Germany. Review the evidence, prepare an application, and send it yourself.

**Status:** G2 is complete. G3 investigation is complete with negative quality and
coverage findings; see [current results](docs/G3_SETUP.md). G4 implements a local discovery slice,
with conservative identities, bounded runs and a Firebase-emulator table; see
[local setup and limitations](docs/G4_LOCAL.md). G5 adds local synthetic profiles and
matching; its human benchmark remains pending. No application is deployed.
Gmail is exclusively a Firebase Auth login identity; mailbox integration is outside
the current V1/G3 contract ([ADR 0010](docs/adr/0010-manual-application-packages.md)). No cloud resources have been provisioned.

The first pilot serves one person. Candidate data has explicit ownership from the
start so other people can use the tool later without rebuilding the core model.
Public onboarding and a multi-user service belong to V2. V1 includes CV processing,
reviewable email/questionnaire packages with manual copying as well as job discovery.

## Start here

- [Current product concept and acceptance criteria](CONCEPT.md)
- [Delivery plan and next goal](docs/PLAN.md)
- [Conception closure and implementation handoff](docs/IMPLEMENTATION_START.md)
- [Current fresh-session continuation](docs/START_PROMPT.md)
- [Completed G2 execution contract](docs/archive/G2_START_PROMPT.md)
- [Bounded feasibility experiment for G3](docs/FEASIBILITY.md)
- [G3 setup, private access requirements and observation status](docs/G3_SETUP.md)
- [Open decisions and validation needs](docs/OPEN_QUESTIONS.md)
- [Agent working rules](AGENTS.md); `CLAUDE.md` links to the same file
- [Development workflow decision](docs/adr/0001-development-workflow.md)
- [Pilot scope and ownership decision](docs/adr/0002-pilot-and-ownership.md)
- [V1/V2 and broader discovery decision](docs/adr/0003-release-scope-and-web-discovery.md)
- [Manual application packages and login-only Gmail identity](docs/adr/0010-manual-application-packages.md)
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
- Prepare fact-grounded email subject/body or questionnaire answers. “View application
  draft” opens the shared review/copy dialog, with a copy action for each answer.
  Missing facts remain `needs_input`; consents, signatures and declarations remain
  `applicant_action_required`. Only the applicant copies, sends or submits.
- Discover jobs through structured sources, web search, and targeted employer-page
  retrieval, including smaller businesses outside the major job platforms.
- Use a Gmail address only for Firebase Auth login; no Gmail API, mailbox OAuth,
  autofill, browser-form writing or sending/submission integration is included.

V1 has one pilot profile, a login, a table sorted by match score, original application
links, and operator-configured daily searches. V2 adds use by multiple people and
user-managed search orders, preferences, and schedules. The table is sufficient for
V1; it does not need a complex dashboard to include a useful application assistant.

## Delivery sequence

1. Completed: define the initial providers, public-fetch policy, feasibility
   experiment, planning cost limits, and required evidence.
2. Completed: establish the offline TypeScript workspace, one locally verified gate,
   and configured CI with Biome, strict types, tests, build and secret scanning.
3. Investigation complete with negative source/extraction/model quality decisions.
   The user removed the long-term duration test; full synthetic matching now has
   measured failures. Five editorial synthetic packages have delegated semantic
   review and exact-version operator approval; original model failures remain.
4. Build discovery, CV/profile matching, and applications as internal slices of V1.
5. Release V1 after package review/copy, privacy, recovery and operating acceptance pass; scope
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
npx playwright install chromium
npm run verify
```

Install Java 21 or newer for Firebase emulators. Dependency/browser installation
and the first emulator start download public tooling artifacts. After those
artifacts are cached, checks use synthetic local data and loopback services, with
no provider credentials, cloud account, `.env` file, or paid/live API. The same gate is configured in GitHub Actions for pushes and pull
requests, including fork contributions; a local pass does not establish a remote
CI run. No deployment command is provided.

The gate checks runtime versions, formatting and lint, builds workspace dependencies
before strict source/test types, then checks synthetic tests, secrets, Firebase emulator ownership and Chromium browser tests in
sequence; a failure stops it. Individual commands:

| Command | Purpose |
| --- | --- |
| `npm run check` | Biome formatting, lint and import checks without changes. |
| `npm run format` / `npm run format:check` | Apply/check Biome formatting. |
| `npm run lint` | Biome lint checks. |
| `npm run typecheck` | Strict TypeScript validation of source and tests. |
| `npm test` | Run synthetic workspace and secret-scanner regression tests. |
| `npm run build` | Rebuild all workspace packages and the local web application. |
| `npm run test:emulators` | Run actual local Auth/API/Firestore/Storage ownership tests. |
| `npm run test:browser` | Run the Chromium authenticated table journey with local emulators. |
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
database/storage authorization. G4 separately tests these controls with Firebase
emulators, without claiming production authentication readiness.

Secret scanning covers tracked and nonignored untracked regular working-tree
files, including dotfiles and forced-tracked ignored files; it skips symlinks.
It is not proof of private or secret-free runtime artifacts. Scan Git history
separately before publication. Keep private experiments in ignored `.local/`; inspect staged changes before each commit. No real CVs,
provider captures or credentials belong in fixtures. G4 adds browser and emulator checks; G2's historical evidence does not claim those checks existed earlier.

Local PDF processing requires maintained Poppler `pdfinfo` and `pdftotext` on PATH.
Install with `brew install poppler` on macOS or `sudo apt-get install poppler-utils`
on Debian/Ubuntu. The runtime gate checks both commands; CI installs the distribution
package. Tests use synthetic PDFs and local bounded subprocesses, without a PDF
provider or real CV input. Node/npm and Java requirements above remain unchanged.

## Local synthetic profiles and matching

Start the local emulators/API/web preview using [the local guide](docs/G4_LOCAL.md).
Sign in to the demo, attest that the PDF contains synthetic facts and upload a text
PDF marked `SYNTHETIC` (maximum 2 MiB/10 pages). Poppler extracts actual page text;
recognized labeled facts retain page/quote evidence. Other facts require explicit
correction/attestation. Scans need review; there is no OCR or external PDF service.
Review the draft and approve an immutable version before matching discoveries.

Matching keeps confirmed blockers separate from missing/conflicting evidence,
including language, location, work format, hours and authorization declarations.
Fit and evidence confidence are separate; neither is a hiring probability or legal
determination. Private results bind exact job/profile/evaluator versions and become
stale when those change. Existing sources missing decisive fields stay under review.
The default evaluator is deterministic; no paid G5 model dispatch is configured.

The profile panel exports the owner's retained PDF/history/evaluations and requests
deletion. Raw PDFs/drafts expire after seven days, approved versions after 90 days;
evaluations expire with the source/profile or seven days, whichever comes first.
Run the guide's bounded cleanup command to remove expired storage. Deletion blocks
reads immediately; uncertain in-flight uploads retain minimal cleanup markers and
cannot be reported physically complete merely because time elapsed.
The pilot bounds storage to three assets/drafts, five approved versions and 100
evaluations; capacity conflicts preserve retained history. Fifty synthetic oracle
cases and real local browser tests exercise the implementation. Human benchmark
acceptance, live-model quality, production operation and real CV use remain separate.

## Development status

The proposed stack is TypeScript, React, Google Cloud, and Firebase. The initial
provider route is GCP-managed Gemini, Brave and HTTP/Cheerio. The offline foundation
uses private core, experiment, discovery and server workspaces plus a React/Vite
local web application. Deployment tooling remains outside the current slice. The G3 model/region route
has actual synthetic EU observations; its full sample failed quality acceptance.
G3 investigation is complete with explicit negative findings; G5 local profile and
matching implementation is separate from pending human benchmark acceptance.
Local G4 discovery is verified; see [delivery evidence](docs/PLAN.md#g4-discovery-slice)
and [local usage/source proof](docs/G4_LOCAL.md). Provider rights and recurring useful
coverage remain distinct from this implementation milestone.
No cloud resources have been provisioned.

Repository content and commits are written in English; discussion can be German.
Use atomic semantic commits, such as `docs: define source feasibility criteria`.
Keep CVs, candidate details, credentials, provider responses, and local experiments
out of Git. Use `.local/` for private scratch work; ignore rules are not access
controls or a substitute for checking staged content.

GitHub repository: [mulkatz/student-job-search](https://github.com/mulkatz/student-job-search).
`main` tracks `origin/main`. A license has not yet been selected; licensing and
attribution remain an open decision before broader distribution.
