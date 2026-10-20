import { createHash } from "node:crypto";
import { constants } from "node:fs";
import { open } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { evaluateReleaseReadiness } from "./release-readiness.js";

export async function releaseCheck(
  file: URL = new URL("../../../docs/V1_READINESS.json", import.meta.url),
  now = Date.now(),
) {
  let bytes: Buffer;
  try {
    const handle = await open(
      file,
      constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK,
    );
    try {
      const stat = await handle.stat();
      if (!stat.isFile() || stat.size > 128 * 1024) throw new Error("manifest");
      const buffer = Buffer.alloc(128 * 1024 + 1);
      let length = 0;
      while (length < buffer.length) {
        const result = await handle.read(
          buffer,
          length,
          buffer.length - length,
          null,
        );
        if (!result.bytesRead) break;
        length += result.bytesRead;
      }
      if (length > 128 * 1024) throw new Error("manifest");
      bytes = buffer.subarray(0, length);
    } finally {
      await handle.close();
    }
  } catch {
    return {
      ready: false,
      manifestHash: null,
      blockers: [{ id: "manifest", reason: "manifest_unavailable" }],
      limitation:
        "Declared evidence only; this audit does not certify source artifacts, authenticity, quality, or release authorization.",
    };
  }
  const manifestHash = createHash("sha256").update(bytes).digest("hex");
  let input: unknown;
  try {
    input = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  } catch {
    return {
      ready: false,
      manifestHash,
      blockers: [{ id: "manifest", reason: "invalid_manifest" }],
      limitation:
        "Declared evidence only; this audit does not certify source artifacts, authenticity, quality, or release authorization.",
    };
  }
  return {
    ...evaluateReleaseReadiness(input, now),
    manifestHash,
    limitation:
      "Declared evidence only; this audit does not certify source artifacts, authenticity, quality, or release authorization.",
  };
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const result =
    process.argv.length === 2
      ? await releaseCheck()
      : {
          ready: false,
          manifestHash: null,
          blockers: [{ id: "manifest", reason: "arguments_invalid" }],
        };
  process.stdout.write(`${JSON.stringify(result)}\n`);
  process.exitCode = result.ready ? 0 : 2;
}
