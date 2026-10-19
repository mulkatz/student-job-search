import {
  emptyState,
  ingestObservation,
  syntheticObservation,
} from "@job-search/discovery";
import { deleteApp } from "firebase-admin/app";
import { createEmulatorServices, persistSharedJobs } from "./emulator.js";
import { readPrivateDiscoveryJobs } from "./import-jobs.js";

const arguments_ = process.argv.slice(2);
if (
  arguments_.length !== 0 &&
  (arguments_.length !== 2 || arguments_[0] !== "--file" || !arguments_[1])
)
  throw new Error("Usage: seed [--file .local/path/jobs.json]");
const services = createEmulatorServices();
try {
  const filePath = arguments_[1];
  if (filePath) {
    const jobs = await readPrivateDiscoveryJobs(filePath);
    await persistSharedJobs(services.firestore, jobs);
    console.log(
      `Imported ${jobs.length} shared source projections into local emulators.`,
    );
  } else {
    const now = Date.now();
    await persistSharedJobs(services.firestore, [
      ingestObservation(
        emptyState(),
        syntheticObservation({
          observedAt: new Date(now).toISOString(),
          retentionUntil: new Date(now + 7 * 86_400_000).toISOString(),
          discoveryProvenance: {
            kind: "parent_anchor",
            parentSourceId: "synthetic-career-pages",
            parentSourceRecordId: "https://careers.synthetic.example/careers",
            parentObservedAt: new Date(now).toISOString(),
            retentionUntil: new Date(now + 7 * 86_400_000).toISOString(),
            evidence: {
              url: "https://careers.synthetic.example/careers",
              quote: "Student analytics vacancy",
              selector: "a.student-role",
            },
          },
        }),
      ).job,
    ]);
    console.log(
      "Seeded one explicitly synthetic discovery; no external source called.",
    );
  }
} finally {
  await deleteApp(services.app);
}
