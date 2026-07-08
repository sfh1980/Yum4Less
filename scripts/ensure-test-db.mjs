import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import {
  assertSafeSqlIdentifier,
  containerHealthStatus,
  createDatabase,
  dockerAvailable,
  dropDatabaseIfExists,
  psqlApplySqlContent,
  psqlQueryScalar,
  runNpmScript,
  spawnNodeScript,
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

function tableExists(tableName, databaseName = activeDatabaseName) {
  assertSafeSqlIdentifier(tableName, "table name");
  try {
    const count = psqlQueryScalar(
      databaseName,
      `select count(*) from information_schema.tables where table_schema = 'public' and table_name = '${tableName}';`,
    );
    return count === "1";
  } catch {
    return false;
  }
}

function columnExists(tableName, columnName, databaseName = activeDatabaseName) {
  assertSafeSqlIdentifier(tableName, "table name");
  assertSafeSqlIdentifier(columnName, "column name");
  try {
    const count = psqlQueryScalar(
      databaseName,
      `select count(*) from information_schema.columns where table_schema = 'public' and table_name = '${tableName}' and column_name = '${columnName}';`,
    );
    return count === "1";
  } catch {
    return false;
  }
}

function applyInitSqlFile(fileName, databaseName = activeDatabaseName) {
  const sqlPath = join(process.cwd(), "db", "init", fileName);
  const sql = readFileSync(sqlPath, "utf8");
  psqlApplySqlContent(databaseName, sql);
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

function applyAllInitSqlFiles(databaseName = activeDatabaseName) {
  const initDir = join(process.cwd(), "db", "init");
  const files = readdirSync(initDir)
    .filter((fileName) => fileName.endsWith(".sql"))
    .sort();

  for (const fileName of files) {
    console.log(`Applying db/init/${fileName} to ${databaseName}...`);
    applyInitSqlFile(fileName, databaseName);
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

function applyPhaseCMigrationsIfMissing() {
  if (!tableExists("snap_retailer_locations")) {
    console.log("Applying db/init/010_snap_retailer_locations.sql to local Postgres...");
    applyInitSqlFile("010_snap_retailer_locations.sql");
  }

  if (!tableExists("provider_search_terms")) {
    console.log("Applying db/init/011_provider_search_terms.sql to local Postgres...");
    applyInitSqlFile("011_provider_search_terms.sql");
  }

  if (!columnExists("provider_search_terms", "notes")) {
    console.log("Applying db/init/012_provider_search_terms_notes.sql to local Postgres...");
    applyInitSqlFile("012_provider_search_terms_notes.sql");
  }

  if (tableExists("provider_search_terms")) {
    const krogerTermCount = psqlQueryScalar(
      activeDatabaseName,
      "select count(*) from provider_search_terms where provider = 'kroger';",
    );
    if (Number(krogerTermCount) < 101) {
      console.log("Applying db/init/013_kroger_search_terms_full.sql to local Postgres...");
      applyInitSqlFile("013_kroger_search_terms_full.sql");
    }
  }

  // One-shot store retirements (idempotent) for volumes that already ran older init only.
  if (tableExists("stores")) {
    const fakeAldiFixturePin = psqlQueryScalar(
      activeDatabaseName,
      "select count(*) from stores where id = 'osm-node-900007'",
    );
    if (Number(fakeAldiFixturePin) > 0) {
      console.log(
        "Applying db/init/017_retire_fake_aldi_osm_fixture_pin.sql to local Postgres...",
      );
      applyInitSqlFile("017_retire_fake_aldi_osm_fixture_pin.sql");
    }

    const syntheticOsmFixtureBand = psqlQueryScalar(
      activeDatabaseName,
      `select count(*) from stores
       where id ~ '^osm-(node|way)-90000[0-9]+$'
          or id like 'fixture-osm-%'
          or source_name = 'yum4less-map-fixture'
          or (
            id ~ '^osm-(node|way)-[0-9]+$'
            and id !~ '^osm-(node|way)-90000[0-9]+$'
            and (source_name like '%-weekly-ad-scrape' or source_name is null)
          )`,
    );
    if (Number(syntheticOsmFixtureBand) > 0) {
      console.log(
        "Applying db/init/018_retire_synthetic_osm_fixture_pins.sql to local Postgres...",
      );
      applyInitSqlFile("018_retire_synthetic_osm_fixture_pins.sql");
    }

    const aldiZipCatalogTwin = psqlQueryScalar(
      activeDatabaseName,
      "select count(*) from stores where id = 'aldi-23111'",
    );
    if (Number(aldiZipCatalogTwin) > 0) {
      console.log(
        "Applying db/init/019_retire_aldi_zip_catalog_twin.sql to local Postgres...",
      );
      applyInitSqlFile("019_retire_aldi_zip_catalog_twin.sql");
    }

    // Residual probe: non-Kroger same-chain ranked/catalog twins closer than the
    // shared CATALOG_COLLOCATED_MERGE_MILES (0.05). Kroger is excluded because
    // slug↔API twins may remain as separate DB rows by design (Settings collapses
    // them at KROGER_COLLOCATED_MERGE_MILES=0.15; reconcile keeps distinct
    // source_store_id rows). Query is chain-prefix based — not Aldi-hardcoded.
    const collocatedCatalogTwins = psqlQueryScalar(
      activeDatabaseName,
      `
      with catalog as (
        select
          id,
          latitude::float8 as lat,
          longitude::float8 as lng,
          case
            when id like 'aldi-%' then 'aldi'
            when id like 'publix-%' then 'publix'
            when id like 'food-lion-%' then 'food-lion'
            when id like 'lidl-%' then 'lidl'
            else null
          end as chain
        from stores
        where id not like 'osm-%'
          and id not like 'fixture-osm-%'
          and id not like 'snap-%'
          and id not like 'kroger-%'
          and coalesce(source_name, '') not in (
            'openstreetmap-overpass',
            'yum4less-map-fixture',
            'usda-snap-retailer-locator'
          )
      ),
      pairs as (
        select a.id as left_id, b.id as right_id
        from catalog a
        join catalog b
          on a.chain is not null
         and a.chain = b.chain
         and a.id < b.id
         and (
           3959 * 2 * asin(sqrt(
             power(sin(radians(b.lat - a.lat) / 2), 2) +
             cos(radians(a.lat)) * cos(radians(b.lat)) *
             power(sin(radians(b.lng - a.lng) / 2), 2)
           ))
         ) < 0.05
      )
      select count(*) from pairs
      `,
    );
    if (Number(collocatedCatalogTwins) > 0) {
      throw new Error(
        `Residual same-chain collocated catalog twins within 0.05 mi after migrations: count=${collocatedCatalogTwins}. Apply/verify 019 and ingest prefer-colocate before tests.`,
      );
    }
  }
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

  if (!dockerAvailable()) {
    throw new Error(
      "Docker is not available. Start Docker Desktop, then rerun this command. Use `npm test` only for the non-DB suite.",
    );
  }

  if (process.env.YUM4LESS_TEST_DB_RESET === "1") {
    await resetDatabaseVolume();
    applyCiBootstrapStoresIfNeeded();
    return;
  }

  const health = containerHealthStatus();
  if (health !== "healthy") {
    console.log(`Starting Yum4Less Postgres container (previous status: ${health})...`);
    runNpmScript("db:up");
    await waitForHealthyContainer();
  }

  ensureTargetDatabaseExists();

  applyPhaseCMigrationsIfMissing();
  applyCiBootstrapStoresIfNeeded();

  if (!seedMatchesCurrentMvp()) {
    if (!canResetDatabaseAutomatically()) {
      throw new Error(
        "Local Postgres seed looks stale (missing expected schema, recipe catalog, or provider cache tables from db/init). Start Docker Desktop if needed, then run `npm run db:reset` only after confirming you are okay recreating the local dev database volume.",
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
