import { createHash } from "node:crypto";
import { load } from "cheerio";
import { z } from "zod";
import { type ExtractedFact, extractPublicPage } from "./extract.js";
import { publicUrl } from "./public-fetch.js";

const id = z.string().regex(/^[a-zA-Z0-9_-]{1,80}$/);
const text = z.string().trim().min(1).max(2000);
const digest = z.string().regex(/^[a-f0-9]{64}$/);
const url = z.url().refine((value) => {
  try {
    publicUrl(value);
    return true;
  } catch {
    return false;
  }
}, "Require a public HTTP(S) URL; this is not source permission.");
const fields = [
  "location",
  "workFormat",
  "applicantScope",
  "workLanguage",
  "applicationRoute",
] as const;
const strata = ["static_detail", "js_candidate", "career", "negative"] as const;
const groundedValue = z.strictObject({
  acceptedValues: z.array(text).min(1).max(20),
  quote: text,
});
export const extractionManifestSchema = z.strictObject({
  version: z.literal(1),
  rows: z
    .array(
      z.strictObject({
        id,
        url,
        stratum: z.enum(strata),
        smallLocal: z.boolean(),
        basis: text,
        policyRef: text,
      }),
    )
    .min(1)
    .max(30),
});
export const extractionCaptureSchema = z.strictObject({
  caseId: id,
  requestedUrl: url,
  finalUrl: url.optional(),
  capturedAt: z.iso.datetime(),
  outcome: z.enum(["html", "blocked", "unavailable", "policy_unresolved"]),
  bodySha256: digest.optional(),
});
export const extractionLabelsSchema = z.strictObject({
  version: z.literal(1),
  manifestHash: digest,
  frozenAt: z.iso.datetime(),
  captureHashes: z.record(id, digest.nullable()),
  cases: z
    .array(
      z.strictObject({
        caseId: id,
        kind: z.enum(["job_detail", "career_lead", "negative", "unavailable"]),
        title: groundedValue.optional(),
        employer: groundedValue.optional(),
        facts: z
          .array(
            z.strictObject({
              field: z.enum(fields),
              status: z.enum(["present", "absent", "ambiguous"]),
              acceptedValues: z.array(text).max(20),
              quote: text.optional(),
            }),
          )
          .length(5),
      }),
    )
    .min(1)
    .max(30),
});
const receiptSchema = z.strictObject({
  version: z.literal(1),
  manifestHash: digest,
  labelsHash: digest,
  frozenAt: z.iso.datetime(),
});
const optionsSchema = z.strictObject({
  methodVersion: z.string().regex(/^[a-f0-9]{40}$/),
  evaluatedAt: z.iso.datetime(),
});
const norm = (value: string) =>
  value.normalize("NFKC").replace(/\s+/g, " ").trim().toLowerCase();
const hash = (value: string) =>
  createHash("sha256").update(value).digest("hex");
export const capturedHtmlHash = (html: string) => hash(html);
export const extractionManifestHash = (input: unknown) =>
  hash(JSON.stringify(extractionManifestSchema.parse(input)));
function exact(actual: string[], expected: string[], label: string): void {
  if (
    new Set(actual).size !== actual.length ||
    actual.length !== expected.length ||
    actual.some((value) => !expected.includes(value))
  )
    throw new Error(`Missing, duplicate or unexpected ${label}.`);
}
function plain(value: string): string {
  const $ = load(value);
  $(
    "script,style,noscript,template,iframe,[hidden],[aria-hidden='true']",
  ).remove();
  $("[style]")
    .filter((_, node) =>
      /display\s*:\s*none|visibility\s*:\s*hidden/i.test(
        $(node).attr("style") ?? "",
      ),
    )
    .remove();
  return norm($.root().text());
}
function object(value: unknown): Record<string, unknown> {
  const parsed = z.record(z.string(), z.unknown()).safeParse(value);
  return parsed.success ? parsed.data : {};
}
function literal(value: unknown): string {
  return typeof value === "string" ? plain(value) : "";
}
function sourceEvidence(html: string, fetchedUrl: string) {
  const $ = load(html);
  const values = new Map<string, string>();
  const quotes = [plain(html)];
  $("script[type='application/ld+json']")
    .slice(0, 20)
    .each((index, node) => {
      try {
        const parsed: unknown = JSON.parse($(node).text());
        const root = object(parsed);
        const candidates: unknown[] = Array.isArray(parsed)
          ? parsed
          : Array.isArray(root["@graph"])
            ? root["@graph"]
            : [parsed];
        for (const candidate of candidates.slice(0, 100)) {
          const job = object(candidate);
          if (
            job["@type"] !== "JobPosting" &&
            !(
              Array.isArray(job["@type"]) && job["@type"].includes("JobPosting")
            )
          )
            continue;
          const address = object(object(job.jobLocation).address);
          const format = Array.isArray(job.employmentType)
            ? job.employmentType.map(literal).filter(Boolean).join(", ")
            : literal(job.employmentType);
          const selected = {
            title: literal(job.title),
            "hiringOrganization.name": literal(
              object(job.hiringOrganization).name,
            ),
            employmentType: format,
            "jobLocation.address": [
              literal(address.addressLocality),
              literal(address.addressCountry),
            ]
              .filter(Boolean)
              .join(", "),
            "applicantLocationRequirements.name": literal(
              object(job.applicantLocationRequirements).name,
            ),
            inLanguage: literal(job.inLanguage),
            description: literal(job.description),
          };
          for (const [field, value] of Object.entries(selected))
            if (value) {
              quotes.push(value);
              const key = `script[type='application/ld+json']:eq(${index}) JobPosting.${field}`;
              // Ambiguous same-script objects cannot prove one selector-specific claim.
              if (values.has(key) && values.get(key) !== value)
                values.set(key, "");
              else if (!values.has(key)) values.set(key, value);
            }
        }
      } catch {
        /* Malformed/unrelated JSON does not supply source evidence. */
      }
    });
  const sourceRoutes = new Map<unknown, { value: string; quote: string }>();
  $("a[href]").each((_, node) => {
    const anchor = $(node);
    const ancestors = anchor.parents().addBack();
    if (
      ancestors.is(
        "script,style,noscript,template,iframe,[hidden],[aria-hidden='true']",
      ) ||
      ancestors
        .toArray()
        .some((ancestor) =>
          /display\s*:\s*none|visibility\s*:\s*hidden/i.test(
            $(ancestor).attr("style") ?? "",
          ),
        )
    )
      return;
    try {
      const target = new URL(anchor.attr("href") ?? "", fetchedUrl);
      if (target.protocol === "mailto:") {
        target.search = "";
        target.hash = "";
      } else publicUrl(target.href);
      sourceRoutes.set(node, {
        value: target.href,
        quote: plain(anchor.html() ?? ""),
      });
    } catch {
      /* Unsafe links are not evidence. */
    }
  });
  // Ground truth includes visible forms/late anchors, even where the baseline
  // misses them. Actual selector proofs use its filtered DOM indices.
  $(
    "script:not([type='application/ld+json']),style,noscript,iframe,form",
  ).remove();
  const routes = new Map<string, { value: string; quote: string }>();
  $("a[href]")
    .slice(0, 500)
    .each((index, node) => {
      const route = sourceRoutes.get(node);
      if (route) routes.set(`a[href]:eq(${index})`, route);
    });
  return { values, quotes, routes, labelRoutes: [...sourceRoutes.values()] };
}

function prepare(
  manifestInput: unknown,
  capturesInput: unknown,
  bodiesInput: unknown,
  labelsInput: unknown,
) {
  const manifest = extractionManifestSchema.parse(manifestInput);
  const captures = z
    .array(extractionCaptureSchema)
    .min(1)
    .max(30)
    .parse(capturesInput);
  const bodies = z.record(id, z.string().max(2_000_000)).parse(bodiesInput);
  const labels = extractionLabelsSchema.parse(labelsInput);
  const ids = manifest.rows.map((row) => row.id);
  exact(ids, [...new Set(ids)], "manifest IDs");
  exact(
    manifest.rows.map((row) => row.url),
    [...new Set(manifest.rows.map((row) => row.url))],
    "manifest URLs",
  );
  exact(
    captures.map((capture) => capture.caseId),
    ids,
    "captures",
  );
  exact(
    labels.cases.map((row) => row.caseId),
    ids,
    "labels",
  );
  exact(Object.keys(labels.captureHashes), ids, "label capture hashes");
  exact(
    Object.keys(bodies),
    captures
      .filter((capture) => capture.outcome === "html")
      .map((capture) => capture.caseId),
    "HTML bodies",
  );
  if (labels.manifestHash !== extractionManifestHash(manifest))
    throw new Error("Frozen manifest hash mismatch.");
  const contexts = new Map<string, ReturnType<typeof sourceEvidence>>();
  const observedUrls = new Set<string>();
  for (const capture of captures) {
    const row = manifest.rows.find((row) => row.id === capture.caseId);
    if (
      !row ||
      row.url !== capture.requestedUrl ||
      Date.parse(labels.frozenAt) < Date.parse(capture.capturedAt)
    )
      throw new Error("Capture identity or freeze chronology mismatch.");
    const html = bodies[capture.caseId];
    if (capture.outcome === "html") {
      if (
        html === undefined ||
        !capture.finalUrl ||
        !capture.bodySha256 ||
        Buffer.byteLength(html) > 2_000_000 ||
        capturedHtmlHash(html) !== capture.bodySha256 ||
        labels.captureHashes[capture.caseId] !== capture.bodySha256
      )
        throw new Error("Captured HTML hash/URL mismatch.");
      const finalUrl = publicUrl(capture.finalUrl).href;
      if (observedUrls.has(finalUrl))
        throw new Error(
          "Duplicate final HTML URL cannot inflate observations.",
        );
      observedUrls.add(finalUrl);
      contexts.set(capture.caseId, sourceEvidence(html, finalUrl));
    } else if (
      capture.bodySha256 !== undefined ||
      labels.captureHashes[capture.caseId] !== null
    )
      throw new Error("Non-HTML captures cannot claim a body hash.");
  }
  for (const row of labels.cases) {
    const context = contexts.get(row.caseId);
    exact(
      row.facts.map((fact) => fact.field),
      [...fields],
      "decisive field labels",
    );
    if (
      !context &&
      (row.kind !== "unavailable" ||
        row.title ||
        row.employer ||
        row.facts.some(
          (fact) => fact.status !== "ambiguous" || fact.quote !== undefined,
        ))
    )
      throw new Error("Unavailable captures cannot supply unsupported labels.");
    if (row.kind === "job_detail" && (!row.title || !row.employer))
      throw new Error("Detail labels require title and employer evidence.");
    for (const fact of [row.title, row.employer, ...row.facts]) {
      if (!fact) continue;
      const present = !("status" in fact) || fact.status === "present";
      if (
        present
          ? fact.acceptedValues.length === 0 || !fact.quote
          : fact.acceptedValues.length !== 0
      )
        throw new Error("Invalid present/absent/ambiguous label.");
      const accepted = fact.acceptedValues.map((value) =>
        "field" in fact && fact.field === "applicationRoute"
          ? value
          : norm(value),
      );
      if (new Set(accepted).size !== accepted.length)
        throw new Error("Duplicate accepted values cannot inflate scoring.");
      if (
        fact.quote &&
        !context?.quotes.some((source) =>
          source.includes(norm(fact.quote ?? "")),
        )
      )
        throw new Error(
          "Label quote is absent from visible text/known JobPosting evidence.",
        );
      for (const value of accepted) {
        const supported =
          "field" in fact && fact.field === "applicationRoute"
            ? [...(context?.labelRoutes ?? [])].some(
                (route) =>
                  route.value === value &&
                  route.quote === norm(fact.quote ?? ""),
              )
            : norm(fact.quote ?? "").includes(value);
        if (!supported)
          throw new Error(
            "Accepted label value is not bound to its quoted source.",
          );
      }
    }
  }
  return { manifest, captures, bodies, labels, contexts };
}
export function freezeExtractionLabels(
  manifest: unknown,
  captures: unknown,
  bodies: unknown,
  labels: unknown,
) {
  const prepared = prepare(manifest, captures, bodies, labels);
  return {
    version: 1 as const,
    manifestHash: prepared.labels.manifestHash,
    labelsHash: hash(JSON.stringify(prepared.labels)),
    frozenAt: prepared.labels.frozenAt,
  };
}
type Metrics = {
  populated: number;
  truePositive: number;
  present: number;
  recovered: number;
  correctDetails: number;
  falseConfirmed: number;
};
const emptyMetrics = (): Metrics => ({
  populated: 0,
  truePositive: 0,
  present: 0,
  recovered: 0,
  correctDetails: 0,
  falseConfirmed: 0,
});
const ratios = (metrics: Metrics) => ({
  ...metrics,
  falsePositive: metrics.populated - metrics.truePositive,
  missingPresent: metrics.present - metrics.recovered,
  precision: metrics.populated
    ? metrics.truePositive / metrics.populated
    : null,
  recall: metrics.present ? metrics.recovered / metrics.present : null,
});
export function scoreExtractionBenchmark(
  manifestInput: unknown,
  capturesInput: unknown,
  bodiesInput: unknown,
  labelsInput: unknown,
  receiptInput: unknown,
  optionsInput: unknown,
) {
  const prepared = prepare(
    manifestInput,
    capturesInput,
    bodiesInput,
    labelsInput,
  );
  const receipt = receiptSchema.parse(receiptInput);
  const options = optionsSchema.parse(optionsInput);
  if (
    JSON.stringify(receipt) !==
      JSON.stringify({
        version: 1,
        manifestHash: prepared.labels.manifestHash,
        labelsHash: hash(JSON.stringify(prepared.labels)),
        frozenAt: prepared.labels.frozenAt,
      }) ||
    Date.parse(options.evaluatedAt) <= Date.parse(receipt.frozenAt)
  )
    throw new Error(
      "Labels require a matching independently recorded freeze before extraction.",
    );
  const overall = emptyMetrics();
  const byStratum = new Map(strata.map((stratum) => [stratum, emptyMetrics()]));
  const families = new Set<string>();
  const correctUrls = new Set<string>();
  const expectedUrls = new Set<string>();
  const cases = prepared.manifest.rows.map((row) => {
    const capture = prepared.captures.find(
      (capture) => capture.caseId === row.id,
    );
    const label = prepared.labels.cases.find(
      (label) => label.caseId === row.id,
    );
    const metrics = emptyMetrics();
    if (!capture || !label) throw new Error("Missing validated case.");
    const fetchedUrl = publicUrl(capture.finalUrl ?? capture.requestedUrl).href;
    const html = prepared.bodies[row.id];
    const page =
      capture.outcome === "html" && html !== undefined
        ? extractPublicPage(html, fetchedUrl, new Date(capture.capturedAt))
        : null;
    const context = prepared.contexts.get(row.id);
    const evidenceMatches = (claim: ExtractedFact) =>
      claim.evidence.url === fetchedUrl &&
      norm(claim.value) === context?.values.get(claim.evidence.selector) &&
      norm(claim.evidence.quote) ===
        context.values.get(claim.evidence.selector);
    const titleMatches = (
      claim: ExtractedFact | undefined,
      expected: z.infer<typeof groundedValue> | undefined,
    ) =>
      claim &&
      expected &&
      evidenceMatches(claim) &&
      expected.acceptedValues.map(norm).includes(norm(claim.value));
    if (label.kind === "job_detail" && context) {
      expectedUrls.add(fetchedUrl);
      if (
        page?.kind === "job_detail" &&
        page.originalVacancyUrl === fetchedUrl &&
        titleMatches(page.title, label.title) &&
        titleMatches(page.employer, label.employer) &&
        !correctUrls.has(fetchedUrl)
      ) {
        metrics.correctDetails++;
        correctUrls.add(fetchedUrl);
      }
    }
    if (page?.kind === "job_detail" && label.kind !== "job_detail")
      metrics.falseConfirmed++;
    const claims = new Map<
      string,
      { field: (typeof fields)[number]; value: string; grounded: boolean }
    >();
    for (const field of fields) {
      const actual =
        field === "applicationRoute"
          ? (page?.applicationRoutes ?? [])
          : field === "workLanguage"
            ? []
            : page?.[field]
              ? [page[field]]
              : [];
      for (const claim of actual) {
        const route = context?.routes.get(claim.evidence.selector);
        const grounded =
          field === "applicationRoute"
            ? claim.evidence.url === fetchedUrl &&
              route?.value === claim.value &&
              route.quote === norm(claim.evidence.quote)
            : evidenceMatches(claim);
        const value =
          field === "applicationRoute" ? claim.value : norm(claim.value);
        claims.set(`${field}:${value}`, {
          field,
          value,
          grounded,
        });
      }
    }
    for (const claim of claims.values()) {
      metrics.populated++;
      const expected = label.facts.find((fact) => fact.field === claim.field);
      if (
        label.kind === "job_detail" &&
        expected?.status === "present" &&
        expected.acceptedValues
          .map((value) =>
            claim.field === "applicationRoute" ? value : norm(value),
          )
          .includes(claim.value) &&
        claim.grounded
      )
        metrics.truePositive++;
    }
    for (const fact of label.facts)
      if (label.kind === "job_detail" && fact.status === "present") {
        metrics.present++;
        families.add(fact.field === "applicantScope" ? "location" : fact.field);
        if (
          [...claims.values()].some(
            (claim) =>
              claim.field === fact.field &&
              claim.grounded &&
              fact.acceptedValues
                .map((value) =>
                  fact.field === "applicationRoute" ? value : norm(value),
                )
                .includes(claim.value),
          )
        )
          metrics.recovered++;
      }
    const stratum = byStratum.get(row.stratum);
    if (!stratum) throw new Error("Unknown stratum.");
    for (const key of [
      "populated",
      "truePositive",
      "present",
      "recovered",
      "correctDetails",
      "falseConfirmed",
    ] as const) {
      overall[key] += metrics[key];
      stratum[key] += metrics[key];
    }
    return {
      caseId: row.id,
      outcome: capture.outcome,
      expectedKind: label.kind,
      extractedKind: page?.kind ?? "unavailable",
      parserVerified: false,
      ...ratios(metrics),
    };
  });
  const counts = strata.map(
    (stratum) =>
      prepared.manifest.rows.filter((row) => row.stratum === stratum).length,
  );
  const complete =
    counts.join(",") === "12,6,6,6" &&
    prepared.manifest.rows.filter((row) => row.smallLocal).length >= 10 &&
    expectedUrls.size >= 10 &&
    overall.present >= 30 &&
    families.size === 4;
  const metrics = ratios(overall);
  const passed =
    overall.correctDetails >= 10 &&
    overall.falseConfirmed === 0 &&
    metrics.precision !== null &&
    metrics.precision >= 0.9 &&
    metrics.recall !== null &&
    metrics.recall >= 0.8;
  return {
    version: 1,
    manifestHash: receipt.manifestHash,
    labelsHash: receipt.labelsHash,
    methodVersion: options.methodVersion,
    evaluatedAt: options.evaluatedAt,
    sample: {
      rows: prepared.manifest.rows.length,
      smallLocal: prepared.manifest.rows.filter((row) => row.smallLocal).length,
      expectedDetails: expectedUrls.size,
      presentFamilies: [...families].sort(),
      complete,
    },
    status: !complete
      ? "incomplete"
      : passed
        ? "reported_criteria_met"
        : "failed",
    overall: metrics,
    byStratum: Object.fromEntries(
      [...byStratum].map(([stratum, metric]) => [stratum, ratios(metric)]),
    ),
    cases,
    parserVerified: false,
    limitations:
      "Static DOM/known JobPosting evidence only; no rendered visibility, authenticated labels, source rights or verified application channel is established. Freeze timing and commit identity are operator evidence.",
  };
}
