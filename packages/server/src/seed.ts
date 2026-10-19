import {
  emptyState,
  ingestObservation,
  syntheticObservation,
} from "@job-search/discovery";
import { deleteApp } from "firebase-admin/app";
import { createEmulatorServices, persistSharedJobs } from "./emulator.js";

const services = createEmulatorServices();
try {
  const now = Date.now();
  await persistSharedJobs(services.firestore, [
    ingestObservation(
      emptyState(),
      syntheticObservation({
        observedAt: new Date(now).toISOString(),
        retentionUntil: new Date(now + 7 * 86_400_000).toISOString(),
      }),
    ).job,
  ]);
  console.log(
    "Seeded one explicitly synthetic discovery; no external source called.",
  );
} finally {
  await deleteApp(services.app);
}
