import { deleteApp } from "firebase-admin/app";
import {
  cleanupExpiredProjections,
  createEmulatorServices,
} from "./emulator.js";
import { PilotSearchStore } from "./pilot-search-store.js";
import { createProductionServices } from "./production.js";

async function cleanup() {
  const production = process.env.JOB_SEARCH_MODE === "private-pilot";
  if (process.env.JOB_SEARCH_MODE && !production)
    throw new Error("Unsupported cleanup mode");
  const services = production
    ? createProductionServices()
    : createEmulatorServices();
  try {
    const count = await cleanupExpiredProjections(services.firestore);
    const profiles = await services.firestore
      .collectionGroup("profileState")
      .where("nextCleanupAt", "<=", new Date().toISOString())
      .limit(25)
      .get();
    for (const document of profiles.docs) {
      const ownerId = document.ref.parent.parent?.id;
      if (!ownerId) throw new Error("Invalid private profile path");
      await services.profiles.cleanup(ownerId);
      if (production)
        await new PilotSearchStore(services.firestore).cleanupPrivateHistory(
          ownerId,
        );
    }
    if (production) {
      const searchStore = new PilotSearchStore(services.firestore);
      await searchStore.cleanupPrivateHistory();
      await searchStore.cleanupExpiredSources();
    }
    console.log(
      `Removed ${count} expired read projections.${count === 100 ? " A full batch was removed; run again to drain remaining expired projections." : ""}`,
    );
    console.log(
      `Processed ${profiles.size} due private profile records.${profiles.size === 25 ? " A full batch was processed; run again to drain due records." : ""}`,
    );
  } finally {
    await deleteApp(services.app);
  }
}

try {
  await cleanup();
} catch {
  console.error("Cleanup failed; check private operator access and retry.");
  process.exitCode = 1;
}
