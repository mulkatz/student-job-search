import assert from "node:assert/strict";
import test from "node:test";
import { setTimeout as delay } from "node:timers/promises";
import {
  createPublicFetcher,
  type FetchResponse,
  isPublicAddress,
  type PublicFetcherOptions,
  pinnedLookup,
  publicUrl,
} from "../src/public-fetch.js";

const html = (text = "<h1>Vacancy</h1>"): FetchResponse => ({
  status: 200,
  headers: { "content-type": "text/html; charset=utf-8" },
  body: Buffer.from(text),
});
function setup(overrides: Partial<PublicFetcherOptions> = {}) {
  const sent: string[] = [];
  const reserved: string[] = [];
  const fetch = createPublicFetcher({
    liveOptIn: true,
    sourcePolicy: async () => ({
      status: "permitted",
      evidenceRef: "synthetic-policy",
    }),
    resolve: async () => [{ address: "93.184.216.34", family: 4 }],
    beforeRequest: async ({ url }) => {
      reserved.push(url);
    },
    transport: async (input) => {
      assert.deepEqual(reserved, [...sent, input.url.href]);
      assert.equal(input.address, "93.184.216.34");
      assert.equal(input.url.username, "");
      sent.push(input.url.href);
      return html();
    },
    minOriginIntervalMs: 1,
    ...overrides,
  });
  return { fetch, sent, reserved };
}

test("rejects internal/reserved/transition addresses and unsafe URLs", () => {
  for (const address of [
    "127.0.0.1",
    "10.0.0.1",
    "169.254.169.254",
    "100.100.100.200",
    "168.63.129.16",
    "192.0.2.1",
    "224.0.0.1",
    "::1",
    "fe80::1",
    "fc00::1",
    "2001:db8::1",
    "::ffff:93.184.216.34",
    "2002:0808:0808::1",
  ]) {
    assert.equal(isPublicAddress(address), false, address);
  }
  assert.equal(isPublicAddress("93.184.216.34"), true);
  assert.equal(isPublicAddress("2606:4700:4700::1111"), true);
  const credentialUrl = new URL("https://example.org");
  credentialUrl.username = "synthetic";
  credentialUrl.password = "placeholder";
  for (const url of [
    "file:///etc/passwd",
    credentialUrl.href,
    "http://2130706433",
    "http://0x7f000001",
    "http://[::ffff:127.0.0.1]",
    "http://metadata.google.internal",
    "http://local",
    "http://example.org:8080",
    "https://example.org.",
  ]) {
    assert.throws(() => publicUrl(url), url);
  }
});

test("live opt-in and source permission stop before resolver, reservation or transport", async () => {
  for (const overrides of [
    { liveOptIn: false },
    { sourcePolicy: async () => ({ status: "unresolved" as const }) },
    { sourcePolicy: async () => ({ status: "restricted" as const }) },
    {
      sourcePolicy: async () => ({
        status: "permitted" as const,
        evidenceRef: "",
      }),
    },
  ]) {
    const run = setup({
      ...overrides,
      resolve: async () => {
        throw new Error("must not resolve");
      },
    });
    const result = await run.fetch("https://example.org/job");
    assert.ok(result.kind === "blocked" || result.kind === "policy_unresolved");
    assert.deepEqual(run.reserved, []);
    assert.deepEqual(run.sent, []);
  }
});

test("mixed DNS answers are rejected; pinned lookup never re-resolves", async () => {
  const run = setup({
    resolve: async () => [
      { address: "93.184.216.34", family: 4 },
      { address: "10.0.0.1", family: 4 },
    ],
  });
  assert.equal((await run.fetch("https://example.org/job")).kind, "blocked");
  assert.deepEqual(run.reserved, []);
  const lookup = pinnedLookup({ address: "93.184.216.34", family: 4 });
  lookup("example.org", {}, (error, address, family) => {
    assert.equal(error, null);
    assert.equal(address, "93.184.216.34");
    assert.equal(family, 4);
  });
  lookup("example.org", { all: true }, (error, addresses) => {
    assert.equal(error, null);
    assert.deepEqual(addresses, [{ address: "93.184.216.34", family: 4 }]);
  });
});

test("every safe redirect is separately checked and reserved; internal redirects never send", async () => {
  const policies: string[] = [];
  let sends = 0;
  const run = setup({
    sourcePolicy: async (url) => {
      policies.push(url.href);
      return { status: "permitted", evidenceRef: "fixture" };
    },
    transport: async () =>
      ++sends === 1
        ? { status: 302, headers: { location: "/next" }, body: Buffer.alloc(0) }
        : html(),
  });
  const result = await run.fetch("https://example.org/job");
  assert.equal(result.kind, "html");
  assert.equal(result.requests, 2);
  assert.deepEqual(run.reserved, policies);
  const unsafe = setup({
    transport: async () => ({
      status: 302,
      headers: { location: "http://169.254.169.254/latest" },
      body: Buffer.alloc(0),
    }),
  });
  assert.equal((await unsafe.fetch("https://example.org/job")).requests, 1);
  assert.equal(unsafe.reserved.length, 1);
});

test("redirect permission, hop cap, reservation failures and total deadline prevent sends", async () => {
  const denied = setup({
    sourcePolicy: async (url) =>
      url.hostname === "elsewhere.org"
        ? { status: "unresolved" }
        : { status: "permitted", evidenceRef: "fixture" },
    transport: async () => ({
      status: 302,
      headers: { location: "https://elsewhere.org/job" },
      body: Buffer.alloc(0),
    }),
  });
  assert.equal(
    (await denied.fetch("https://example.org/job")).kind,
    "policy_unresolved",
  );
  assert.equal(denied.reserved.length, 1);
  const capped = setup({
    maxRedirects: 0,
    transport: async () => ({
      status: 302,
      headers: { location: "/next" },
      body: Buffer.alloc(0),
    }),
  });
  assert.equal((await capped.fetch("https://example.org/job")).requests, 1);
  const failed = setup({
    beforeRequest: async () => {
      throw new Error("budget exhausted");
    },
  });
  assert.equal((await failed.fetch("https://example.org/job")).requests, 0);
  assert.deepEqual(failed.sent, []);
  const deadline = setup({
    timeoutMs: 5,
    resolve: async () => {
      await delay(15);
      return [{ address: "93.184.216.34", family: 4 }];
    },
  });
  assert.equal((await deadline.fetch("https://example.org/job")).requests, 0);
  assert.deepEqual(deadline.reserved, []);
});

test("auth/challenges, throttling, unsupported bodies and oversize responses stop without retries", async () => {
  for (const response of [
    { status: 401, headers: {}, body: Buffer.alloc(0) },
    { status: 403, headers: {}, body: Buffer.alloc(0) },
    html("<div>verify you are human CAPTCHA</div>"),
    { ...html(), status: 429, headers: { "retry-after": "120" } },
    { ...html(), headers: { "content-type": "application/pdf" } },
    {
      ...html(),
      headers: { "content-type": "text/html", "content-encoding": "gzip" },
    },
  ]) {
    const run = setup({ transport: async () => response });
    assert.notEqual((await run.fetch("https://example.org/job")).kind, "html");
    assert.equal(run.reserved.length, 1);
  }
  const oversized = setup({ maxBytes: 2 });
  assert.equal(
    (await oversized.fetch("https://example.org/job")).kind,
    "unavailable",
  );
});

test("challenge markers are distinguished from HTTP authentication or access denial", async () => {
  for (const status of [401, 403]) {
    const run = setup({
      transport: async () => ({ status, headers: {}, body: Buffer.alloc(0) }),
    });
    const result = await run.fetch("https://example.org/job");
    assert.ok(
      "reason" in result && result.reason === "authentication_or_access",
    );
  }
  const run = setup({
    transport: async () => html("<h1>CAPTCHA</h1>"),
  });
  const result = await run.fetch("https://example.org/documentation");
  assert.ok(
    "reason" in result &&
      result.reason === "authentication_or_challenge_marker",
  );
});

test("public job text survives incidental CAPTCHA code, documentation and embedded forms", async () => {
  for (const body of [
    "<h1>Barista</h1><p>Part-time role in Berlin.</p><script>const captchaEnabled = true; const docs = 'verify you are human';</script>",
    "<h1>CAPTCHA integration guide</h1><p>Documentation discusses CAPTCHA integration.</p>",
    "<h1>Barista</h1><p>We are hiring a part-time barista for our Berlin cafe. The role includes serving coffee and welcoming our guests.</p><form><p>Complete the CAPTCHA to continue</p><div class='h-captcha'></div><button>Apply</button></form><footer>This site is protected by hCaptcha.</footer>",
  ]) {
    const run = setup({ transport: async () => html(body) });
    assert.equal((await run.fetch("https://example.org/job")).kind, "html");
    assert.equal(run.reserved.length, 1);
  }
});

test("strong access instructions, challenge paths, password gates and isolated widgets stop", async () => {
  for (const body of [
    "<title>CAPTCHA</title><h1>CAPTCHA</h1>",
    "<h1>Verify you are human</h1>",
    "<p>Please complete the CAPTCHA to continue.</p>",
    "<p>CAPTCHA is required before viewing this page.</p>",
    "<p>Checking your browser before accessing the site.</p>",
    "<script src='/cdn-cgi/challenge-platform/h/g/orchestrate/chl_page/v1'></script>",
    "<title>Just a moment...</title><h1>Just a moment...</h1><script>const s=document.createElement('script');s.src='/cdn-cgi/challenge-platform/h/g/orchestrate/chl_page/v1';</script>",
    "<div id='cf-chl-widget'>Challenge</div>",
    "<form><input type='password'></form>",
    "<form><div class='g-recaptcha'></div></form>",
    "<h1>Example Employer</h1><form><p>Verify you are human</p><div class='g-recaptcha'></div><button>Continue</button></form>",
    "<header>Example Employer: welcome to our official company website and career opportunities</header><form><div class='g-recaptcha'></div><button>Continue</button></form>",
    "<iframe src='https://challenges.cloudflare.com/turnstile/widget'></iframe>",
  ]) {
    const run = setup({ transport: async () => html(body) });
    const result = await run.fetch("https://example.org/job");
    assert.ok(
      "reason" in result &&
        result.reason === "authentication_or_challenge_marker",
    );
    assert.equal(run.reserved.length, 1);
  }
});

test("Retry-After is retained and blocks subsequent requests; robots are counted metadata", async () => {
  let clock = 0;
  const limited = setup({
    now: () => clock,
    transport: async () => ({
      status: 429,
      headers: { "retry-after": "120" },
      body: Buffer.alloc(0),
    }),
  });
  const first = await limited.fetch("https://example.org/job");
  assert.ok("retryAfter" in first && first.retryAfter === "120");
  clock = 119_999;
  assert.equal((await limited.fetch("https://example.org/other")).requests, 0);
  assert.equal(limited.reserved.length, 1);
  const purposes: string[] = [];
  const robots = setup({
    beforeRequest: async ({ purpose }) => {
      purposes.push(purpose);
    },
    transport: async () => ({
      status: 200,
      headers: { "content-type": "text/plain" },
      body: Buffer.from("User-agent: *\nDisallow: /"),
    }),
  });
  assert.equal(
    (await robots.fetch("https://example.org/robots.txt", "robots")).kind,
    "robots",
  );
  assert.deepEqual(purposes, ["robots"]);
});

test("concurrent requests reserve separate pacing slots", async () => {
  const times: number[] = [];
  const run = setup({
    minOriginIntervalMs: 20,
    beforeRequest: async () => {
      times.push(Date.now());
    },
    transport: async () => html(),
  });
  const results = await Promise.all([
    run.fetch("https://example.org/a"),
    run.fetch("https://example.org/b"),
  ]);
  assert.ok(results.every((result) => result.kind === "html"));
  assert.equal(times.length, 2);
  assert.ok((times[1] ?? 0) - (times[0] ?? 0) >= 15);
});

test("a concurrent queued request observes Retry-After before reservation and send", async () => {
  let sends = 0;
  const run = setup({
    minOriginIntervalMs: 20,
    transport: async () => {
      sends++;
      return {
        status: 429,
        headers: { "retry-after": "120" },
        body: Buffer.alloc(0),
      };
    },
  });
  const results = await Promise.all([
    run.fetch("https://example.org/a"),
    run.fetch("https://example.org/b"),
  ]);
  assert.equal(sends, 1);
  assert.equal(run.reserved.length, 1);
  assert.equal(results[1]?.requests, 0);
  assert.ok(
    results[1] &&
      "reason" in results[1] &&
      results[1].reason === "rate_limit_cooldown",
  );
});

test("a cooldown appearing during a durable reservation prevents transport", async () => {
  let reservations = 0;
  let sends = 0;
  const run = setup({
    beforeRequest: async ({ url }) => {
      reservations++;
      if (url.endsWith("/b")) await delay(30);
    },
    transport: async () => {
      sends++;
      await delay(10);
      return {
        status: 429,
        headers: { "retry-after": "120" },
        body: Buffer.alloc(0),
      };
    },
  });
  const results = await Promise.all([
    run.fetch("https://example.org/a"),
    run.fetch("https://example.org/b"),
  ]);
  assert.equal(reservations, 2);
  assert.equal(sends, 1);
  assert.equal(results[1]?.requests, 0);
});

test("structured reads require JSON MIME and syntax while retaining public-fetch policy and per-hop accounting", async () => {
  const checked: string[] = [];
  const purposes: string[] = [];
  const run = setup({
    sourcePolicy: async (url) => {
      checked.push(url.href);
      return {
        status: "permitted",
        evidenceRef: "synthetic-public-json-policy",
      };
    },
    beforeRequest: async (request) => {
      purposes.push(request.purpose);
    },
    transport: async (input) => {
      assert.equal(input.purpose, "structured");
      return input.url.pathname === "/start"
        ? {
            status: 302,
            headers: { location: "https://other.example.org/jobs" },
            body: Buffer.from(""),
          }
        : {
            status: 200,
            headers: { "content-type": "application/json; charset=utf-8" },
            body: Buffer.from(
              '{"jobs":[{"id":1,"url":"https://employer.example.org/job"}]}',
            ),
          };
    },
  });
  const result = await run.fetch("https://example.org/start", "structured");
  assert.equal(result.kind, "json");
  assert.equal(result.requests, 2);
  assert.deepEqual(checked, [
    "https://example.org/start",
    "https://other.example.org/jobs",
  ]);
  assert.deepEqual(purposes, ["structured", "structured"]);
  if (result.kind === "json")
    assert.equal(JSON.parse(result.text).jobs[0].id, 1);
  for (const response of [
    html('{"jobs":[]}'),
    {
      status: 200,
      headers: { "content-type": "application/json" },
      body: Buffer.from("callback({jobs:[]})"),
    },
  ]) {
    const rejected = await setup({ transport: async () => response }).fetch(
      "https://example.org/jobs",
      "structured",
    );
    assert.equal(rejected.kind, "unavailable");
  }
  const page = await setup({
    transport: async () => ({
      status: 200,
      headers: { "content-type": "application/json" },
      body: Buffer.from('{"jobs":[]}'),
    }),
  }).fetch("https://example.org/jobs");
  assert.equal(page.kind, "unavailable");
});

test("structured JSON cannot bypass unsafe redirects, policy, limits, access challenges or Retry-After", async () => {
  for (const overrides of [
    { sourcePolicy: async () => ({ status: "unresolved" as const }) },
    { resolve: async () => [{ address: "127.0.0.1", family: 4 as const }] },
  ]) {
    let calls = 0;
    const run = setup({
      ...overrides,
      transport: async () => {
        calls++;
        return html();
      },
    });
    assert.notEqual(
      (await run.fetch("https://example.org/jobs", "structured")).kind,
      "json",
    );
    assert.equal(calls, 0);
  }
  let requests = 0;
  const redirect = setup({
    transport: async () => {
      requests++;
      return {
        status: 302,
        headers: { location: "http://169.254.169.254/latest" },
        body: Buffer.from(""),
      };
    },
  });
  assert.equal(
    (await redirect.fetch("https://example.org/jobs", "structured")).kind,
    "unavailable",
  );
  assert.equal(requests, 1);
  for (const response of [
    {
      status: 403,
      headers: { "content-type": "application/json" },
      body: Buffer.from('{"jobs":[]}'),
    },
    {
      status: 200,
      headers: { "content-type": "application/json" },
      body: Buffer.from(" ".repeat(101)),
    },
  ])
    assert.notEqual(
      (
        await setup({ maxBytes: 100, transport: async () => response }).fetch(
          "https://example.org/jobs",
          "structured",
        )
      ).kind,
      "json",
    );
  const throttled = setup({
    now: () => 0,
    transport: async () => ({
      status: 429,
      headers: { "retry-after": "120" },
      body: Buffer.from(""),
    }),
  });
  const first = await throttled.fetch("https://example.org/jobs", "structured");
  assert.equal(first.kind, "blocked");
  assert.equal(
    (await throttled.fetch("https://example.org/jobs", "structured")).requests,
    0,
  );
});
