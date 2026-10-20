import { createServer } from "node:http";
import { apiHandler } from "./api.js";
import { createEmulatorServices } from "./emulator.js";
import { productionPilotSearchHandler } from "./pilot-search.js";
import { pilotSearchConfig } from "./pilot-search-schema.js";
import { createProductionServices } from "./production.js";

const production = process.env.JOB_SEARCH_MODE === "private-pilot";
if (process.env.JOB_SEARCH_MODE && !production)
  throw new Error("Unsupported server mode");
const services = production
  ? createProductionServices()
  : createEmulatorServices();
const port = production ? Number(process.env.PORT ?? "8080") : 3001;
if (!Number.isInteger(port) || port < 1 || port > 65535)
  throw new Error("Invalid server port");
const search = production ? pilotSearchConfig(process.env) : null;
const handler = search
  ? productionPilotSearchHandler(
      services.dependencies,
      services.firestore,
      services.app,
      search,
    )
  : apiHandler(services.dependencies);
const server = createServer(handler);
server.requestTimeout = 20_000;
server.headersTimeout = 10_000;
server.listen(port, production ? "0.0.0.0" : "127.0.0.1", () =>
  console.log(
    production
      ? "Private pilot API ready"
      : "Local emulator API: http://127.0.0.1:3001",
  ),
);
for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => server.close(() => process.exit(0)));
}
