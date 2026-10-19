import { load } from "cheerio";
import { z } from "zod";
import { publicUrl } from "./public-fetch.js";

const shortText = z.string().trim().min(1).max(2_000);
const jobPosting = z.object({
  "@type": z.union([
    z.literal("JobPosting"),
    z.array(z.string()).refine((types) => types.includes("JobPosting")),
  ]),
  title: shortText,
  hiringOrganization: z.object({ name: shortText }),
  employmentType: z.union([shortText, z.array(shortText).max(10)]).optional(),
  validThrough: shortText.optional(),
  applicantLocationRequirements: z.object({ name: shortText }).optional(),
  jobLocation: z
    .object({
      address: z.object({
        addressLocality: shortText.optional(),
        addressCountry: shortText.optional(),
      }),
    })
    .optional(),
});
export type ExtractedFact = {
  value: string;
  evidence: { url: string; selector: string; quote: string };
};
export type ExtractedPage = {
  kind: "job_detail" | "career_lead" | "negative" | "unavailable";
  originalVacancyUrl: string;
  title?: ExtractedFact;
  employer?: ExtractedFact;
  location?: ExtractedFact;
  workFormat?: ExtractedFact;
  applicantScope?: ExtractedFact;
  workLanguage: "unknown";
  germanyRemoteEligibility: "unknown";
  applicationRoutes: {
    value: string;
    verified: false;
    evidence: ExtractedFact["evidence"];
  }[];
  reason?: string;
};

function plain(value: string): string {
  return load(value).text().replace(/\s+/g, " ").trim();
}

function candidates(value: unknown): unknown[] | null {
  if (Array.isArray(value)) return value.length > 20 ? null : value;
  const graph = z
    .object({ "@graph": z.array(z.unknown()).max(100) })
    .safeParse(value);
  return graph.success
    ? graph.data["@graph"].length > 20
      ? null
      : graph.data["@graph"]
    : [value];
}

/** Returns plain evidence only. Cheerio does not sanitize serialized HTML. */
export function extractPublicPage(
  html: string,
  fetchedUrl: string,
  now = new Date(),
): ExtractedPage {
  const originalVacancyUrl = publicUrl(fetchedUrl).href;
  const base: ExtractedPage = {
    kind: "unavailable",
    originalVacancyUrl,
    workLanguage: "unknown",
    germanyRemoteEligibility: "unknown",
    applicationRoutes: [],
  };
  if (Buffer.byteLength(html) > 2_000_000)
    return { ...base, reason: "input_limit" };
  const $ = load(html);
  $(
    "script:not([type='application/ld+json']),style,noscript,iframe,form",
  ).remove();
  const heading = $("h1,title")
    .toArray()
    .map((element) => $(element).text())
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
  if (
    /\b(?:job (?:is )?no longer available|position (?:has been |is )?filled|vacancy (?:has )?expired|stelle (?:ist )?nicht mehr verf[üu]gbar|stelle (?:ist )?besetzt)\b/i.test(
      heading,
    )
  ) {
    return {
      ...base,
      kind: "negative",
      reason: "explicit_unavailable_heading",
    };
  }
  const fact = (value: string, selector: string): ExtractedFact => {
    const text = plain(value);
    return {
      value: text,
      evidence: { url: originalVacancyUrl, selector, quote: text },
    };
  };
  const postings: { posting: z.infer<typeof jobPosting>; index: number }[] = [];
  let truncated = $("script[type='application/ld+json']").length > 20;
  $("script[type='application/ld+json']")
    .slice(0, 20)
    .each((index, element) => {
      try {
        const json: unknown = JSON.parse($(element).text());
        const values = candidates(json);
        if (values === null) {
          truncated = true;
          return;
        }
        for (const candidate of values) {
          const parsed = jobPosting.safeParse(candidate);
          if (parsed.success) postings.push({ posting: parsed.data, index });
        }
      } catch {
        // Invalid structured data remains an unconfirmed lead, never instructions.
      }
    });
  if (truncated)
    return { ...base, kind: "career_lead", reason: "structured_data_limit" };
  if (postings.length > 1)
    return { ...base, kind: "career_lead", reason: "multiple_postings" };
  const first = postings[0];
  if (!first)
    return { ...base, kind: "career_lead", reason: "no_complete_jobposting" };
  const { posting, index } = first;
  if (posting.validThrough !== undefined) {
    const expires = Date.parse(posting.validThrough);
    if (!Number.isFinite(expires))
      return { ...base, kind: "career_lead", reason: "invalid_expiry" };
    if (expires < now.getTime())
      return { ...base, kind: "negative", reason: "explicit_expiry" };
  }
  const prefix = `script[type='application/ld+json']:eq(${index}) JobPosting`;
  const title = fact(posting.title, `${prefix}.title`);
  const employer = fact(
    posting.hiringOrganization.name,
    `${prefix}.hiringOrganization.name`,
  );
  if (!title.value || !employer.value)
    return { ...base, kind: "career_lead", reason: "empty_text_fields" };
  const result: ExtractedPage = {
    ...base,
    kind: "job_detail",
    title,
    employer,
  };
  const location = posting.jobLocation?.address;
  if (location && (location.addressLocality || location.addressCountry)) {
    result.location = fact(
      [location.addressLocality, location.addressCountry]
        .filter(Boolean)
        .join(", "),
      `${prefix}.jobLocation.address`,
    );
  }
  if (posting.employmentType) {
    result.workFormat = fact(
      Array.isArray(posting.employmentType)
        ? posting.employmentType.join(", ")
        : posting.employmentType,
      `${prefix}.employmentType`,
    );
  }
  if (posting.applicantLocationRequirements) {
    result.applicantScope = fact(
      posting.applicantLocationRequirements.name,
      `${prefix}.applicantLocationRequirements.name`,
    );
  }
  $("a[href]")
    .slice(0, 500)
    .each((index, element) => {
      const anchor = $(element);
      const label = anchor.text().replace(/\s+/g, " ").trim();
      const href = anchor.attr("href");
      if (!href || !/\b(?:apply|application|bewerben|bewerbung)\b/i.test(label))
        return;
      try {
        const target = new URL(href, originalVacancyUrl);
        if (target.protocol === "mailto:") {
          // Preserve only a single explicitly present address, never headers/body.
          if (!/^[^\s@,;?]+@[^\s@,;?]+\.[^\s@,;?]+$/.test(target.pathname))
            return;
          target.search = "";
          target.hash = "";
        } else {
          publicUrl(target.href);
        }
        if (
          !result.applicationRoutes.some((route) => route.value === target.href)
        ) {
          result.applicationRoutes.push({
            value: target.href,
            verified: false,
            evidence: {
              url: originalVacancyUrl,
              selector: `a[href]:eq(${index})`,
              quote: label,
            },
          });
        }
      } catch {
        // Unsafe/unsupported links are not application channels.
      }
    });
  return result;
}
