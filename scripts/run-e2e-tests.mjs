import { spawnNodeScript, spawnNpm, spawnNpx } from "./lib/spawn-safe.mjs";
import { loadEnvLocal } from "./lib/load-env-local.mjs";
import { ensureTestDatabase } from "./ensure-test-db.mjs";

loadEnvLocal();

const DEFAULT_E2E_DATABASE_URL =
  "postgresql://postgres:postgres@localhost:5433/yum4less_test";

function resolveE2eDatabaseUrl() {
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
          "E2E CI uses yum4less_test instead of yum4less_dev so bootstrap pins and fixture ingest stay isolated. Set DATABASE_URL_TEST to override.",
        );
        return DEFAULT_E2E_DATABASE_URL;
      }
      return currentUrl;
    } catch {
      return DEFAULT_E2E_DATABASE_URL;
    }
  }

  return DEFAULT_E2E_DATABASE_URL;
}

async function main() {
  const databaseUrl = resolveE2eDatabaseUrl();
  const ciEnv = {
    ...process.env,
    CI: "1",
    YUM4LESS_CI_BOOTSTRAP_STORES: "1",
    DATABASE_URL: databaseUrl,
  };
  process.env.CI = "1";
  process.env.YUM4LESS_CI_BOOTSTRAP_STORES = "1";
  process.env.DATABASE_URL = databaseUrl;
  await ensureTestDatabase();

  const build = spawnNpm(["run", "build"], {
    stdio: "inherit",
    env: ciEnv,
  });

  if (build.status !== 0) {
    process.exit(build.status ?? 1);
  }

  const fixtureIngest = spawnNodeScript(
    "scripts/run-weekly-ad-ingest.mjs",
    ["--fixture"],
    {
      stdio: "inherit",
      env: ciEnv,
    },
  );

  if (fixtureIngest.status !== 0) {
    process.exit(fixtureIngest.status ?? 1);
  }

  const mapCatalogFixture = spawnNpx(
    ["tsx", "scripts/ingest-map-catalog.ts", "--fixture"],
    {
      stdio: "inherit",
      env: ciEnv,
    },
  );

  if (mapCatalogFixture.status !== 0) {
    process.exit(mapCatalogFixture.status ?? 1);
  }

  const e2e = spawnNpx(["playwright", "test"], {
    stdio: "inherit",
    env: {
      ...ciEnv,
      PLAYWRIGHT_FORCE_NEW_SERVER: "1",
    },
  });

  process.exit(e2e.status ?? 1);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
