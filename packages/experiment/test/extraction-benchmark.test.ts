import assert from "node:assert/strict";
import test from "node:test";
import type { z } from "zod";
import {
  capturedHtmlHash,
  type extractionCaptureSchema,
  extractionLabelsSchema,
  extractionManifestHash,
  extractionManifestSchema,
  freezeExtractionLabels,
  scoreExtractionBenchmark,
} from "../src/extraction-benchmark.js";

const capturedAt = "2026-10-19T08:00:00.000Z";
const frozenAt = "2026-10-19T09:00:00.000Z";
const options = {
  methodVersion: "a".repeat(40),
  evaluatedAt: "2026-10-19T10:00:00.000Z",
};
const absentFacts = () =>
  (
    [
      "location",
      "workFormat",
      "applicantScope",
      "workLanguage",
      "applicationRoute",
    ] as const
  ).map((field) => ({ field, status: "absent", acceptedValues: [] }));
function detailHtml(id: string): string {
  const posting = {
    "@type": "JobPosting",
    title: `Fixture role ${id}`,
    hiringOrganization: { name: `Synthetic employer ${id}` },
    employmentType: "PART_TIME",
    jobLocation: {
      address: { addressLocality: "Berlin", addressCountry: "DE" },
    },
    applicantLocationRequirements: { name: "Germany" },
    description: "English is accepted.",
  };
  return `<script type="application/ld+json">${JSON.stringify(posting)}</script><h1>${posting.title}</h1><p>${posting.hiringOrganization.name}</p><p>Location: Berlin, DE</p><p>Format: PART_TIME</p><p>Applicant scope: Germany</p><p>English is accepted.</p><a href="/Apply/${id}">Apply now</a>`;
}
function fixture(count = 30) {
  const manifest = extractionManifestSchema.parse({
    version: 1,
    rows: Array.from({ length: count }, (_, index) => ({
      id: `case_${index}`,
      url: `https://source.example.invalid/case_${index}`,
      stratum:
        index < 12
          ? "static_detail"
          : index < 18
            ? "js_candidate"
            : index < 24
              ? "career"
              : "negative",
      smallLocal: index < 10,
      basis: "Synthetic labeled stratum fixture",
      policyRef: "synthetic-no-network",
    })),
  });
  const bodies: Record<string, string> = {};
  const captures: z.infer<typeof extractionCaptureSchema>[] = [];
  const cases = manifest.rows.map((row) => {
    const detail = row.stratum === "static_detail";
    const html = detail
      ? detailHtml(row.id)
      : row.stratum === "negative"
        ? "<h1>Job is no longer available</h1>"
        : "<h1>Careers</h1><p>General information.</p>";
    bodies[row.id] = html;
    captures.push({
      caseId: row.id,
      requestedUrl: row.url,
      finalUrl: row.url,
      capturedAt,
      outcome: "html",
      bodySha256: capturedHtmlHash(html),
    });
    return {
      caseId: row.id,
      kind: detail
        ? "job_detail"
        : row.stratum === "negative"
          ? "negative"
          : "career_lead",
      ...(detail
        ? {
            title: {
              acceptedValues: [`Fixture role ${row.id}`],
              quote: `Fixture role ${row.id}`,
            },
            employer: {
              acceptedValues: [`Synthetic employer ${row.id}`],
              quote: `Synthetic employer ${row.id}`,
            },
          }
        : {}),
      facts: detail
        ? [
            {
              field: "location",
              status: "present",
              acceptedValues: ["Berlin, DE"],
              quote: "Berlin, DE",
            },
            {
              field: "workFormat",
              status: "present",
              acceptedValues: ["PART_TIME"],
              quote: "PART_TIME",
            },
            {
              field: "applicantScope",
              status: "present",
              acceptedValues: ["Germany"],
              quote: "Germany",
            },
            {
              field: "workLanguage",
              status: "present",
              acceptedValues: ["English"],
              quote: "English is accepted.",
            },
            {
              field: "applicationRoute",
              status: "present",
              acceptedValues: [
                `https://source.example.invalid/Apply/${row.id}`,
              ],
              quote: "Apply now",
            },
          ]
        : absentFacts(),
    };
  });
  const labels = extractionLabelsSchema.parse({
    version: 1,
    manifestHash: extractionManifestHash(manifest),
    frozenAt,
    captureHashes: Object.fromEntries(
      captures.map((capture) => [capture.caseId, capture.bodySha256]),
    ),
    cases,
  });
  return { manifest, captures, bodies, labels };
}
function first<T>(values: T[]): T {
  const value = values[0];
  if (value === undefined) throw new Error("Missing synthetic fixture.");
  return value;
}
function score(data: ReturnType<typeof fixture>) {
  const receipt = freezeExtractionLabels(
    data.manifest,
    data.captures,
    data.bodies,
    data.labels,
  );
  return scoreExtractionBenchmark(
    data.manifest,
    data.captures,
    data.bodies,
    data.labels,
    receipt,
    options,
  );
}
function replaceHtml(
  data: ReturnType<typeof fixture>,
  caseId: string,
  html: string,
): void {
  data.bodies[caseId] = html;
  const capture = data.captures.find((capture) => capture.caseId === caseId);
  assert.ok(capture);
  capture.bodySha256 = capturedHtmlHash(html);
  data.labels.captureHashes[caseId] = capture.bodySha256;
}

test("full synthetic sample scores actual baseline claims without treating unknown language or parser routes as verified", () => {
  const result = score(fixture());
  assert.equal(result.status, "reported_criteria_met");
  assert.equal(result.overall.correctDetails, 12);
  assert.equal(result.overall.populated, 48);
  assert.equal(result.overall.truePositive, 48);
  assert.equal(result.overall.present, 60);
  assert.equal(result.overall.recovered, 48);
  assert.equal(result.overall.precision, 1);
  assert.equal(result.overall.recall, 0.8);
  assert.equal(result.parserVerified, false);
  assert.equal(
    result.cases.every((row) => row.parserVerified === false),
    true,
  );
  assert.equal(result.byStratum.static_detail?.correctDetails, 12);
  assert.equal(result.byStratum.career?.precision, null);
});

test("partial pilots and insufficient labeled/fetchable samples remain incomplete without waiving full requirements", () => {
  assert.equal(score(fixture(3)).status, "incomplete");
  const labels = fixture();
  for (const row of labels.labels.cases)
    for (const fact of row.facts)
      if (fact.field === "workLanguage") {
        fact.status = "absent";
        fact.acceptedValues = [];
        delete fact.quote;
      }
  assert.equal(score(labels).status, "incomplete");
  const failedFetch = fixture(1);
  const capture = first(failedFetch.captures);
  capture.outcome = "blocked";
  delete capture.bodySha256;
  delete capture.finalUrl;
  delete failedFetch.bodies[capture.caseId];
  failedFetch.labels.captureHashes[capture.caseId] = null;
  failedFetch.labels.cases = extractionLabelsSchema.parse({
    ...failedFetch.labels,
    cases: [
      {
        caseId: capture.caseId,
        kind: "unavailable",
        facts: absentFacts().map((fact) => ({ ...fact, status: "ambiguous" })),
      },
    ],
  }).cases;
  assert.equal(score(failedFetch).status, "incomplete");
  for (const fact of first(failedFetch.labels.cases).facts)
    fact.status = "absent";
  assert.throws(() => score(failedFetch), /Unavailable captures/);
});

test("empty baseline extraction cannot pass a fully grounded sample", () => {
  const data = fixture();
  for (const row of data.manifest.rows.filter(
    (row) => row.stratum === "static_detail",
  ))
    replaceHtml(
      data,
      row.id,
      detailHtml(row.id).replace(/<script[^>]*>[\s\S]*?<\/script>/g, ""),
    );
  const result = score(data);
  assert.equal(result.status, "failed");
  assert.equal(result.overall.populated, 0);
  assert.equal(result.overall.precision, null);
  assert.equal(result.overall.recall, 0);
  assert.equal(result.overall.correctDetails, 0);
});

test("capture hashes, exact case identities and independent freeze chronology fail closed", () => {
  const data = fixture(2);
  const receipt = freezeExtractionLabels(
    data.manifest,
    data.captures,
    data.bodies,
    data.labels,
  );
  assert.throws(() =>
    scoreExtractionBenchmark(
      data.manifest,
      data.captures,
      data.bodies,
      data.labels,
      { ...receipt, labelsHash: "0".repeat(64) },
      options,
    ),
  );
  assert.throws(() =>
    scoreExtractionBenchmark(
      data.manifest,
      data.captures,
      data.bodies,
      data.labels,
      receipt,
      { ...options, evaluatedAt: frozenAt },
    ),
  );
  assert.throws(() =>
    scoreExtractionBenchmark(
      data.manifest,
      data.captures,
      data.bodies,
      data.labels,
      receipt,
      { ...options, methodVersion: "unversioned" },
    ),
  );
  assert.throws(() =>
    freezeExtractionLabels(
      data.manifest,
      data.captures.slice(1),
      data.bodies,
      data.labels,
    ),
  );
  assert.throws(() =>
    freezeExtractionLabels(
      data.manifest,
      [...data.captures, first(data.captures)],
      data.bodies,
      data.labels,
    ),
  );
  assert.throws(() =>
    freezeExtractionLabels(
      data.manifest,
      data.captures,
      { ...data.bodies, extra: "HTML" },
      data.labels,
    ),
  );
  assert.throws(() =>
    freezeExtractionLabels(data.manifest, data.captures, data.bodies, {
      ...data.labels,
      manifestHash: "0".repeat(64),
    }),
  );
  assert.throws(() =>
    freezeExtractionLabels(data.manifest, data.captures, data.bodies, {
      ...data.labels,
      frozenAt: "2026-10-19T07:00:00.000Z",
    }),
  );
  data.bodies[first(data.captures).caseId] = "Mutated captured content";
  assert.throws(() =>
    scoreExtractionBenchmark(
      data.manifest,
      data.captures,
      data.bodies,
      data.labels,
      receipt,
      options,
    ),
  );
});

test("invented quotes, mismatched accepted values, arbitrary JSON and hidden content cannot supply oracle evidence", () => {
  for (const variant of ["quote", "value", "json", "hidden"] as const) {
    const data = fixture(1);
    const row = first(data.labels.cases);
    const language = row.facts.find((fact) => fact.field === "workLanguage");
    assert.ok(language);
    if (variant === "quote") language.quote = "Invented absent quotation";
    else {
      language.acceptedValues = ["French"];
      if (variant === "value")
        replaceHtml(
          data,
          row.caseId,
          `${data.bodies[row.caseId]}<footer>French</footer>`,
        );
      if (variant === "json") {
        language.quote = "French";
        replaceHtml(
          data,
          row.caseId,
          `${data.bodies[row.caseId]}<script type="application/ld+json">{"unrelated":"French"}</script>`,
        );
      }
      if (variant === "hidden") {
        language.quote = "French";
        replaceHtml(
          data,
          row.caseId,
          `${data.bodies[row.caseId]}<p hidden>French</p>`,
        );
      }
    }
    assert.throws(() =>
      freezeExtractionLabels(
        data.manifest,
        data.captures,
        data.bodies,
        data.labels,
      ),
    );
  }
});

test("absent/ambiguous populated values are false positives while unknown language remains only missing recall", () => {
  for (const status of ["absent", "ambiguous"] as const) {
    const data = fixture();
    for (const row of data.labels.cases) {
      const field = row.facts.find((fact) => fact.field === "workFormat");
      assert.ok(field);
      if (field.status === "present" && row.caseId !== "case_0") {
        field.status = status;
        field.acceptedValues = [];
        delete field.quote;
      }
    }
    const result = score(data);
    assert.equal(result.status, "failed");
    assert.equal(result.overall.populated, 48);
    assert.equal(result.overall.truePositive, 37);
  }
});

test("duplicate routes cannot inflate counts and accepted routes must bind the exact href and anchor quote", () => {
  const data = fixture();
  const row = first(data.labels.cases);
  replaceHtml(
    data,
    row.caseId,
    `${data.bodies[row.caseId]}<a href="/Apply/${row.caseId}">Apply now</a>`,
  );
  assert.equal(score(data).overall.populated, 48);
  replaceHtml(
    data,
    row.caseId,
    detailHtml(row.caseId).replace('">Apply now', '#details">Apply now'),
  );
  const route = row.facts.find((fact) => fact.field === "applicationRoute");
  assert.ok(route);
  route.acceptedValues = [
    `https://source.example.invalid/Apply/${row.caseId}#details`,
  ];
  assert.equal(score(data).overall.truePositive, 48);
  route.acceptedValues = [
    `https://source.example.invalid/Apply/${row.caseId}#other`,
  ];
  assert.throws(() =>
    freezeExtractionLabels(
      data.manifest,
      data.captures,
      data.bodies,
      data.labels,
    ),
  );
  route.acceptedValues = [`https://source.example.invalid/apply/${row.caseId}`];
  assert.throws(() =>
    freezeExtractionLabels(
      data.manifest,
      data.captures,
      data.bodies,
      data.labels,
    ),
  );
  route.acceptedValues = ["https://source.example.invalid/Different"];
  replaceHtml(
    data,
    row.caseId,
    `${data.bodies[row.caseId]}<a href="/Different">Browse home</a>`,
  );
  assert.throws(() =>
    freezeExtractionLabels(
      data.manifest,
      data.captures,
      data.bodies,
      data.labels,
    ),
  );
});

test("manually negative pages cannot become confirmed vacancies even when JSON-LD looks complete", () => {
  const data = fixture();
  for (const row of data.manifest.rows.filter(
    (row) => row.stratum === "negative",
  ))
    replaceHtml(
      data,
      row.id,
      `<h1>Recruitment closed</h1>${detailHtml(row.id)}`,
    );
  const result = score(data);
  assert.equal(result.status, "failed");
  assert.equal(result.overall.falseConfirmed, 6);
});

test("manual ground truth can include visible form routes the baseline misses without biasing labels to parser support", () => {
  const data = fixture();
  for (const row of data.manifest.rows.filter(
    (row) => row.stratum === "static_detail",
  ))
    replaceHtml(
      data,
      row.id,
      detailHtml(row.id).replace(/(<a[^>]*>Apply now<\/a>)/, "<form>$1</form>"),
    );
  const result = score(data);
  assert.equal(result.status, "failed");
  assert.equal(result.overall.recall, 0.6);
  assert.equal(result.overall.populated, 36);
});

test("redirected aliases of one final HTML page cannot inflate sample or fact counts", () => {
  const data = fixture(2);
  const capture = data.captures[1];
  if (!capture) throw new Error("Missing second synthetic capture.");
  assert.notEqual(capture.requestedUrl, first(data.captures).requestedUrl);
  capture.finalUrl = `${first(data.captures).finalUrl}#alias`;
  assert.throws(
    () =>
      freezeExtractionLabels(
        data.manifest,
        data.captures,
        data.bodies,
        data.labels,
      ),
    /Duplicate final HTML URL/,
  );
});
