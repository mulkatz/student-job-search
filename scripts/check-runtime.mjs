import { readFileSync } from "node:fs";
import { URL } from "node:url";

const { engines } = JSON.parse(
  readFileSync(new URL("../package.json", import.meta.url), "utf8"),
);
const npmVersion =
  process.env.npm_config_user_agent?.match(/^npm\/([^ ]+)/)?.[1];
if (process.versions.node !== engines.node || npmVersion !== engines.npm) {
  console.error(`Required runtime: Node ${engines.node}, npm ${engines.npm}.`);
  process.exitCode = 1;
}
