import { deleteApp } from "firebase-admin/app";
import { PilotSearchStore } from "./pilot-search-store.js";
import { createProductionServices } from "./production.js";

async function main() {
  if (process.env.JOB_SEARCH_PILOT_SEARCH_CLEANUP !== "enabled")
    throw new Error("pilot_search_cleanup_explicit_opt_in_required");
  const services = createProductionServices();
  try {
    const store = new PilotSearchStore(services.firestore);
    const deleted = await store.cleanupPrivateHistory();
    const changed = await store.cleanupExpiredSources();
    console.log(
      JSON.stringify({
        cleanedPrivateSearchSourceRecords: changed,
        deletedPrivateSearchHistories: deleted,
        scannedMaximum: 100,
      }),
    );
  } finally {
    await services.firestore.terminate();
    await deleteApp(services.app);
  }
}
main().catch(() => {
  console.error(
    "Private search cleanup failed; inspect the protected operator state.",
  );
  process.exitCode = 1;
});
