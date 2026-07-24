import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  applyAllInitSqlFiles,
  applySchemaMigrations,
} from "./lib/db-migrations.mjs";
import {
  assertSafeSqlIdentifier,
  containerHealthStatus,
  createDatabase,
  dockerAvailable,
  dropDatabaseIfExists,
  externalPostgresReady,
  isExternalPostgresMode,
  psqlApplySqlContent,
  psqlQueryScalar,
  runNpmScript,
  spawnNodeScript,
  tableExists,
  YUM4LESS_POSTGRES_CONTAINER,
} from "./lib/spawn-safe.mjs";

const DEFAULT_DATABASE_URL =
  "postgresql://postgres:postgres@localhost:5433/yum4less_dev";
const MAX_HEALTH_ATTEMPTS = 30;
const HEALTH_POLL_MS = 2000;
let activeDatabaseName = "yum4less_dev";

function resolveTargetDatabaseName(databaseUrl = process.env.DATABASE_URL) {
  const url = databaseUrl?.trim() || DEFAULT_DATABASE_URL;
  try {
    const parsed = new URL(url);
    const name = parsed.pathname.replace(/^\//, "").trim();
    return assertSafeSqlIdentifier(name || "yum4less_dev", "database name");
  } catch {
    return "yum4less_dev";
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isCiEnvironment() {
  const ci = process.env.CI?.trim().toLowerCase();
  return ci === "true" || ci === "1" || process.env.GITHUB_ACTIONS === "true";
}

function canResetDatabaseAutomatically() {
  return (
    isCiEnvironment() ||
    process.env.YUM4LESS_TEST_DB_RESET === "1" ||
    process.env.YUM4LESS_ALLOW_DB_RESET === "1"
  );
}

async function waitForHealthyContainer() {
  for (let attempt = 1; attempt <= MAX_HEALTH_ATTEMPTS; attempt += 1) {
    const status = containerHealthStatus();
    if (status === "healthy") {
      return;
    }

    if (attempt === MAX_HEALTH_ATTEMPTS) {
      throw new Error(
        `Timed out waiting for ${YUM4LESS_POSTGRES_CONTAINER} to become healthy (last status: ${status}).`,
      );
    }

    await sleep(HEALTH_POLL_MS);
  }
}

async function waitForExternalPostgres() {
  for (let attempt = 1; attempt <= MAX_HEALTH_ATTEMPTS; attempt += 1) {
    if (externalPostgresReady(activeDatabaseName)) {
      return;
    }

    if (attempt === MAX_HEALTH_ATTEMPTS) {
      throw new Error(
        `Timed out waiting for external Postgres at DATABASE_URL (last target DB: ${activeDatabaseName}). ` +
          "Confirm the ingest container shares a Docker network with the db service and DATABASE_URL uses host `db` (not localhost).",
      );
    }

    await sleep(HEALTH_POLL_MS);
  }
}

function databaseExists(databaseName) {
  assertSafeSqlIdentifier(databaseName, "database name");
  try {
    const count = psqlQueryScalar(
      "postgres",
      `select count(*) from pg_database where datname = '${databaseName}';`,
    );
    return count === "1";
  } catch {
    return false;
  }
}

function ensureTargetDatabaseExists() {
  if (databaseExists(activeDatabaseName)) {
    if (!tableExists("recipes", activeDatabaseName)) {
      console.log(
        `Database ${activeDatabaseName} exists but schema is missing — applying db/init/*.sql...`,
      );
      applyAllInitSqlFiles(activeDatabaseName);
    }
    return;
  }

  console.log(`Creating Postgres database ${activeDatabaseName}...`);
  createDatabase(activeDatabaseName);
  applyAllInitSqlFiles(activeDatabaseName);
}

function applyCiBootstrapStoresIfNeeded() {
  if (
    process.env.YUM4LESS_CI_BOOTSTRAP_STORES !== "1" &&
    !isCiEnvironment()
  ) {
    return;
  }

  try {
    console.log(
      "Applying db/ci/014_ci_bootstrap_stores.sql for CI/integration bootstrap pins...",
    );
    const sqlPath = join(process.cwd(), "db", "ci", "014_ci_bootstrap_stores.sql");
    const sql = readFileSync(sqlPath, "utf8");
    psqlApplySqlContent(activeDatabaseName, sql);
  } catch (error) {
    console.warn(
      "CI bootstrap store seed skipped or failed:",
      error instanceof Error ? error.message : error,
    );
  }
}

function seedMatchesCurrentMvp() {
  try {
    const catalogStoreCount = psqlQueryScalar(activeDatabaseName, "select count(*) from stores;");
    const mockPriceCount = psqlQueryScalar(
      activeDatabaseName,
      "select count(*) from price_observations where source_name = 'mock-market-data';",
    );
    const recipeCount = psqlQueryScalar(
      activeDatabaseName,
      "select count(*) from recipes where source_name = 'yum4less-internal-catalog';",
    );
    const dynamicPricingColumnCount = psqlQueryScalar(
      activeDatabaseName,
      "select count(*) from information_schema.columns where table_name = 'price_observations' and column_name in ('last_verified_at', 'source_kind', 'valid_through');",
    );
    const providerStoreSearchTableCount = psqlQueryScalar(
      activeDatabaseName,
      "select count(*) from information_schema.tables where table_schema = 'public' and table_name = 'provider_store_search_snapshots';",
    );
    const providerProductPricingTableCount = psqlQueryScalar(
      activeDatabaseName,
      "select count(*) from information_schema.tables where table_schema = 'public' and table_name = 'provider_product_pricing_snapshots';",
    );
    const ingredientAliasesTableCount = psqlQueryScalar(
      activeDatabaseName,
      "select count(*) from information_schema.tables where table_schema = 'public' and table_name = 'ingredient_aliases';",
    );
    const recipeEligibilityColumnCount = psqlQueryScalar(
      activeDatabaseName,
      "select count(*) from information_schema.columns where table_name = 'recipes' and column_name = 'eligible_for_ranking';",
    );
    const snapRetailerTableCount = psqlQueryScalar(
      activeDatabaseName,
      "select count(*) from information_schema.tables where table_schema = 'public' and table_name = 'snap_retailer_locations';",
    );
    const providerSearchTermsTableCount = psqlQueryScalar(
      activeDatabaseName,
      "select count(*) from information_schema.tables where table_schema = 'public' and table_name = 'provider_search_terms';",
    );

    const storeCount = Number(catalogStoreCount);
    const expectsCiBootstrapStores =
      isCiEnvironment() || process.env.YUM4LESS_CI_BOOTSTRAP_STORES === "1";
    const hasExpectedSeedOrMapCatalog = expectsCiBootstrapStores
      ? storeCount >= 8 && storeCount <= 64
      : true;

    return (
      hasExpectedSeedOrMapCatalog &&
      mockPriceCount === "0" &&
      Number(recipeCount) >= 3 &&
      dynamicPricingColumnCount === "3" &&
      providerStoreSearchTableCount === "1" &&
      providerProductPricingTableCount === "1" &&
      ingredientAliasesTableCount === "1" &&
      recipeEligibilityColumnCount === "1" &&
      snapRetailerTableCount === "1" &&
      providerSearchTermsTableCount === "1"
    );
  } catch {
    return false;
  }
}

async function resetTargetDatabase() {
  if (isExternalPostgresMode()) {
    if (activeDatabaseName === "yum4less_dev") {
      throw new Error(
        "External Postgres mode refuses destructive reset of yum4less_dev. " +
          "Apply migrations with `npm run db:migrate` (or fix schema ops manually). " +
          "Do not set YUM4LESS_ALLOW_DB_RESET / YUM4LESS_TEST_DB_RESET on the homelab ingest container.",
      );
    }

    console.log(
      `Recreating Postgres database ${activeDatabaseName} over TCP (external mode)...`,
    );
    dropDatabaseIfExists(activeDatabaseName);
    createDatabase(activeDatabaseName);
    applyAllInitSqlFiles(activeDatabaseName);
    return;
  }

  if (activeDatabaseName === "yum4less_dev") {
    console.log("Resetting Yum4Less test database volume...");
    runNpmScript("db:reset");
    await waitForHealthyContainer();
    return;
  }

  console.log(`Recreating Postgres database ${activeDatabaseName}...`);
  dropDatabaseIfExists(activeDatabaseName);
  createDatabase(activeDatabaseName);
  applyAllInitSqlFiles(activeDatabaseName);
}

async function resetDatabaseVolume() {
  await resetTargetDatabase();
}

export async function ensureTestDatabase() {
  if (!process.env.DATABASE_URL) {
    process.env.DATABASE_URL = DEFAULT_DATABASE_URL;
  }

  activeDatabaseName = resolveTargetDatabaseName();
  const externalMode = isExternalPostgresMode();

  if (!externalMode && !dockerAvailable()) {
    throw new Error(
      "Docker is not available. Start Docker Desktop, then rerun this command. " +
        "For ingest containers that only have TCP to Postgres, set YUM4LESS_EXTERNAL_POSTGRES=1. " +
        "Use `npm test` only for the non-DB suite.",
    );
  }

  if (process.env.YUM4LESS_TEST_DB_RESET === "1") {
    await resetDatabaseVolume();
    applySchemaMigrations(activeDatabaseName);
    applyCiBootstrapStoresIfNeeded();
    return;
  }

  if (externalMode) {
    console.log(
      `External Postgres mode — connecting over TCP (DB ${activeDatabaseName}; no Docker socket).`,
    );
    await waitForExternalPostgres();
  } else {
    const health = containerHealthStatus();
    if (health !== "healthy") {
      console.log(`Starting Yum4Less Postgres container (previous status: ${health})...`);
      runNpmScript("db:up");
      await waitForHealthyContainer();
    }
  }

  ensureTargetDatabaseExists();

  applySchemaMigrations(activeDatabaseName);
  applyCiBootstrapStoresIfNeeded();

  if (!seedMatchesCurrentMvp()) {
    if (!canResetDatabaseAutomatically()) {
      throw new Error(
        externalMode
          ? "External Postgres seed/schema looks stale (missing expected tables from db/init). " +
              "Reconcile with `npm run db:migrate` from a host/Node path or a one-shot ingest container; " +
              "do not auto-reset the shared homelab volume."
          : "Local Postgres seed looks stale (missing expected schema, recipe catalog, or provider cache tables from db/init). Start Docker Desktop if needed, then run `npm run db:reset` only after confirming you are okay recreating the local dev database volume.",
      );
    }

    console.log(
      "Local Postgres seed looks stale (missing expected schema or recipe catalog). Recreating volume...",
    );
    await resetDatabaseVolume();
  }

  // Always re-apply after init/migrations/reset. Weekly-ad fixture ingest and integration
  // tests FK to bootstrap store ids (e.g. kroger-mechanicsville); a stale-seed reset
  // only reapplies db/init and would otherwise leave pins missing.
  applyCiBootstrapStoresIfNeeded();

  const snapEnsure = spawnNodeScript("scripts/ensure-snap-context.mjs", ["--quiet"], {
    env: process.env,
  });

  if (snapEnsure.status !== 0) {
    console.warn(
      "SNAP auto-ensure failed (non-fatal). Set YUM4LESS_SNAP_AUTO_ENSURE=0 to skip or run npm run ensure:snap-context manually.",
    );
  }
}

const invokedDirectly =
  process.argv[1] &&
  import.meta.url.endsWith(process.argv[1].replaceAll("\\", "/"));

if (invokedDirectly) {
  ensureTestDatabase().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
