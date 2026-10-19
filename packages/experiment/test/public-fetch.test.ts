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
    transport: async () =>
      html("<p>Documentation discusses CAPTCHA integration.</p>"),
  });
  const result = await run.fetch("https://example.org/documentation");
  assert.ok(
    "reason" in result &&
      result.reason === "authentication_or_challenge_marker",
  );
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
