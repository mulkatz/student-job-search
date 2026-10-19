# Student Job Search

Find student-friendly jobs in Berlin and remote jobs that can be performed from
Germany. Review the evidence, prepare an application, and send it yourself.

**Status:** concept and repository foundation. No application, infrastructure,
source integration, or Gmail connection has been implemented or tested.
G1's experiment brief is complete; the next goal is G2's offline development foundation.

The first pilot serves one person. Candidate data has explicit ownership from the
start so other people can use the tool later without rebuilding the core model.
Public onboarding and a multi-user service belong to V2. V1 includes CV processing,
application text, and unsent Gmail drafts as well as job discovery.

## Start here

- [Current product concept and acceptance criteria](CONCEPT.md)
- [Delivery plan and next goal](docs/PLAN.md)
- [Conception closure and implementation handoff](docs/IMPLEMENTATION_START.md)
- [Fresh-session start prompt for G2](docs/START_PROMPT.md)
- [Bounded feasibility experiment for G3](docs/FEASIBILITY.md)
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
2. Next: establish the TypeScript workspace, one verification command, and CI.
3. Validate source/API access, web search and page extraction, useful Berlin/Germany
   coverage, and Gmail OAuth/draft behavior with authorized test access.
4. Build discovery, CV/profile matching, and applications as internal slices of V1.
5. Release V1 after Gmail, privacy, recovery, and operating acceptance pass; scope
   multi-user use and user-managed search orders as V2.

Each goal has a measurable outcome, scoped tasks, and recorded verification.
See [the plan](docs/PLAN.md) for exit criteria and dependencies.

## Development status

The proposed stack is TypeScript, React, Google Cloud, and Firebase. The initial
provider route is GCP-managed Gemini, Brave and HTTP/Cheerio. Runtime and
package versions, framework details, exact model/region, deployment tooling, and commands
will be selected during setup and recorded as needed. There is no installation,
test, build, or deployment command yet. No cloud resources have been provisioned.

Repository content and commits are written in English; discussion can be German.
Use atomic semantic commits, such as `docs: define source feasibility criteria`.
Keep CVs, candidate details, credentials, provider responses, and local experiments
out of Git. Use `.local/` for private scratch work; ignore rules are not access
controls or a substitute for checking staged content.

GitHub repository: [mulkatz/student-job-search](https://github.com/mulkatz/student-job-search).
`main` tracks `origin/main`. A license has not yet been selected; licensing and
attribution remain an open decision before broader distribution.
