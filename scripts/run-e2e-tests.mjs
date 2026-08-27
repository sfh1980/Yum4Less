import { readFileSync } from "node:fs";
import { join } from "node:path";
import { spawnNodeScript, spawnNpm, spawnNpx } from "./lib/spawn-safe.mjs";
import { loadEnvLocal } from "./lib/load-env-local.mjs";
import { ensureTestDatabase } from "./ensure-test-db.mjs";
import { psqlApplySqlContent, psqlQueryScalar } from "./lib/spawn-safe.mjs";

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

function databaseNameFromUrl(databaseUrl) {
  return new URL(databaseUrl).pathname.replace(/^\//, "").trim();
}

/** Fail closed if shared CI pins were wiped (e.g. by integration cleanup). */
function assertE2eSettingsBootstrapStores(databaseName) {
  const requiredIds = [
    "kroger-mechanicsville",
    "aldi-mechanicsville",
    "publix-1626",
    "food-lion-mechanicsville",
    "lidl-laburnum",
    "walmart-rocketts",
  ];
  for (const storeId of requiredIds) {
    const count = psqlQueryScalar(
      databaseName,
      `select count(*) from stores where id = '${storeId.replace(/'/g, "''")}';`,
    );
    if (count !== "1") {
      throw new Error(
        `e2e prep: expected store ${storeId} in ${databaseName} (found count=${count}). Re-run ensure-test-db / CI bootstrap; integration tests must not leave shared pins deleted.`,
      );
    }
  }
}

async function main() {
  const databaseUrl = resolveE2eDatabaseUrl();
  const databaseName = databaseNameFromUrl(databaseUrl);
  const ciEnv = {
    ...process.env,
    CI: "1",
    YUM4LESS_CI_BOOTSTRAP_STORES: "1",
    DATABASE_URL: databaseUrl,
    // Test geography only — fixture ingest must not inherit a silent production default.
    YUM4LESS_INGEST_ZIPS: "23111",
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

  // Belt-and-suspenders: re-apply CI bootstrap pins after fixture paths that may prune rows.
  const bootstrapSql = readFileSync(
    join(process.cwd(), "db", "ci", "014_ci_bootstrap_stores.sql"),
    "utf8",
  );
  psqlApplySqlContent(databaseName, bootstrapSql);
  const themealdbRankSql = readFileSync(
    join(process.cwd(), "db", "ci", "024_themealdb_rank_seed_clones.sql"),
    "utf8",
  );
  psqlApplySqlContent(databaseName, themealdbRankSql);
  assertE2eSettingsBootstrapStores(databaseName);

  const playwrightEnv = { ...ciEnv };
  delete playwrightEnv.PLAYWRIGHT_SKIP_WEBSERVER;
  playwrightEnv.PLAYWRIGHT_FORCE_NEW_SERVER = "1";
  playwrightEnv.PLAYWRIGHT_BASE_URL = "http://127.0.0.1:3100";

  const e2e = spawnNpx(["playwright", "test"], {
    stdio: "inherit",
    env: playwrightEnv,
  });

  process.exit(e2e.status ?? 1);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
