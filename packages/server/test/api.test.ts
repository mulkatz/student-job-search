import assert from "node:assert/strict";
import { once } from "node:events";
import { createServer } from "node:http";
import test from "node:test";
import {
  type ApiDependencies,
  apiHandler,
  type Preferences,
} from "../src/api.js";
import { requireEmulators } from "../src/emulator.js";

async function withApi(run: (url: string, calls: string[]) => Promise<void>) {
  const calls: string[] = [];
  const values = new Map<string, Preferences>();
  const dependencies: ApiDependencies = {
    verifyToken: async (token) => {
      if (!["owner-a", "owner-b"].includes(token))
        throw new Error("invalid or expired");
      return { uid: token };
    },
    listJobs: async () => [],
    getPreferences: async (ownerId) => {
      calls.push(ownerId);
      return values.get(ownerId) ?? null;
    },
    createPreferences: async (ownerId) => {
      const value: Preferences = {
        ownerId,
        label: "Synthetic local preferences",
      };
      calls.push(ownerId);
      values.set(ownerId, value);
      return value;
    },
  };
  const server = createServer(apiHandler(dependencies));
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  try {
    await run(`http://127.0.0.1:${address.port}`, calls);
  } finally {
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}
test("API rejects missing, malformed and expired credentials before data access", async () => {
  await withApi(async (url, calls) => {
    for (const token of [undefined, "invalid", "expired"]) {
      const response = await fetch(`${url}/api/preferences`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      assert.equal(response.status, 401);
    }
    assert.deepEqual(calls, []);
  });
});
test("owner scope comes only from verified token and arbitrary owner routes are denied", async () => {
  await withApi(async (url, calls) => {
    for (const ownerId of ["owner-a", "owner-b"]) {
      const response = await fetch(`${url}/api/demo/preferences`, {
        method: "POST",
        headers: { Authorization: `Bearer ${ownerId}` },
      });
      assert.equal(response.status, 200);
      assert.deepEqual(await response.json(), {
        preferences: { ownerId, label: "Synthetic local preferences" },
      });
    }
    const spoofed = await fetch(`${url}/api/demo/preferences`, {
      method: "POST",
      headers: {
        Authorization: "Bearer owner-a",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ ownerId: "owner-b" }),
    });
    assert.equal(spoofed.status, 400);
    const arbitrary = await fetch(`${url}/api/users/owner-b/preferences`, {
      headers: { Authorization: "Bearer owner-a" },
    });
    assert.equal(arbitrary.status, 404);
    assert.deepEqual(calls, ["owner-a", "owner-b"]);
  });
});
test("server cannot fall through to live Firebase or ambient credentials", () => {
  assert.throws(() => requireEmulators({}), /emulator-only/);
  assert.throws(
    () => requireEmulators({ FIREBASE_AUTH_EMULATOR_HOST: "production:9099" }),
    /emulator-only/,
  );
  requireEmulators({
    FIREBASE_AUTH_EMULATOR_HOST: "127.0.0.1:9099",
    FIRESTORE_EMULATOR_HOST: "127.0.0.1:8080",
    FIREBASE_STORAGE_EMULATOR_HOST: "127.0.0.1:9199",
  });
  assert.throws(
    () =>
      requireEmulators({
        FIREBASE_AUTH_EMULATOR_HOST: "127.0.0.1:9099",
        FIRESTORE_EMULATOR_HOST: "127.0.0.1:8080",
        FIREBASE_STORAGE_EMULATOR_HOST: "127.0.0.1:9199",
        STORAGE_EMULATOR_HOST: "https://outside.example",
      }),
    /emulator-only/,
  );
});
