import {
  emptyState,
  ingestObservation,
  syntheticObservation,
} from "@job-search/discovery";
import {
  applicationSourceSchema,
  type DiscoveryJob,
} from "@job-search/discovery/schemas";
import { applicationSourcePayloadHash } from "./application-domain.js";

/** Reviewed synthetic contracts only; these examples establish no real source access. */
export function applicationFixtureJobs(now: number): DiscoveryJob[] {
  return Array.from({ length: 5 }, (_, index) => {
    const sourceId = "synthetic-application-packages";
    const sourceRecordId = `application-case-${index + 1}`;
    const url = `https://careers.synthetic.example/jobs/${sourceRecordId}`;
    const formUrl = `https://forms.synthetic.example/${sourceRecordId}`;
    const recipient = `applications-${index + 1}@synthetic.example`;
    const expiresAt = new Date(now + 3 * 86_400_000).toISOString();
    const evidence = (quote: string, selector: string) => ({
      url,
      quote,
      selector,
    });
    const fact = (value: string, selector: string) => ({
      value,
      evidence: evidence(value, selector),
    });
    const review = {
      method: "synthetic_operator_fixture",
      reviewedAt: new Date(now).toISOString(),
      expiresAt,
      payloadHash: "0".repeat(64),
    };
    const common = { sourceId, sourceRecordId, sourceUrl: url, review };
    const answered = [
      {
        internalId: "working_languages",
        prompt: "Which languages do you speak?",
        answerKind: "working_languages",
      },
      {
        internalId: "skills",
        prompt: "What are your skills?",
        answerKind: "skills",
      },
      {
        internalId: "weekly_availability",
        prompt: "How many hours are you available per week?",
        answerKind: "weekly_availability",
      },
    ][index - 2];
    const action = [
      {
        internalId: "consent",
        prompt: "Do you consent to processing this application?",
        answerKind: "consent",
      },
      {
        internalId: "signature",
        prompt: "Applicant signature",
        answerKind: "signature",
      },
      {
        internalId: "declaration",
        prompt: "I declare this application is complete and accurate.",
        answerKind: "declaration",
      },
    ][index - 2];
    const questions =
      answered && action
        ? [
            answered,
            {
              internalId: "start_date",
              prompt: "When can you start?",
              answerKind: "start_date",
            },
            action,
          ]
        : [];
    const source = applicationSourceSchema.parse(
      index < 2
        ? {
            ...common,
            kind: "email",
            recipient,
            evidence: evidence(
              `Send your application to ${recipient}`,
              "p.application-channel",
            ),
          }
        : {
            ...common,
            kind: "questionnaire",
            url: formUrl,
            evidence: {
              url: formUrl,
              quote: "Application questionnaire",
              selector: "h1",
            },
            fields: questions.map((question) => ({
              ...question,
              required: true,
              evidence: {
                url: formUrl,
                quote: question.prompt,
                selector: `label.${question.internalId}`,
              },
            })),
          },
    );
    source.review.payloadHash = applicationSourcePayloadHash(source);
    return ingestObservation(
      emptyState(),
      syntheticObservation({
        sourceId,
        sourceRecordId,
        originalUrl: url,
        finalUrl: url,
        observedAt: new Date(now).toISOString(),
        publishedAt: new Date(now - 3_600_000).toISOString(),
        expiresAt,
        retentionUntil: new Date(now + 7 * 86_400_000).toISOString(),
        title: fact(
          `Synthetic Analytics ${index < 2 ? "Email" : "Questionnaire"} ${index + 1}`,
          "JobPosting.title",
        ),
        employer: fact(
          `Synthetic Employer ${index + 1}`,
          "JobPosting.hiringOrganization.name",
        ),
        location: fact("Berlin, Germany", "JobPosting.jobLocation.address"),
        employmentType: fact("PART_TIME", "JobPosting.employmentType"),
        englishAccepted: {
          status: "confirmed",
          value: true,
          evidence: evidence("English is accepted", "p.language"),
        },
        languageRequirements: {
          status: "complete",
          alternatives: [
            [
              {
                language: "English",
                minimumLevel: null,
                evidence: evidence(
                  "English is the only required working language",
                  "p.language",
                ),
              },
            ],
          ],
          evidence: evidence(
            "English is the only required working language. No other languages are required.",
            "p.language",
          ),
        },
        additionalRequirements: {
          status: "none",
          evidence: evidence(
            "There are no further mandatory requirements beyond the modeled conditions.",
            "p.requirements",
          ),
        },
        workArrangements: {
          status: "complete",
          arrangements: [
            {
              mode: "on_site",
              city: "Berlin",
              countryCode: "DE",
              evidence: evidence(
                "This role is on site in Berlin, Germany.",
                "p.arrangements",
              ),
            },
          ],
          evidence: evidence(
            "The complete work arrangements are on site in Berlin, Germany only.",
            "p.arrangements",
          ),
        },
        weeklyHours: {
          status: "confirmed",
          minimum: 8,
          maximum: 12,
          evidence: evidence(
            "The role requires between 8 and 12 weekly hours",
            "p.hours",
          ),
        },
        workAuthorization: {
          status: "confirmed",
          requirement: "employee_work_in_germany",
          evidence: evidence(
            "Existing permission for employee work in Germany is required",
            "p.authorization",
          ),
        },
        applicationLinks: [
          {
            url:
              source.kind === "email"
                ? `mailto:${source.recipient}`
                : source.url,
            evidence: source.evidence,
          },
        ],
        applicationSource: source,
      }),
    ).job;
  });
}
