import { createServer } from "node:http";
import { apiHandler } from "./api.js";
import { createEmulatorServices } from "./emulator.js";

const { dependencies } = createEmulatorServices();
const server = createServer(apiHandler(dependencies));
server.requestTimeout = 20_000;
server.headersTimeout = 10_000;
server.listen(3001, "127.0.0.1", () =>
  console.log("Local emulator API: http://127.0.0.1:3001"),
);
for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => server.close(() => process.exit(0)));
}
