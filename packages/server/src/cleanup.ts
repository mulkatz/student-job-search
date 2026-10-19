import { deleteApp } from "firebase-admin/app";
import {
  cleanupExpiredProjections,
  createEmulatorServices,
} from "./emulator.js";

const services = createEmulatorServices();
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
  }
  console.log(
    `Removed ${count} expired local read projections.${count === 100 ? " A full batch was removed; run again to drain remaining expired projections." : ""}`,
  );
  console.log(
    `Processed ${profiles.size} due private profile records.${profiles.size === 25 ? " A full batch was processed; run again to drain due records." : ""}`,
  );
} finally {
  await deleteApp(services.app);
}
