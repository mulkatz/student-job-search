import { lstatSync, readFileSync } from "node:fs";
import { isAbsolute, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { corpusHash, validateModelCorpus } from "./model-corpus.js";
import { scoreModelReport } from "./model-scoring.js";
import { ExperimentStore } from "./store.js";

const root = fileURLToPath(new URL("../../../", import.meta.url));
function privateJson(inputPath: string): unknown {
  const path = resolve(root, inputPath);
  const localRelative = relative(resolve(root, ".local"), path);
  const inputStat = lstatSync(path);
  if (
    isAbsolute(localRelative) ||
    localRelative === ".." ||
    localRelative.startsWith(`..${sep}`) ||
    !inputStat.isFile() ||
    (inputStat.mode & 0o077) !== 0
  )
    throw new Error("Input must be a regular private file under .local/.");
  let component = resolve(root, ".local");
  if (!lstatSync(component).isDirectory())
    throw new Error("Private input directory must not be a symlink.");
  for (const segment of localRelative.split(sep)) {
    component = join(component, segment);
    if (lstatSync(component).isSymbolicLink())
      throw new Error("Private input must not traverse symlinks.");
  }
  return JSON.parse(readFileSync(path, "utf8"));
}
function corpus() {
  const input: unknown = JSON.parse(
    readFileSync(resolve(root, "experiments/g3/model-corpus.json"), "utf8"),
  );
  return validateModelCorpus(input);
}
try {
  const [command, ...args] = process.argv.slice(2);
  if (command === "fixture-check" && args.length === 0) {
    const data = corpus();
    console.log(
      JSON.stringify(
        {
          version: 1,
          corpusHash: corpusHash(data),
          profiles: data.profiles.length,
          documents: data.documents.length,
          jobs: data.jobs.length,
          packages: data.packages.length,
          readiness: "approval_pending_model_not_run",
        },
        null,
        2,
      ),
    );
  } else if (command === "score") {
    const options = new Map<string, string>();
    for (let index = 0; index < args.length; index += 2) {
      const key = args[index];
      const value = args[index + 1];
      if (
        !key ||
        !value ||
        !["--report", "--approval", "--run-config"].includes(key) ||
        options.has(key)
      )
        throw new Error("Invalid score arguments.");
      options.set(key, value);
    }
    const reportPath = options.get("--report");
    if (!reportPath) throw new Error("A private observed report is required.");
    const approvalPath = options.get("--approval");
    const runConfigPath = options.get("--run-config");
    const score = scoreModelReport(
      corpus(),
      privateJson(reportPath),
      approvalPath ? privateJson(approvalPath) : undefined,
      runConfigPath ? privateJson(runConfigPath) : undefined,
    );
    console.log(
      JSON.stringify(
        {
          ...score,
          provenance: {
            provider: score.provenance.provider,
            model: score.provenance.model,
            endpoint: "private_report_endpoint",
          },
        },
        null,
        2,
      ),
    );
    if (score.status === "failed") process.exitCode = 1;
  } else {
    const manifest: unknown = JSON.parse(
      readFileSync(resolve(root, "experiments/g3/queries.json"), "utf8"),
    );
    const store = new ExperimentStore(root, manifest);
    if (
      command === "init" &&
      args[0] === "--config" &&
      args[1] &&
      args.length === 2
    ) {
      store.initialize(privateJson(args[1]));
      console.log(
        "Initialized private G3 ledger; no live observation has begun.",
      );
    } else if (command === "status" && args.length === 0)
      console.log(JSON.stringify(store.status(), null, 2));
    else
      throw new Error(
        "Use init --config .local/... | status | fixture-check | score --report .local/... [--approval .local/...] [--run-config .local/...].",
      );
  }
} catch {
  console.error(
    "Experiment command failed. Check arguments, owner-only private input/state permissions, fixture/report versions and writer-lock reconciliation. No live call was made.",
  );
  process.exitCode = 1;
}
