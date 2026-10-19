import { z } from "zod";
import { publicUrl } from "./public-fetch.js";
import {
  applicationAnchorIntent,
  applicationFormIntent,
  hasType,
  normalizedText,
  plainText,
  recruitmentEmail,
  safeApplicationTarget,
  structuredObjects,
  visibleDocument,
} from "./static-evidence.js";

const text = z.string().max(2_000);
const place = z.object({
  address: z
    .object({
      addressLocality: text.optional(),
      addressCountry: z.union([text, z.object({ name: text })]).optional(),
    })
    .optional(),
});
const jobPosting = z.object({
  title: text,
  hiringOrganization: z.object({ name: text.optional() }).optional(),
  employmentType: z.union([text, z.array(text).max(10)]).optional(),
  validThrough: text.optional(),
  applicantLocationRequirements: z
    .union([
      z.object({ name: text }),
      z.array(z.object({ name: text })).max(10),
    ])
    .optional(),
  jobLocation: z.union([place, z.array(place).max(10)]).optional(),
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
  workLanguage: ExtractedFact | "unknown";
  germanyRemoteEligibility: "unknown";
  applicationRoutes: {
    value: string;
    verified: false;
    evidence: ExtractedFact["evidence"];
  }[];
  reason?: string;
};

/** Inert static evidence only; page language, remote wording and forms prove no eligibility or delivery. */
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
  const $ = visibleDocument(html);
  const headings = $("h1,title")
    .toArray()
    .map((node) => $(node).text())
    .join(" ");
  if (
    /\b(?:job (?:is )?no longer available|position (?:has been |is )?filled|vacancy (?:has )?expired|stelle (?:ist )?nicht mehr verf[üu]gbar|stelle (?:ist )?besetzt)\b/i.test(
      headings,
    )
  )
    return {
      ...base,
      kind: "negative",
      reason: "explicit_unavailable_heading",
    };
  const fact = (
    value: string,
    selector: string,
    quote = value,
  ): ExtractedFact => ({
    value: plainText(value),
    evidence: { url: originalVacancyUrl, selector, quote: plainText(quote) },
  });
  const structured = structuredObjects(html);
  if (structured.limited)
    return { ...base, kind: "career_lead", reason: "structured_data_limit" };
  const jobs = structured.objects.filter(({ value }) =>
    hasType(value, "JobPosting"),
  );
  if (jobs.length > 1)
    return { ...base, kind: "career_lead", reason: "multiple_postings" };
  const first = jobs[0];
  const parsed = first ? jobPosting.safeParse(first.value) : undefined;
  if (first && !parsed?.success)
    return { ...base, kind: "career_lead", reason: "invalid_jobposting" };
  const posting = parsed?.success ? parsed.data : undefined;
  if (posting?.validThrough) {
    const expires = Date.parse(posting.validThrough);
    if (!Number.isFinite(expires))
      return { ...base, kind: "career_lead", reason: "invalid_expiry" };
    if (expires <= now.getTime())
      return { ...base, kind: "negative", reason: "explicit_expiry" };
  }
  const prefix = `script[type='application/ld+json']:eq(${first?.script ?? 0}) JobPosting`;
  const roots = $("main,[role='main']");
  const articles = $("article");
  const contentRoot =
    roots.length === 1
      ? roots[0]
      : articles.length === 1
        ? articles[0]
        : undefined;
  const inContent = (node: Parameters<typeof $>[0]) => {
    const element = $(node);
    return (
      (!contentRoot ||
        element.parents().addBack().toArray().includes(contentRoot)) &&
      !element
        .parents()
        .addBack()
        .is(
          "nav,footer,header,aside,form,[role='navigation'],[role='contentinfo'],[class*='related'],[class*='recommend']",
        )
    );
  };
  const blocks: {
    text: string;
    selector: string;
    fragment?: boolean;
    languageIncomplete?: boolean;
  }[] = [];
  for (const tag of ["p", "li", "dd", "dt", "span", "h1", "h2", "h3", "div"]) {
    $(tag)
      .slice(0, 2000)
      .each((index, node) => {
        if (tag === "div" && $(node).find("div,p,li,dd,dt,h1,h2,h3").length)
          return;
        const value = normalizedText($(node).text());
        if (value.length > 2000 && value.length < 20_000 && inContent(node)) {
          for (const sentence of value.match(/[^.!?]+(?:[.!?]|$)/g) ?? [])
            if (sentence.length < 2000 && sentence.trim())
              blocks.push({
                text: sentence.trim(),
                fragment: true,
                selector: `${tag}:eq(${index})`,
              });
        }
        if (value && value.length <= 2000 && inContent(node)) {
          const context = $(node).closest("p,li,dd,td");
          const languageIncomplete =
            tag === "span" &&
            normalizedText(
              context.length ? context.text() : $(node).closest("div").text(),
            ).length > 2000;
          blocks.push({
            text: value,
            selector: `${tag}:eq(${index})`,
            languageIncomplete,
          });
        }
      });
  }
  const blockFact = (
    block: { text: string; selector: string },
    value = block.text,
  ) => fact(value, block.selector, block.text);
  const positive = (value: string) =>
    !/\b(?:ignore (?:all|previous)|system prompt|no (?:need|requirement)|not required|nicht erforderlich|keine? .*kenntnisse)\b/i.test(
      value,
    );
  let title = posting?.title
    ? fact(posting.title, `${prefix}.title`)
    : undefined;
  let employer = posting?.hiringOrganization?.name
    ? fact(posting.hiringOrganization.name, `${prefix}.hiringOrganization.name`)
    : undefined;
  if (!employer?.value) {
    $("meta[property='og:title']").each((index, node) => {
      const value = $(node).attr("content") ?? "";
      const match = /\|\s*(?:Jobs? bei|Careers? at|Jobs? at)\s+(.+)$/i.exec(
        value,
      );
      if (match?.[1])
        employer = fact(
          match[1],
          `meta[property='og:title']:eq(${index})`,
          value,
        );
    });
    if (!employer?.value) {
      const company = blocks.find((block) =>
        /\bgemeinsam mit uns bei\s+[\p{L}\d&:.-]+\b/iu.test(block.text),
      );
      const match =
        company &&
        /\bgemeinsam mit uns bei\s+([\p{L}\d&:.-]+)/iu.exec(company.text);
      if (company && match?.[1]) employer = blockFact(company, match[1]);
    }
  }
  if (!posting) {
    if (
      blocks.some((block) =>
        /\b(?:no (?:current |open )?(?:vacancies|openings)|(?:currently )?not hiring|keine (?:offenen |aktuellen )?stellen)\b/i.test(
          block.text,
        ),
      )
    )
      return { ...base, kind: "negative", reason: "explicit_no_openings" };
    const nonVacancyHeading =
      /^(?:(?:our |unsere? )?(?:jobs?|careers?|karriere|stellenangebote|vacancies)(?:$|\s+(?:at|with|in|bei|for)\b)|about\b|contact\b|privacy\b|terms\b|meet (?:our |the )?team\b|our (?:team|story|mission)\b)|\b(?:sponsorship|partnerships?|volunteers?|conference|newsletter|initiativbewerbung)\b/i;
    const specific = blocks.filter(
      (block) =>
        block.selector.startsWith("h1:") && !nonVacancyHeading.test(block.text),
    );
    const recruitment = blocks.flatMap((block) => {
      const match =
        /\b(?:we are looking for|we're hiring|sucht (?:dich|Sie) als|wir suchen)\s+(.+?)(?=\s+[–—]\s+|\s+in (?:Voll|Teil|full|part)|[.!]|$)/i.exec(
          block.text,
        );
      return match?.[1] &&
        match[1].length <= 100 &&
        !/\b(?:companies|sponsors?|partnerships?|suppliers?|volunteers?|business partners?|lieferanten|ehrenamt|sponsoren|kooperation)\b/i.test(
          match[1],
        ) &&
        !/^(?:Mitarbeiter|staff|team members?|people) (?:mit|with|for)\b/i.test(
          match[1],
        )
        ? [blockFact(block, match[1])]
        : [];
    });
    if (specific.length > 1 || recruitment.length > 1)
      return { ...base, kind: "career_lead", reason: "multiple_visible_roles" };
    const nonVacancyIntent = blocks.some(
      (block) =>
        (block.selector.startsWith("h1:") &&
          /\b(?:sponsorship|partnerships?|volunteers?|conference|newsletter|initiativbewerbung)\b/i.test(
            block.text,
          )) ||
        /\b(?:we are looking for|we're hiring|sucht (?:dich|Sie) als|wir suchen)\s+(?:(?:companies|sponsors?|partnerships?|suppliers?|volunteers?|business partners?|lieferanten|ehrenamt|sponsoren|kooperation)\b|(?:Mitarbeiter|staff|team members?|people) (?:mit|with|for)\b)/i.test(
          block.text,
        ),
    );
    if (nonVacancyIntent)
      return { ...base, kind: "career_lead", reason: "non_vacancy_content" };
    const requirements = blocks.some((block) =>
      /\b(?:requirements|qualifications|your profile|dein profil|deine stelle|was du mitbringst|registration papers|kenntnisse)\b/i.test(
        block.text,
      ),
    );
    const employmentEvidence = blocks.some((block) =>
      /\b(?:part[- ]time|full[- ]time|teilzeit|vollzeit|werkstudentenstelle|applicants must|candidates must)\b/i.test(
        block.text,
      ),
    );
    const applicationEvidence = $("a[href]")
      .toArray()
      .some(
        (node) =>
          inContent(node) &&
          /\b(?:apply|bewerb\w*)\b/i.test($(node).text()) &&
          safeApplicationTarget($(node).attr("href") ?? "", originalVacancyUrl),
      );
    if (
      specific.length === 1 &&
      requirements &&
      (employmentEvidence || applicationEvidence) &&
      specific[0]
    )
      title = blockFact(specific[0]);
    else if (
      recruitment.length === 1 &&
      (requirements ||
        blocks.some((block) =>
          /\b(?:part[- ]time|full[- ]time|teilzeit|vollzeit|applicants must|candidates must)\b/i.test(
            block.text,
          ),
        ))
    )
      title = recruitment[0];
    else
      return {
        ...base,
        kind: "career_lead",
        // Preserve the reviewed-selector adapter contract for absent generic evidence.
        reason: "no_complete_jobposting",
      };
    if (!employer?.value && recruitment.length === 1) {
      const organizations = structured.objects.filter(
        ({ value }) =>
          hasType(value, "Organization") && typeof value.name === "string",
      );
      if (organizations.length === 1) {
        const organization = organizations[0];
        if (organization && typeof organization.value.name === "string")
          employer = fact(
            organization.value.name,
            `script[type='application/ld+json']:eq(${organization.script}) Organization.name`,
          );
      }
    }
  }
  if (!title?.value || !employer?.value)
    return { ...base, kind: "career_lead", reason: "no_complete_jobposting" };
  const result: ExtractedPage = {
    ...base,
    kind: "job_detail",
    title,
    employer,
  };
  const locations = (
    Array.isArray(posting?.jobLocation)
      ? posting.jobLocation
      : posting?.jobLocation
        ? [posting.jobLocation]
        : []
  )
    .map((item) =>
      [
        item.address?.addressLocality,
        typeof item.address?.addressCountry === "string"
          ? item.address.addressCountry
          : item.address?.addressCountry?.name,
      ]
        .filter(Boolean)
        .join(", "),
    )
    .filter(Boolean);
  if (locations.length)
    result.location = fact(
      [...new Set(locations)].join("; "),
      `${prefix}.jobLocation.address`,
    );
  const employment = posting?.employmentType;
  if (
    employment &&
    plainText(Array.isArray(employment) ? employment.join(", ") : employment)
  )
    result.workFormat = fact(
      Array.isArray(employment) ? employment.join(", ") : employment,
      `${prefix}.employmentType`,
    );
  if (posting?.applicantLocationRequirements) {
    const scope = Array.isArray(posting.applicantLocationRequirements)
      ? posting.applicantLocationRequirements
      : [posting.applicantLocationRequirements];
    result.applicantScope = fact(
      scope.map((item) => item.name).join(", "),
      `${prefix}.applicantLocationRequirements.name`,
    );
  }
  for (const block of blocks) {
    if (!positive(block.text)) continue;
    if (!result.workFormat) {
      const match =
        /\b(?:Werkstudentenstelle|part[- ]time(?:\s*(?:,|or|oder)\s*full[- ]time)?|full[- ]time|Teilzeit|Vollzeit|Voll- oder Teilzeit)\b/i.exec(
          block.text,
        );
      if (match) result.workFormat = blockFact(block, match[0]);
    }
    if (!result.applicantScope) {
      const home =
        /\bHome Office in [\p{Lu}][\p{L}-]+(?: [\p{Lu}][\p{L}-]+)?/u.exec(
          block.text,
        );
      if (home) result.applicantScope = blockFact(block, home[0]);
      else if (
        /Präsenz in|\bin [\p{L} -]+ immatrikuliert|Registration Papers are needed|\b(?:applicants|candidates|you) (?:must|need to) (?:reside|be based|hold|have)|\bremote (?:work|working) (?:from|in) [\p{Lu}]/iu.test(
          block.text,
        )
      )
        result.applicantScope = blockFact(block);
    }
    if (!result.location) {
      const match =
        /\b(?:Team|Office|office|Standort|Location)(?:\s+in\s+|\s*:\s*)([\p{L}][\p{L} -]{1,45})(?=\s+als\b|[,.!]|$)/u.exec(
          block.text,
        );
      if (match?.[1]) result.location = blockFact(block, match[1]);
    }
  }
  const languageBlocks = blocks.filter(
    (block) =>
      !block.fragment &&
      !block.languageIncomplete &&
      !/\b(?:ignore (?:all|previous)|system prompt)\b/i.test(block.text) &&
      /\b(?:Deutsch(?:kenntnisse(?:n)?)?|German|English(?:kenntnisse)?|Englisch(?:kenntnisse)?|French|Französisch|Russian|Russisch(?:kenntnisse(?:n)?)?|Sprachkenntnisse|language skills)\b/i.test(
        block.text,
      ) &&
      /kenntnisse|\b(?:communication|kommunikation|sprichst|beherrschst|speak|speaks|fluent|fließend|proficiency|required|accepted|preferred|mandatory|written|oral|language skills)\b/i.test(
        block.text,
      ),
  );
  const completeLanguageBlocks = languageBlocks.filter(
    (block) =>
      !languageBlocks.some(
        (other) =>
          other.text.length > block.text.length &&
          other.text.includes(block.text),
      ),
  );
  const distinctLanguageBlocks = new Map(
    completeLanguageBlocks.map((block) => [block.text.toLowerCase(), block]),
  );
  if (distinctLanguageBlocks.size === 1) {
    const language = distinctLanguageBlocks.values().next().value;
    if (
      language &&
      /\b(?:Deutsch(?:kenntnisse(?:n)?)?|German|English(?:kenntnisse)?|Englisch(?:kenntnisse)?|French|Französisch|Russian|Russisch(?:kenntnisse(?:n)?)?)\b/i.test(
        language.text,
      )
    )
      result.workLanguage = blockFact(language);
  }
  const route = (
    value: string | undefined,
    selector: string,
    quote: string,
  ) => {
    if (value && !result.applicationRoutes.some((item) => item.value === value))
      result.applicationRoutes.push({
        value,
        verified: false,
        evidence: { url: originalVacancyUrl, selector, quote },
      });
  };
  $("a[href]")
    .slice(0, 500)
    .each((index, node) => {
      const anchor = $(node),
        label = normalizedText(anchor.text());
      const target = safeApplicationTarget(
        anchor.attr("href") ?? "",
        originalVacancyUrl,
      );
      if (
        target &&
        inContent(node) &&
        positive(label) &&
        applicationAnchorIntent($, anchor, target)
      )
        route(target, `a[href]:eq(${index})`, label);
    });
  for (const block of blocks) {
    if (!positive(block.text)) continue;
    const email = recruitmentEmail(block.text);
    const conflictingAnchor =
      email &&
      $(block.selector)
        .find("a[href]")
        .add($(block.selector).parents("a[href]"))
        .toArray()
        .some((node) => {
          if (!normalizedText($(node).text()).includes(email)) return false;
          const target = safeApplicationTarget(
            $(node).attr("href") ?? "",
            originalVacancyUrl,
          );
          return target?.toLowerCase() !== `mailto:${email}`.toLowerCase();
        });
    if (email && !conflictingAnchor)
      route(
        safeApplicationTarget(`mailto:${email}`, originalVacancyUrl),
        block.selector,
        block.text,
      );
  }
  $("form")
    .slice(0, 20)
    .each((index, node) => {
      const form = $(node),
        label = normalizedText(form.text());
      if (
        form.parents().is("nav,footer,aside") ||
        form.find("input[type='password']").length ||
        !applicationFormIntent(
          label,
          form
            .find("button,input[type='submit']")
            .toArray()
            .map((control) => $(control).attr("value") ?? $(control).text())
            .join(" "),
        ) ||
        !form.find("input[type='file']").length
      )
        return;
      const target = safeApplicationTarget(
        form.attr("action") || originalVacancyUrl,
        originalVacancyUrl,
      );
      if (
        target &&
        new URL(target).origin === new URL(originalVacancyUrl).origin
      )
        route(target, `form:eq(${index})`, label);
    });
  return result;
}
