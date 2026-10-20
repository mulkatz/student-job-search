import { initializeApp } from "firebase/app";
import {
  browserLocalPersistence,
  connectAuthEmulator,
  GoogleAuthProvider,
  getAuth,
  inMemoryPersistence,
  setPersistence,
  signInAnonymously,
  signInWithPopup,
} from "firebase/auth";

const local = ["127.0.0.1", "localhost"].includes(window.location.hostname);

function firebaseConfiguration(value: unknown) {
  if (typeof value !== "object" || value === null)
    throw new Error("Firebase configuration is unavailable");
  if (
    !("apiKey" in value) ||
    typeof value.apiKey !== "string" ||
    !("projectId" in value) ||
    typeof value.projectId !== "string" ||
    !("authDomain" in value) ||
    typeof value.authDomain !== "string" ||
    !("appId" in value) ||
    typeof value.appId !== "string"
  )
    throw new Error("Firebase configuration is invalid");
  return {
    apiKey: value.apiKey,
    projectId: value.projectId,
    authDomain: value.authDomain,
    appId: value.appId,
  };
}

async function initializeRuntime() {
  if (local) {
    const auth = getAuth(
      initializeApp({
        apiKey: "synthetic-emulator-key",
        projectId: "demo-job-search",
        authDomain: "demo-job-search.firebaseapp.com",
      }),
    );
    connectAuthEmulator(auth, "http://127.0.0.1:9099", {
      disableWarnings: true,
    });
    await setPersistence(auth, inMemoryPersistence);
    return {
      auth,
      local: true,
      realProfileProcessing: false,
      login: () => signInAnonymously(auth),
    };
  }
  const [configurationResponse, healthResponse] = await Promise.all([
    fetch("/__/firebase/init.json", { cache: "no-store" }),
    fetch("/api/health", { cache: "no-store" }),
  ]);
  if (!configurationResponse.ok || !healthResponse.ok)
    throw new Error(
      "Private pilot configuration is unavailable. Please retry later.",
    );
  const health: unknown = await healthResponse.json();
  if (
    typeof health !== "object" ||
    health === null ||
    !("mode" in health) ||
    health.mode !== "private-pilot" ||
    !("realProfileProcessing" in health) ||
    typeof health.realProfileProcessing !== "boolean"
  )
    throw new Error("This deployment is not configured for the private pilot.");
  const auth = getAuth(
    initializeApp(firebaseConfiguration(await configurationResponse.json())),
  );
  await setPersistence(auth, browserLocalPersistence);
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });
  return {
    auth,
    local: false,
    realProfileProcessing: health.realProfileProcessing,
    login: () => signInWithPopup(auth, provider),
  };
}

export const runtime = await initializeRuntime();
