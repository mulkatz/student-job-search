import { lstatSync, readFileSync } from "node:fs";
import { isAbsolute, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { ExperimentStore } from "./store.js";

const root = fileURLToPath(new URL("../../../", import.meta.url));
try {
  const [command, flag, configPath, ...extra] = process.argv.slice(2);
  const manifest: unknown = JSON.parse(
    readFileSync(resolve(root, "experiments/g3/queries.json"), "utf8"),
  );
  const store = new ExperimentStore(root, manifest);
  if (
    command === "init" &&
    flag === "--config" &&
    configPath &&
    extra.length === 0
  ) {
    const path = resolve(root, configPath);
    const localRelative = relative(resolve(root, ".local"), path);
    if (
      isAbsolute(localRelative) ||
      localRelative === ".." ||
      localRelative.startsWith(`..${sep}`) ||
      !lstatSync(path).isFile()
    ) {
      throw new Error("Configuration must be a regular file under .local/.");
    }
    let component = resolve(root, ".local");
    if (!lstatSync(component).isDirectory())
      throw new Error("Private configuration directory must not be a symlink.");
    for (const segment of localRelative.split(sep)) {
      component = join(component, segment);
      if (lstatSync(component).isSymbolicLink())
        throw new Error("Private configuration must not traverse symlinks.");
    }
    const config: unknown = JSON.parse(readFileSync(path, "utf8"));
    store.initialize(config);
    console.log(
      "Initialized private G3 ledger; no live observation has begun.",
    );
  } else if (command === "status" && flag === undefined) {
    console.log(JSON.stringify(store.status(), null, 2));
  } else
    throw new Error(
      "Use: npm run experiment -- init --config .local/g3/config.json | status",
    );
} catch {
  console.error(
    "Experiment command failed. Check arguments, private configuration/state, frozen manifest, and writer-lock reconciliation. No live call was made.",
  );
  process.exitCode = 1;
}
