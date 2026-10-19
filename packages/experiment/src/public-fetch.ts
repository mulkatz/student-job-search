import { lookup } from "node:dns/promises";
import { request as httpRequest } from "node:http";
import { request as httpsRequest } from "node:https";
import type { LookupFunction } from "node:net";
import { setTimeout as delay } from "node:timers/promises";
import { load } from "cheerio";
import ipaddr from "ipaddr.js";

export type PublicAddress = { address: string; family: 4 | 6 };
export type FetchPurpose = "page" | "robots";
export type SourcePermission =
  | { status: "permitted"; evidenceRef: string }
  | { status: "unresolved" | "restricted" };
export type FetchResponse = {
  status: number;
  headers: Readonly<Record<string, string>>;
  body: Buffer;
};
export type TransportInput = PublicAddress & {
  url: URL;
  signal: AbortSignal;
  maxBytes: number;
};
export type FetchOutcome =
  | { kind: "html" | "robots"; url: string; text: string; requests: number }
  | {
      kind: "blocked" | "unavailable" | "policy_unresolved";
      reason: string;
      requests: number;
      retryAfter?: string;
    };
export type PublicFetcherOptions = {
  liveOptIn: boolean;
  sourcePolicy: (url: URL) => Promise<SourcePermission>;
  // Reserve and durably mark dispatch in the shared ledger before returning.
  // A thrown error MUST prevent the send. Every redirect/robots hop calls this.
  beforeRequest: (request: {
    url: string;
    purpose: FetchPurpose;
    hop: number;
  }) => Promise<void>;
  resolve?: (hostname: string) => Promise<readonly PublicAddress[]>;
  transport?: (input: TransportInput) => Promise<FetchResponse>;
  timeoutMs?: number;
  maxBytes?: number;
  maxRedirects?: number;
  minOriginIntervalMs?: number;
  now?: () => number;
};

export function isPublicAddress(address: string): boolean {
  try {
    const parsed = ipaddr.parse(address);
    // Azure platform virtual IP is globally addressed but not a public source.
    if (parsed.toString() === "168.63.129.16") return false;
    if (parsed.range() !== "unicast") return false;
    // Restrict IPv6 to currently allocated global unicast, excluding transition
    // ranges classified separately by ipaddr (including IPv4-mapped addresses).
    return (
      parsed.kind() === "ipv4" || parsed.match(ipaddr.parseCIDR("2000::/3"))
    );
  } catch {
    return false;
  }
}

export function publicUrl(value: string): URL {
  if (value.length > 8_192) throw new Error("unsafe_target");
  const url = new URL(value);
  const hostname = url.hostname.replace(/^\[|\]$/g, "").toLowerCase();
  if (
    !["http:", "https:"].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.port ||
    hostname.endsWith(".") ||
    (!ipaddr.isValid(hostname) &&
      (!hostname.includes(".") ||
        /\.(?:localhost|local|internal|home\.arpa)$/.test(hostname))) ||
    (ipaddr.isValid(hostname) && !isPublicAddress(hostname))
  ) {
    throw new Error("unsafe_target");
  }
  url.hash = "";
  return url;
}

// This lookup never consults DNS again. Node retains the original hostname for
// Host and TLS certificate/SNI validation; no cookies, auth or referer are sent.
export function pinnedLookup(address: PublicAddress): LookupFunction {
  return (_hostname, options, callback) => {
    callback(
      null,
      options.all ? [{ ...address }] : address.address,
      address.family,
    );
  };
}

async function transport(input: TransportInput): Promise<FetchResponse> {
  return new Promise((resolve, reject) => {
    const request =
      input.url.protocol === "https:" ? httpsRequest : httpRequest;
    const req = request(
      input.url,
      {
        method: "GET",
        agent: false,
        signal: input.signal,
        lookup: pinnedLookup(input),
        family: input.family,
        maxHeaderSize: 16_384,
        headers: {
          "user-agent": "JobSearchFeasibility/0.1",
          accept: "text/html,application/xhtml+xml,text/plain;q=0.5",
          "accept-encoding": "identity",
        },
      },
      (response) => {
        const chunks: Buffer[] = [];
        let bytes = 0;
        response.on("error", reject);
        response.on("data", (chunk: Buffer) => {
          bytes += chunk.byteLength;
          if (bytes > input.maxBytes) {
            req.destroy(new Error("body_limit"));
            return;
          }
          chunks.push(chunk);
        });
        response.on("end", () => {
          const headers: Record<string, string> = {};
          for (const [key, value] of Object.entries(response.headers)) {
            if (value !== undefined)
              headers[key] = Array.isArray(value) ? value.join(", ") : value;
          }
          resolve({
            status: response.statusCode ?? 0,
            headers,
            body: Buffer.concat(chunks),
          });
        });
      },
    );
    req.on("error", reject);
    req.end();
  });
}

function boundedInteger(value: number, min: number, max: number): number {
  if (!Number.isInteger(value) || value < min || value > max)
    throw new Error("Invalid fetch bound.");
  return value;
}

function abortable<T>(promise: Promise<T>, signal: AbortSignal): Promise<T> {
  signal.throwIfAborted();
  return new Promise((resolve, reject) => {
    const abort = () => reject(new Error("timeout"));
    signal.addEventListener("abort", abort, { once: true });
    promise
      .then(resolve, reject)
      .finally(() => signal.removeEventListener("abort", abort));
  });
}

function hasAccessChallenge(html: string): boolean {
  // Strong Cloudflare challenge paths can also occur in inert inline loaders.
  if (/cf-chl-|\/cdn-cgi\/challenge-platform\//i.test(html)) return true;
  const $ = load(html);
  if (
    $(
      "input[type='password'],[id*='cf-chl-'],[class*='cf-chl-'],script[src*='/cdn-cgi/challenge-platform/'],iframe[src*='/cdn-cgi/challenge-platform/']",
    ).length
  )
    return true;
  const widget =
    $(
      ".g-recaptcha,.h-captcha,.cf-turnstile,iframe[src*='recaptcha'],iframe[src*='hcaptcha.com'],iframe[src*='challenges.cloudflare.com']",
    ).length > 0;
  // Parse inertly: incidental scripts, documentation and embedded application
  // widgets do not establish an access barrier. No widget is ever executed.
  $("script,style,noscript,template,[hidden],[aria-hidden='true']").remove();
  const headings = $("title,h1")
    .toArray()
    .map((element) => $(element).text().trim());
  if (
    headings.some((heading) =>
      /^(?:captcha|security check|human verification)[\s.!:]*$|attention required.*cloudflare/i.test(
        heading,
      ),
    )
  )
    return true;
  // A public page may embed an application/newsletter CAPTCHA. Ignore that
  // form's instructions while checking the surrounding public content.
  $("form,footer,nav").remove();
  const text = $("body").text().replace(/\s+/g, " ").trim();
  const content = $("body").clone();
  content.find("header,h1,h2,h3,h4,h5,h6").remove();
  const surrounding = content.text().replace(/\s+/g, " ").trim();
  // Branding/chrome alone must not turn a CAPTCHA-only gate into public content.
  const substantive =
    surrounding.length >= 40 && surrounding.split(" ").length >= 6;
  return (
    /\b(?:verify|confirm|prove) (?:that )?you(?: are|'re) (?:a )?human\b|\bcaptcha (?:is )?required\b|\b(?:complete|solve|pass) (?:the |a |this )?(?:captcha|security check) (?:to|before you can) (?:continue|proceed|access|view)\b|\bchecking your browser before (?:accessing|continuing)\b/i.test(
      text,
    ) ||
    (widget && !substantive)
  );
}

export function createPublicFetcher(options: PublicFetcherOptions) {
  const timeoutMs = boundedInteger(options.timeoutMs ?? 15_000, 1, 30_000);
  const maxBytes = boundedInteger(options.maxBytes ?? 2_000_000, 1, 5_000_000);
  const redirects = boundedInteger(options.maxRedirects ?? 3, 0, 5);
  const interval = boundedInteger(
    options.minOriginIntervalMs ?? 1_000,
    1,
    60_000,
  );
  const now = options.now ?? Date.now;
  const nextRequest = new Map<string, number>();
  const cooldown = new Map<string, number>();
  const resolver =
    options.resolve ??
    (async (host: string) => {
      const answers = await lookup(host, { all: true, verbatim: true });
      return answers.map((answer): PublicAddress => {
        if (answer.family !== 4 && answer.family !== 6)
          throw new Error("dns_family");
        return { address: answer.address, family: answer.family };
      });
    });

  return async (
    target: string,
    purpose: FetchPurpose = "page",
  ): Promise<FetchOutcome> => {
    let requests = 0;
    if (options.liveOptIn !== true)
      return { kind: "blocked", reason: "live_opt_in_required", requests };
    const signal = AbortSignal.timeout(timeoutMs);
    try {
      let url = publicUrl(target);
      for (let hop = 0; hop <= redirects; hop++) {
        const permission = await abortable(
          options.sourcePolicy(new URL(url)),
          signal,
        );
        if (
          permission.status !== "permitted" ||
          !permission.evidenceRef.trim()
        ) {
          return {
            kind:
              permission.status === "restricted"
                ? "blocked"
                : "policy_unresolved",
            reason: "source_policy",
            requests,
          };
        }
        const hostname = url.hostname.replace(/^\[|\]$/g, "");
        const answers = ipaddr.isValid(hostname)
          ? [
              {
                address: hostname,
                family: ipaddr.parse(hostname).kind() === "ipv4" ? 4 : 6,
              } satisfies PublicAddress,
            ]
          : await abortable(resolver(hostname), signal);
        const address = answers[0];
        if (
          !address ||
          answers.some(
            (entry) =>
              !isPublicAddress(entry.address) ||
              (ipaddr.parse(entry.address).kind() === "ipv4" ? 4 : 6) !==
                entry.family,
          )
        ) {
          return { kind: "blocked", reason: "unsafe_dns", requests };
        }
        const time = now();
        if (time < (cooldown.get(url.origin) ?? -Infinity)) {
          return { kind: "blocked", reason: "rate_limit_cooldown", requests };
        }
        // Reserve pacing synchronously so concurrent calls cannot share a slot.
        const slot = Math.max(time, nextRequest.get(url.origin) ?? time);
        nextRequest.set(url.origin, slot + interval);
        if (slot > time) await delay(slot - time, undefined, { signal });
        if (now() < (cooldown.get(url.origin) ?? -Infinity)) {
          return { kind: "blocked", reason: "rate_limit_cooldown", requests };
        }
        await abortable(
          options.beforeRequest({ url: url.href, purpose, hop }),
          signal,
        );
        signal.throwIfAborted();
        if (now() < (cooldown.get(url.origin) ?? -Infinity)) {
          return { kind: "blocked", reason: "rate_limit_cooldown", requests };
        }
        requests++;
        const response = await abortable(
          (options.transport ?? transport)({
            ...address,
            url: new URL(url),
            maxBytes,
            signal,
          }),
          signal,
        );
        if (response.body.byteLength > maxBytes) throw new Error("body_limit");
        const encoding = response.headers["content-encoding"]?.toLowerCase();
        if (encoding && encoding !== "identity")
          return {
            kind: "unavailable",
            reason: "unsupported_encoding",
            requests,
          };
        if (response.status === 401 || response.status === 403)
          return {
            kind: "blocked",
            reason: "authentication_or_access",
            requests,
          };
        if (response.status === 429) {
          const retryAfter = response.headers["retry-after"];
          const seconds =
            retryAfter && /^\d+$/.test(retryAfter) ? Number(retryAfter) : NaN;
          const until = Number.isFinite(seconds)
            ? now() + seconds * 1_000
            : Date.parse(retryAfter ?? "");
          cooldown.set(
            url.origin,
            Math.max(
              now() + interval,
              Number.isFinite(until) ? until : now() + 60_000,
            ),
          );
          return {
            kind: "blocked",
            reason: "rate_limited",
            requests,
            ...(retryAfter ? { retryAfter } : {}),
          };
        }
        if ([301, 302, 303, 307, 308].includes(response.status)) {
          const location = response.headers.location;
          if (!location || hop === redirects)
            return {
              kind: "unavailable",
              reason: "redirect_limit_or_missing_target",
              requests,
            };
          url = publicUrl(new URL(location, url).href);
          continue;
        }
        if (response.status < 200 || response.status >= 300)
          return {
            kind: "unavailable",
            reason: `http_${response.status}`,
            requests,
          };
        const type = response.headers["content-type"]
          ?.split(";")[0]
          ?.trim()
          .toLowerCase();
        if (
          !(purpose === "robots"
            ? type === "text/plain"
            : type === "text/html" || type === "application/xhtml+xml")
        ) {
          return {
            kind: "unavailable",
            reason: "unsupported_content_type",
            requests,
          };
        }
        const text = response.body.toString("utf8");
        // Marker evidence remains conservative, not proof of an auth wall.
        if (purpose === "page" && hasAccessChallenge(text)) {
          return {
            kind: "blocked",
            reason: "authentication_or_challenge_marker",
            requests,
          };
        }
        return {
          kind: purpose === "page" ? "html" : "robots",
          url: url.href,
          text,
          requests,
        };
      }
    } catch {
      return {
        kind: "unavailable",
        reason: "target_or_transport_failed",
        requests,
      };
    }
    return { kind: "unavailable", reason: "redirect_limit", requests };
  };
}
