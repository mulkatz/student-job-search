import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "@playwright/test";

const fixturePath = process.env.G4_SOURCE_FIXTURE_PATH;
const projectRoot = fileURLToPath(new URL("../../", import.meta.url));
if (fixturePath !== undefined && !fixturePath.trim())
  throw new Error(
    "G4_SOURCE_FIXTURE_PATH must name an explicit private JSON file",
  );
const sourceEnvironment = fixturePath
  ? { G4_SOURCE_FIXTURE_PATH: resolve(projectRoot, fixturePath) }
  : {};

const emulatorEnvironment = {
  FIREBASE_AUTH_EMULATOR_HOST: "127.0.0.1:9099",
  FIRESTORE_EMULATOR_HOST: "127.0.0.1:8080",
  FIREBASE_STORAGE_EMULATOR_HOST: "127.0.0.1:9199",
};
export default defineConfig({
  testDir: "./test",
  testMatch: fixturePath
    ? "source-journey.spec.ts"
    : ["journey.spec.ts", "profile-journey.spec.ts"],
  fullyParallel: false,
  workers: 1,
  use: { baseURL: "http://127.0.0.1:5173", headless: true },
  webServer: [
    {
      command: fixturePath
        ? 'npm run seed --workspace=@job-search/server -- --file "$G4_SOURCE_FIXTURE_PATH" && npm run start --workspace=@job-search/server'
        : "npm run seed --workspace=@job-search/server && npm run start --workspace=@job-search/server",
      cwd: "../..",
      env: { ...emulatorEnvironment, ...sourceEnvironment },
      url: "http://127.0.0.1:3001/api/health",
      reuseExistingServer: false,
    },
    {
      command: "npm run dev --workspace=@job-search/web",
      cwd: "../..",
      url: "http://127.0.0.1:5173",
      reuseExistingServer: false,
    },
  ],
});
