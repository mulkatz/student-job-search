import { randomUUID } from "node:crypto";
import {
  closeSync,
  fsyncSync,
  lstatSync,
  mkdirSync,
  openSync,
  readFileSync,
  renameSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { join, resolve } from "node:path";
import {
  type DiscoveryState,
  emptyState,
  retainedJobs,
  stateSchema,
} from "./model.js";

export interface DiscoveryRepository {
  read(): DiscoveryState;
  transact<T>(change: (state: DiscoveryState) => T): T;
}
/** Private local operator state; Firestore can implement the same transaction contract. */
export class FileDiscoveryRepository implements DiscoveryRepository {
  readonly directory: string;
  readonly statePath: string;
  readonly lockPath: string;
  constructor(projectRoot: string) {
    this.directory = join(resolve(projectRoot), ".local", "g4");
    this.statePath = join(this.directory, "state.json");
    this.lockPath = join(this.directory, "writer.lock");
    for (const directory of [resolve(this.directory, ".."), this.directory]) {
      mkdirSync(directory, { recursive: true, mode: 0o700 });
      const metadata = lstatSync(directory);
      if (!metadata.isDirectory() || (metadata.mode & 0o077) !== 0)
        throw new Error("private_directory_required");
    }
  }
  read(): DiscoveryState {
    for (const directory of [resolve(this.directory, ".."), this.directory]) {
      const metadata = lstatSync(directory);
      if (!metadata.isDirectory() || (metadata.mode & 0o077) !== 0)
        throw new Error("private_directory_required");
    }
    try {
      const metadata = lstatSync(this.statePath);
      if (!metadata.isFile() || (metadata.mode & 0o077) !== 0)
        throw new Error("regular_state_file_required");
      return stateSchema.parse(
        JSON.parse(readFileSync(this.statePath, "utf8")),
      );
    } catch (error) {
      if (error instanceof Error && "code" in error && error.code === "ENOENT")
        return emptyState();
      throw error;
    }
  }
  listJobs(now = new Date()) {
    return retainedJobs(this.read(), now);
  }
  transact<T>(change: (state: DiscoveryState) => T): T {
    let lock: number;
    try {
      lock = openSync(this.lockPath, "wx", 0o600);
    } catch {
      throw new Error("writer_reconciliation_required");
    }
    let writing = false;
    let completed = false;
    const temporary = join(this.directory, `state-${randomUUID()}.tmp`);
    try {
      const state = this.read();
      const result = change(state);
      const validated = stateSchema.parse(state);
      const fd = openSync(temporary, "wx", 0o600);
      try {
        writeFileSync(fd, `${JSON.stringify(validated)}\n`);
        fsyncSync(fd);
      } finally {
        closeSync(fd);
      }
      writing = true;
      renameSync(temporary, this.statePath);
      const directoryFd = openSync(this.directory, "r");
      try {
        fsyncSync(directoryFd);
      } finally {
        closeSync(directoryFd);
      }
      completed = true;
      return result;
    } finally {
      closeSync(lock);
      if (!writing || completed) unlinkSync(this.lockPath);
    }
  }
}
