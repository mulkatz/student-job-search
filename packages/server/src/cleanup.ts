import { deleteApp } from "firebase-admin/app";
import {
  cleanupExpiredProjections,
  createEmulatorServices,
} from "./emulator.js";

const services = createEmulatorServices();
try {
  const count = await cleanupExpiredProjections(services.firestore);
  console.log(
    `Removed ${count} expired local read projections.${count === 100 ? " A full batch was removed; run again to drain remaining expired projections." : ""}`,
  );
} finally {
  await deleteApp(services.app);
}
