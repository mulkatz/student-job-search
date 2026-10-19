import { constants } from "node:fs";
import { lstat, open, realpath } from "node:fs/promises";
import { dirname, isAbsolute, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import {
  type DiscoveryJob,
  discoveryJobSchema,
  jobIdentity,
  revisionIdentity,
} from "@job-search/discovery";

const maximumBytes = 4 * 1024 * 1024;
const defaultProjectRoot = fileURLToPath(new URL("../../../", import.meta.url));

/** Explicit operator import only; the synthetic seed never calls this reader. */
export async function readPrivateDiscoveryJobs(
  filePath: string,
  options: { projectRoot?: string; now?: number } = {},
): Promise<DiscoveryJob[]> {
  const projectRoot = await realpath(options.projectRoot ?? defaultProjectRoot);
  const localRoot = resolve(projectRoot, ".local");
  const target = resolve(projectRoot, filePath);
  const nested = relative(localRoot, target);
  if (
    !nested ||
    nested.startsWith(`..${sep}`) ||
    nested === ".." ||
    isAbsolute(nested) ||
    !target.endsWith(".json")
  )
    throw new Error("Import requires a JSON file inside project .local");

  const directories = [localRoot];
  let directory = dirname(target);
  while (directory !== localRoot) {
    directories.push(directory);
    directory = dirname(directory);
  }
  const inspectDirectory = async (path: string) => {
    const stat = await lstat(path);
    if (
      !stat.isDirectory() ||
      stat.isSymbolicLink() ||
      (stat.mode & 0o7777) !== 0o700 ||
      (process.getuid && stat.uid !== process.getuid())
    )
      throw new Error(
        "Import directories must be owner-only 0700, without symlinks",
      );
    return stat;
  };
  const directoryStats = await Promise.all(directories.map(inspectDirectory));
  if ((await realpath(target)) !== target)
    throw new Error("Import path must not contain symlinks");
  const before = await lstat(target);
  const file = await open(
    target,
    constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK,
  );
  let content: string;
  try {
    const stat = await file.stat();
    if (
      !stat.isFile() ||
      before.isSymbolicLink() ||
      stat.dev !== before.dev ||
      stat.ino !== before.ino ||
      stat.nlink !== 1 ||
      (stat.mode & 0o7777) !== 0o600 ||
      (process.getuid && stat.uid !== process.getuid()) ||
      stat.size > maximumBytes
    )
      throw new Error(
        "Import requires one private regular 0600 file, at most 4 MiB",
      );
    const buffer = Buffer.alloc(maximumBytes + 1);
    let length = 0;
    while (length < buffer.length) {
      const { bytesRead } = await file.read(
        buffer,
        length,
        buffer.length - length,
        null,
      );
      if (!bytesRead) break;
      length += bytesRead;
    }
    const after = await file.stat();
    if (
      length > maximumBytes ||
      after.size !== stat.size ||
      after.mtimeMs !== stat.mtimeMs ||
      after.ctimeMs !== stat.ctimeMs
    )
      throw new Error("Import file changed or exceeded the size limit");
    content = new TextDecoder("utf-8", { fatal: true }).decode(
      buffer.subarray(0, length),
    );
    for (const [index, path] of directories.entries()) {
      const current = await inspectDirectory(path);
      const original = directoryStats[index];
      if (
        !original ||
        current.dev !== original.dev ||
        current.ino !== original.ino
      )
        throw new Error("Import directory changed during reading");
    }
    const finalPath = await lstat(target);
    if (
      (await realpath(target)) !== target ||
      finalPath.dev !== stat.dev ||
      finalPath.ino !== stat.ino
    )
      throw new Error("Import path changed during reading");
  } finally {
    await file.close();
  }
  // Strict nested schemas exclude candidate annotations and unknown properties.
  let input: unknown;
  try {
    input = JSON.parse(content);
  } catch {
    throw new Error("Import JSON is malformed");
  }
  const result = discoveryJobSchema.array().min(1).max(100).safeParse(input);
  if (!result.success)
    throw new Error(
      "Import requires 1 to 100 records matching the strict shared projection schema",
    );
  const jobs = result.data;
  const now = options.now ?? Date.now();
  const ids = new Set<string>();
  for (const job of jobs) {
    const observation = job.observation;
    if (
      ids.has(job.jobId) ||
      job.sourceId !== observation.sourceId ||
      job.sourceRecordId !== observation.sourceRecordId ||
      job.jobId !== jobIdentity(job.sourceId, job.sourceRecordId) ||
      job.currentRevisionId !== revisionIdentity(observation)
    )
      throw new Error(
        "Import source pair, job identity or current revision is inconsistent",
      );
    ids.add(job.jobId);
    if (
      Date.parse(observation.observedAt) > now ||
      Date.parse(observation.retentionUntil) <= now ||
      Date.parse(job.firstSeenAt) > Date.parse(job.lastSeenAt) ||
      Date.parse(job.lastSeenAt) > Date.parse(job.lastCheckedAt) ||
      job.lastCheckedAt !== observation.observedAt ||
      (observation.kind !== "unavailable" &&
        job.lastSeenAt !== observation.observedAt)
    )
      throw new Error(
        "Import observations must be current, unexpired and chronologically consistent",
      );
  }
  return jobs;
}
