import { defineConfig } from "@playwright/test";

const emulatorEnvironment = {
  FIREBASE_AUTH_EMULATOR_HOST: "127.0.0.1:9099",
  FIRESTORE_EMULATOR_HOST: "127.0.0.1:8080",
  FIREBASE_STORAGE_EMULATOR_HOST: "127.0.0.1:9199",
};
export default defineConfig({
  testDir: "./test",
  testMatch: "journey.spec.ts",
  fullyParallel: false,
  workers: 1,
  use: { baseURL: "http://127.0.0.1:5173", headless: true },
  webServer: [
    {
      command:
        "npm run seed --workspace=@job-search/server && npm run start --workspace=@job-search/server",
      cwd: "../..",
      env: emulatorEnvironment,
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
