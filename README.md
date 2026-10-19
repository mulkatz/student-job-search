# Job Search

Find student-friendly jobs in Berlin and remote jobs that can be performed from
Germany. Review the evidence, prepare an application, and send it yourself.

**Status:** concept and repository foundation. No application, infrastructure,
source integration, or Gmail connection has been implemented or tested.

The first pilot serves one person. Candidate data has explicit ownership from the
start so other people can use the tool later without rebuilding the core model.
Public onboarding and a multi-user service are outside the pilot.

## Start here

- [Current product concept and acceptance criteria](CONCEPT.md)
- [Delivery plan and next goal](docs/PLAN.md)
- [Open decisions and validation needs](docs/OPEN_QUESTIONS.md)
- [Agent working rules](AGENTS.md); `CLAUDE.md` links to the same file
- [Development workflow decision](docs/adr/0001-development-workflow.md)
- [Pilot scope and ownership decision](docs/adr/0002-pilot-and-ownership.md)
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
- Keep discovery usable if Gmail integration is unavailable.

## Delivery sequence

1. Resolve the few blocking product and operating choices; define the feasibility
   experiment, cost ceiling, and evidence to collect.
2. Establish the TypeScript workspace, one verification command, and CI.
3. Validate source access, useful Berlin/Germany coverage, and Gmail OAuth/draft
   behavior with authorized test access and synthetic applicant data.
4. Deliver a discovery slice, then approved-profile matching, then applications.
5. Harden privacy, ownership, recovery, observability, and handover.

Each goal has a measurable outcome, scoped tasks, and recorded verification.
See [the plan](docs/PLAN.md) for exit criteria and dependencies.

## Development status

The proposed stack is TypeScript, React, Google Cloud, and Firebase. Runtime and
package versions, framework details, LLM provider, deployment tooling, and commands
will be selected during setup and recorded as needed. There is no installation,
test, build, or deployment command yet. No cloud resources have been provisioned.

Repository content and commits are written in English; discussion can be German.
Use atomic semantic commits, such as `docs: define source feasibility criteria`.
Keep CVs, candidate details, credentials, provider responses, and local experiments
out of Git. Use `.local/` for private scratch work; ignore rules are not access
controls or a substitute for checking staged content.

This is a local Git repository. No remote, publication, or license has been set up.
Choose the license and attribution before public distribution.
