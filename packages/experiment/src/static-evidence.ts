import { type CheerioAPI, load } from "cheerio";
import { z } from "zod";
import { publicUrl } from "./public-fetch.js";

export const normalizedText = (value: string) =>
  value.replace(/\s+/g, " ").trim();
export function plainText(value: string): string {
  const $ = load(value);
  $("script,style,noscript,template,iframe").remove();
  return normalizedText($.root().text());
}
export function visibleDocument(html: string) {
  const $ = load(html);
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
  return $;
}
export function structuredObjects(html: string) {
  const $ = load(html);
  const objects: { value: Record<string, unknown>; script: number }[] = [];
  let limited = $("script[type='application/ld+json']").length > 20;
  let nodes = 0;
  function walk(value: unknown, script: number, depth: number): void {
    if (++nodes > 500 || depth > 6) {
      limited = true;
      return;
    }
    if (Array.isArray(value)) {
      if (value.length > 20) {
        limited = true;
        return;
      }
      for (const child of value) walk(child, script, depth + 1);
      return;
    }
    const parsed = z.record(z.string(), z.unknown()).safeParse(value);
    if (!parsed.success) return;
    objects.push({ value: parsed.data, script });
    for (const key of [
      "@graph",
      "mainEntity",
      "itemListElement",
      "item",
      "hasPart",
    ]) {
      if (parsed.data[key] !== undefined)
        walk(parsed.data[key], script, depth + 1);
    }
  }
  $("script[type='application/ld+json']")
    .slice(0, 20)
    .each((script, node) => {
      try {
        walk(JSON.parse($(node).text()), script, 0);
      } catch {
        /* Invalid data supplies no evidence. */
      }
    });
  return { objects, limited };
}
export function hasType(value: Record<string, unknown>, type: string): boolean {
  return (
    value["@type"] === type ||
    (Array.isArray(value["@type"]) && value["@type"].includes(type))
  );
}
export function safeApplicationTarget(
  href: string,
  base: string,
): string | undefined {
  try {
    const target = new URL(href, base);
    if (target.protocol === "mailto:") {
      if (
        target.pathname.includes("%") ||
        !/^[\w.!#$%&'*+/=?^`{|}~-]+@[a-z\d](?:[a-z\d.-]*[a-z\d])?\.[a-z]{2,}$/i.test(
          target.pathname,
        )
      )
        return;
      target.search = "";
      target.hash = "";
    } else publicUrl(target.href);
    return target.href;
  } catch {
    return;
  }
}
export const recruitmentWords =
  /\b(?:apply|application|bewerb\w*|recruit\w*|resume|cv)\b/i;
export function applicationFormIntent(value: string, submitText = ""): boolean {
  return (
    /\b(?:apply|bewerb\w*|(?:submit|send) (?:your )?application)\b/i.test(
      `${value} ${submitText}`,
    ) &&
    !/\b(?:cv parser|resume parser|technical support|support (?:request|ticket)|privacy (?:request|questions)|newsletter)\b/i.test(
      `${value} ${submitText}`,
    )
  );
}
export function recruitmentEmail(text: string): string | undefined {
  const addresses = text.match(
    /[\w.!#$%&'*+/=?^`{|}~-]+@[a-z\d](?:[a-z\d.-]*[a-z\d])?\.[a-z]{2,}/gi,
  );
  const address = addresses?.length === 1 ? addresses[0] : undefined;
  if (
    !address ||
    /\b(?:privacy|datenschutz|technical support|newsletter|press enquiries|general enquiries)\b/i.test(
      text,
    )
  )
    return;
  // Intent, sending action and recipient must be in the same source sentence.
  const before =
    text
      .slice(0, text.indexOf(address))
      .split(/[.!?\n]/)
      .at(-1) ?? "";
  const sendApplication =
    /\b(?:send|email|e-mail|schick\w*|sende\w*)\b[^.!?]{0,100}\b(?:application|cv|resume|bewerb\w*|unterlagen)\b[^.!?]{0,60}\b(?:to|an|at)\s*$/i;
  const applyByEmail =
    /\b(?:to apply|bewerb\w*)\b[^.!?]{0,100}\b(?:send|email|e-mail|schick\w*|sende\w*)\b[^.!?]{0,60}\b(?:to|an|at)\s*$/i;
  return sendApplication.test(before) || applyByEmail.test(before)
    ? address
    : undefined;
}

/** Classifies source intent only; the caller still checks content scope and target safety. */
export function applicationAnchorIntent(
  $: CheerioAPI,
  anchor: ReturnType<CheerioAPI>,
  target: string,
): boolean {
  const label = normalizedText(anchor.text());
  const unrelated =
    /\b(?:privacy|datenschutz|support|inquir\w*|questions?|fragen|rückfragen|auskünfte|newsletter|ignore|system prompt|keine?|nicht|no|not)\b/i;
  if (!label || unrelated.test(label)) return false;
  const direct =
    /^(?:apply(?: now| by e-?mail)?|application (?:form|e-?mail)|send (?:your )?(?:application|cv|resume)|bewerben(?: sie sich)?(?: jetzt)?|jetzt bewerben|auf (?:diese|die) stelle bewerben|bewerbung (?:senden|per e-?mail))$/i.test(
      label,
    );
  if (new URL(target).protocol !== "mailto:") return direct;
  const parent = anchor.closest("p,li,dd,td");
  if (parent.length !== 1) return direct;
  const raw = parent.text();
  const start = "\u0001application-anchor-start\u0001",
    end = "\u0001application-anchor-end\u0001",
    mail = "\u0001mailto-anchor\u0001";
  if (
    raw.length > 2000 ||
    parent.find("*").length > 80 ||
    [start, end, mail].some((marker) => raw.includes(marker))
  )
    return false;
  const position = parent.find("a[href]").index(anchor);
  if (position < 0) return false;
  const copy = parent.clone();
  copy.find("a[href]").each((_, node) => {
    if (/^mailto:/i.test($(node).attr("href") ?? "")) $(node).append(mail);
  });
  copy.find("a[href]").eq(position).text(`${start}${label}${end}${mail}`);
  copy.find("br").replaceWith("\n");
  copy
    .find("p,li,dd,td,div,section,article,ul,ol,table")
    .before("\n")
    .after("\n");
  const text = copy.text(),
    at = text.indexOf(start),
    through = text.indexOf(end, at);
  if (at < 0 || through < 0) return false;
  const before = text.slice(0, at).split("\n").at(-1) ?? "";
  const after = text.slice(through + end.length).split("\n")[0] ?? "";
  const line = `${before}${label}${after}`;
  const addresses =
    line.match(
      /[\w.!#$%&'*+/=?^`{|}~-]+@[a-z\d](?:[a-z\d.-]*[a-z\d])?\.[a-z]{2,}/gi,
    ) ?? [];
  const recipient = new URL(target).pathname.toLowerCase();
  if (addresses.some((address) => address.toLowerCase() !== recipient))
    return false;
  if (
    unrelated.test(line) ||
    line.split(mail).length - 1 !== 1 ||
    new Set(addresses.map((value) => value.toLowerCase())).size > 1
  )
    return false;
  return (
    direct ||
    /^(?:Bewerbung(?:en)?\s+an|Applications?\s+to)\s*:\s*$/i.test(
      normalizedText(before),
    )
  );
}
