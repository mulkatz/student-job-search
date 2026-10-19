import assert from "node:assert/strict";
import test from "node:test";
import { safeLink } from "../src/links.mjs";

test("untrusted URLs cannot execute scripts or expose credentials", () => {
  for (const url of [
    "javascript:alert(1)",
    "data:text/html,test",
    "https://user:password@example.com/",
    "not a URL",
  ])
    assert.equal(safeLink(url), undefined);
  assert.equal(
    safeLink("https://example.com/jobs/1"),
    "https://example.com/jobs/1",
  );
});
