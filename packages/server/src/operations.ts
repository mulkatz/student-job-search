import { pathToFileURL } from "node:url";
import { deleteApp } from "firebase-admin/app";
import { setLogFunction } from "firebase-admin/firestore";
import { createEmulatorServices } from "./emulator.js";
import {
  collectOperationsStatus,
  type OperationsReader,
} from "./operations-domain.js";

export function firestoreOperationsReader(
  services: ReturnType<typeof createEmulatorServices>,
): OperationsReader {
  return {
    shared: async (limit, signal) => {
      signal.throwIfAborted();
      const result = await services.firestore
        .collection("sharedJobs")
        .limit(limit)
        .get();
      signal.throwIfAborted();
      return result.docs.map((document) => ({
        id: document.id,
        path: document.ref.path,
        data: document.data(),
      }));
    },
    private: async (limit, signal) => {
      signal.throwIfAborted();
      const result = await services.firestore
        .collectionGroup("profileState")
        .limit(limit)
        .get();
      signal.throwIfAborted();
      return result.docs.map((document) => ({
        id: document.id,
        path: document.ref.path,
        data: document.data(),
      }));
    },
  };
}
/** Explicit operator-only read path. Existing cleanup remains the sole lifecycle mutation command. */
export async function operationsCommand(
  write: (value: unknown) => void = (value) =>
    process.stdout.write(`${JSON.stringify(value)}\n`),
): Promise<number> {
  // CLI output must never reflect transport paths, project configuration or SDK error text.
  setLogFunction(() => {});
  let services: ReturnType<typeof createEmulatorServices> | undefined;
  let code = 2;
  try {
    services = createEmulatorServices();
    const status = await collectOperationsStatus(
      firestoreOperationsReader(services),
    );
    write(status);
    code =
      status.completeness === "complete" &&
      status.status === "clear_in_scanned_records"
        ? 0
        : 2;
  } catch {
    write({
      error: "operations_status_unavailable",
      scope: "local_emulator_records_only",
    });
  } finally {
    if (services) {
      let timer: ReturnType<typeof setTimeout> | undefined;
      try {
        await Promise.race([
          (async () => {
            const settled = await Promise.allSettled([
              services.firestore.terminate(),
              deleteApp(services.app),
            ]);
            if (settled.some((result) => result.status === "rejected"))
              throw new Error("shutdown");
          })(),
          new Promise<never>((_resolve, reject) => {
            timer = setTimeout(() => reject(new Error("shutdown")), 2000);
          }),
        ]);
      } catch {
        write({
          error: "operations_shutdown_incomplete",
          scope: "local_emulator_records_only",
        });
        code = 2;
      } finally {
        if (timer) clearTimeout(timer);
      }
    }
  }
  return code;
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const output: unknown[] = [];
  let code = 2;
  if (process.argv.length !== 2)
    output.push({ error: "operations_arguments_invalid" });
  else
    code = await operationsCommand((value) => {
      output.push(value);
    });
  await new Promise<void>((resolve) => {
    process.stdout.write(
      `${output.map((value) => JSON.stringify(value)).join("\n")}\n`,
      () => resolve(),
    );
  });
  // Reads have a bounded shutdown attempt; no write is in flight. Exit even if a transport ignores cancellation.
  process.exit(code);
}
