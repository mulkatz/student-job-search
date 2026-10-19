import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

const scannerUrl = new URL("../scan-secrets.mjs", import.meta.url).href;
const runScanner = (root) =>
  spawnSync(
    process.execPath,
    [
      "--input-type=module",
      "-e",
      "const { runScan } = await import(process.argv[2]); await runScan(process.argv[1]);",
      root,
      scannerUrl,
    ],
    { encoding: "utf8" },
  );

for (const file of [
  "ordinary.txt",
  ".env.regression",
  ".secretlintignore.regression",
]) {
  test(`secret scanner detects and masks generated credentials in ${file}`, () => {
    const root = mkdtempSync(join(tmpdir(), "job-search-secret-scan-"));
    try {
      const init = spawnSync("git", ["init", "--quiet", root], {
        encoding: "utf8",
      });
      assert.equal(init.status, 0, "temporary Git repository must initialize");
      writeFileSync(join(root, ".gitignore"), ".env.*\n.secretlintignore.*\n");
      writeFileSync(
        join(root, file),
        "Synthetic fixture without credentials.\n",
      );
      const add = spawnSync("git", ["add", "--force", "--", file], {
        cwd: root,
        encoding: "utf8",
      });
      assert.equal(add.status, 0, "fixture must be tracked even when ignored");
      const valid = runScanner(root);
      assert.equal(valid.status, 0, "credential-free fixture must pass");
      assert.match(valid.stdout, /Secret scan passed/);

      // Generate an enabled-rule synthetic pattern in memory; never commit a key.
      const syntheticSecret = "Aa1B".repeat(10);
      writeFileSync(
        join(root, file),
        `AWS_SECRET_ACCESS_KEY=${syntheticSecret}\n`,
      );
      const detected = runScanner(root);
      const output = `${detected.stdout}${detected.stderr}`;
      assert.equal(detected.status, 1, "detected secret must fail the command");
      assert.equal(
        /secretlint-rule-aws/.test(output),
        true,
        "AWS rule must detect the fixture",
      );
      assert.equal(
        /\*{3}/.test(output),
        true,
        "finding must contain a masking marker",
      );
      assert.equal(
        output.includes(syntheticSecret),
        false,
        "findings must mask values",
      );
      assert.equal(
        output.includes(root),
        false,
        "findings must use relative paths",
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
}
