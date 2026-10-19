import assert from "node:assert/strict";
import {
  chmod,
  mkdir,
  mkdtemp,
  realpath,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
  emptyState,
  ingestObservation,
  syntheticObservation,
} from "@job-search/discovery";
import { readPrivateDiscoveryJobs } from "../src/import-jobs.js";

const now = Date.parse("2026-10-19T11:00:00.000Z");
const job = () => ingestObservation(emptyState(), syntheticObservation()).job;

async function withFixture(
  run: (projectRoot: string, path: string) => Promise<void>,
) {
  const projectRoot = await realpath(
    await mkdtemp(join(tmpdir(), "discovery-import-")),
  );
  const directory = join(projectRoot, ".local", "sources");
  await mkdir(directory, { recursive: true, mode: 0o700 });
  await chmod(join(projectRoot, ".local"), 0o700);
  const path = join(directory, "jobs.json");
  await writeFile(path, JSON.stringify([job()]), { mode: 0o600 });
  try {
    await run(projectRoot, path);
  } finally {
    await rm(projectRoot, { recursive: true, force: true });
  }
}

test("explicit private import accepts bounded shared projections without changing them", async () => {
  await withFixture(async (projectRoot, path) => {
    assert.deepEqual(
      await readPrivateDiscoveryJobs(path, { projectRoot, now }),
      [job()],
    );
    assert.deepEqual(
      await readPrivateDiscoveryJobs(".local/sources/jobs.json", {
        projectRoot,
        now,
      }),
      [job()],
    );
  });
});

test("import rejects public file/directory permissions, symlinks, non-files and path escapes", async () => {
  await withFixture(async (projectRoot, path) => {
    const read = (input = path) =>
      readPrivateDiscoveryJobs(input, { projectRoot, now });
    await chmod(path, 0o644);
    await assert.rejects(read(), /private regular 0600/);
    await chmod(path, 0o600);
    for (const directory of [
      join(projectRoot, ".local"),
      join(projectRoot, ".local", "sources"),
    ]) {
      await chmod(directory, 0o755);
      await assert.rejects(read(), /0700/);
      await chmod(directory, 0o700);
    }
    const alias = join(projectRoot, ".local", "alias.json");
    await symlink(path, alias);
    await assert.rejects(read(alias), /symlink/);
    const linkedDirectory = join(projectRoot, ".local", "alias");
    await symlink(join(projectRoot, ".local", "sources"), linkedDirectory);
    await assert.rejects(read(join(linkedDirectory, "jobs.json")), /symlink/);
    await assert.rejects(
      read(join(projectRoot, "outside.json")),
      /inside project .local/,
    );
    await assert.rejects(
      read(".local/../../outside.json"),
      /inside project .local/,
    );
    const directory = join(projectRoot, ".local", "directory.json");
    await mkdir(directory, { mode: 0o700 });
    await assert.rejects(read(directory), /private regular 0600/);
  });
});

test("import rejects oversized, malformed, annotated and excessive payloads", async () => {
  await withFixture(async (projectRoot, path) => {
    const read = () => readPrivateDiscoveryJobs(path, { projectRoot, now });
    await writeFile(path, " ".repeat(4 * 1024 * 1024 + 1));
    await assert.rejects(read(), /at most 4 MiB/);
    await writeFile(path, '{"synthetic-sensitive-marker" malformed');
    await assert.rejects(read(), (error: unknown) => {
      assert.ok(error instanceof Error);
      assert.equal(error.message, "Import JSON is malformed");
      assert.ok(!error.message.includes("synthetic-sensitive-marker"));
      return true;
    });
    await writeFile(
      path,
      JSON.stringify([{ ...job(), candidateNotes: "private" }]),
    );
    await assert.rejects(read(), /strict shared projection schema/);
    await writeFile(
      path,
      JSON.stringify([
        {
          ...job(),
          observation: { ...job().observation, candidateNotes: "private" },
        },
      ]),
    );
    await assert.rejects(read(), /strict shared projection schema/);
    await writeFile(path, JSON.stringify(Array.from({ length: 101 }, job)));
    await assert.rejects(read(), /1 to 100/);
    await writeFile(path, "[]");
    await assert.rejects(read(), /1 to 100/);
  });
});

test("import rejects inconsistent source pairs, content IDs, duplicates and chronology", async () => {
  await withFixture(async (projectRoot, path) => {
    const original = job();
    for (const invalid of [
      { ...original, sourceId: "different" },
      { ...original, sourceRecordId: "different" },
      { ...original, jobId: `job_${"0".repeat(32)}` },
      { ...original, currentRevisionId: `rev_${"0".repeat(64)}` },
      {
        ...original,
        observation: {
          ...original.observation,
          sourcePolicyRef: "changed-content",
        },
      },
    ]) {
      await writeFile(path, JSON.stringify([invalid]));
      await assert.rejects(
        readPrivateDiscoveryJobs(path, { projectRoot, now }),
        /inconsistent/,
      );
    }
    await writeFile(path, JSON.stringify([original, original]));
    await assert.rejects(
      readPrivateDiscoveryJobs(path, { projectRoot, now }),
      /inconsistent/,
    );
    for (const invalid of [
      { ...original, firstSeenAt: "2026-10-20T10:00:00.000Z" },
      { ...original, lastSeenAt: "2026-10-18T10:00:00.000Z" },
      { ...original, lastCheckedAt: "2026-10-20T10:00:00.000Z" },
    ]) {
      await writeFile(path, JSON.stringify([invalid]));
      await assert.rejects(
        readPrivateDiscoveryJobs(path, { projectRoot, now }),
        /chronologically/,
      );
    }
    await writeFile(path, JSON.stringify([original]));
    await assert.rejects(
      readPrivateDiscoveryJobs(path, { projectRoot, now: now - 2 * 3600000 }),
      /current, unexpired/,
    );
    await assert.rejects(
      readPrivateDiscoveryJobs(path, {
        projectRoot,
        now: Date.parse(original.observation.retentionUntil),
      }),
      /current, unexpired/,
    );
  });
});
