import { spawnSync } from "node:child_process";
import { lstatSync } from "node:fs";
import { devNull } from "node:os";
import { fileURLToPath, URL } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
process.chdir(root);
const inventory = spawnSync(
  "git",
  ["ls-files", "--cached", "--others", "--exclude-standard", "-z"],
  { encoding: "utf8", maxBuffer: 16 * 1024 * 1024 },
);
if (inventory.error || inventory.status !== 0) {
  console.error("Secret scan failed: Git file inventory is unavailable.");
  process.exit(1);
}
const files = [...new Set(inventory.stdout.split("\0").filter(Boolean))].filter(
  (file) => {
    try {
      // Scan working-tree regular files; do not follow symlinks outside the repo.
      return lstatSync(file).isFile();
    } catch (error) {
      if (error.code === "ENOENT") return false; // A tracked deletion has no content.
      throw error;
    }
  },
);
if (files.length === 0) {
  console.error("Secret scan failed: no repository files were selected.");
  process.exit(1);
}
for (let start = 0; start < files.length; start += 100) {
  const result = spawnSync(
    process.execPath,
    [
      "node_modules/secretlint/bin/secretlint.js",
      "--no-glob",
      "--no-gitignore",
      "--no-color",
      "--no-terminalLink",
      "--secretlintignore",
      devNull,
      ...files.slice(start, start + 100).map((file) => `./${file}`),
    ],
    { encoding: "utf8", maxBuffer: 16 * 1024 * 1024 },
  );
  // Secretlint masks values by default. Never use --output: it changes exit semantics.
  for (const output of [result.stdout, result.stderr]) {
    if (output) process.stdout.write(output.replaceAll(root, "./"));
  }
  if (result.error || result.status !== 0) {
    console.error("Secret scan failed. Resolve findings before committing.");
    process.exit(1);
  }
}
console.log(`Secret scan passed for ${files.length} repository files.`);
