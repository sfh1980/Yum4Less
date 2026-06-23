import { loadEnvLocal } from "./lib/load-env-local.mjs";
import { spawnNpx } from "./lib/spawn-safe.mjs";

loadEnvLocal();

const DEFAULT_INTEGRATION_DATABASE_URL =
  "postgresql://postgres:postgres@localhost:5433/yum4less_test";

function resolveIntegrationDatabaseUrl() {
  const testUrl = process.env.DATABASE_URL_TEST?.trim();
  if (testUrl) {
    return testUrl;
  }

  const currentUrl = process.env.DATABASE_URL?.trim();
  if (currentUrl) {
    try {
      const dbName = new URL(currentUrl).pathname.replace(/^\//, "").trim();
      if (dbName === "yum4less_dev") {
        console.warn(
          "Integration tests reset the target database. Using yum4less_test instead of yum4less_dev " +
            "so owner ingest data is not wiped. Set DATABASE_URL_TEST in .env.local to override.",
        );
        return DEFAULT_INTEGRATION_DATABASE_URL;
      }
      return currentUrl;
    } catch {
      return DEFAULT_INTEGRATION_DATABASE_URL;
    }
  }

  return DEFAULT_INTEGRATION_DATABASE_URL;
}

if (process.argv.includes("--reset")) {
  process.env.YUM4LESS_TEST_DB_RESET = "1";
}

process.env.YUM4LESS_CI_BOOTSTRAP_STORES = "1";
process.env.DATABASE_URL = resolveIntegrationDatabaseUrl();

const result = spawnNpx(
  ["vitest", "run", "--config", "vitest.integration.config.ts"],
  {
    stdio: "inherit",
    env: process.env,
  },
);

process.exit(result.status ?? 1);
