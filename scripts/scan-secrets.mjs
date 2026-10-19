import { spawnSync } from "node:child_process";
import { lstatSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createEngine } from "@secretlint/node";

export async function runScan(root) {
  try {
    const inventory = spawnSync(
      "git",
      ["ls-files", "--cached", "--others", "--exclude-standard", "-z"],
      { cwd: root, encoding: "utf8", maxBuffer: 16 * 1024 * 1024 },
    );
    if (inventory.error || inventory.status !== 0) {
      throw new Error("Git file inventory is unavailable.");
    }
    const files = [
      ...new Set(inventory.stdout.split("\0").filter(Boolean)),
    ].filter((file) => {
      try {
        // Do not follow symlinks outside the repository.
        return lstatSync(join(root, file)).isFile();
      } catch (error) {
        if (error.code === "ENOENT") return false;
        throw error;
      }
    });
    if (files.length === 0)
      throw new Error("No repository files were selected.");
    const engine = await createEngine({
      cwd: root,
      configFilePath: fileURLToPath(
        new URL("../.secretlintrc.json", import.meta.url),
      ),
      formatter: "stylish",
      color: false,
      terminalLink: false,
      maskSecrets: true,
    });
    // The CLI search walker has unconditional exclusions even with --no-glob.
    // Explicit engine input scans every regular file selected by Git instead.
    const result = await engine.executeOnFiles({
      filePathList: files.map((file) => resolve(root, file)),
    });
    if (result.output) {
      process.stdout.write(result.output.replaceAll(`${resolve(root)}/`, "./"));
    }
    if (!result.ok) {
      console.error("Secret scan failed. Resolve findings before committing.");
      process.exitCode = 1;
      return;
    }
    console.log(`Secret scan passed for ${files.length} repository files.`);
  } catch {
    // Scanner/configuration/IO failure must fail closed without dumping inputs.
    console.error(
      "Secret scan failed: could not scan all selected repository files.",
    );
    process.exitCode = 1;
  }
}

if (
  process.argv[1] &&
  pathToFileURL(resolve(process.argv[1])).href === import.meta.url
) {
  await runScan(fileURLToPath(new URL("../", import.meta.url)));
}
