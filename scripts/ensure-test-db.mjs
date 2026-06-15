import { execSync, spawnSync } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const CONTAINER_NAME = "yum4less-postgres";
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
    return name || "yum4less_dev";
  } catch {
    return "yum4less_dev";
  }
}

function psqlCommand(databaseName = activeDatabaseName) {
  return `docker exec ${CONTAINER_NAME} psql -U postgres -d ${databaseName}`;
}

function run(command) {
  execSync(command, { stdio: "inherit", shell: true });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function dockerAvailable() {
  try {
    execSync("docker info", { stdio: "ignore", shell: true });
    return true;
  } catch {
    return false;
  }
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

function containerHealthStatus() {
  try {
    return execSync(
      `docker inspect --format="{{.State.Health.Status}}" ${CONTAINER_NAME}`,
      { encoding: "utf8", shell: true },
    ).trim();
  } catch {
    return "missing";
  }
}

async function waitForHealthyContainer() {
  for (let attempt = 1; attempt <= MAX_HEALTH_ATTEMPTS; attempt += 1) {
    const status = containerHealthStatus();
    if (status === "healthy") {
      return;
    }

    if (attempt === MAX_HEALTH_ATTEMPTS) {
      throw new Error(
        `Timed out waiting for ${CONTAINER_NAME} to become healthy (last status: ${status}).`,
      );
    }

    await sleep(HEALTH_POLL_MS);
  }
}

function tableExists(tableName, databaseName = activeDatabaseName) {
  try {
    const count = execSync(
      `${psqlCommand(databaseName)} -tAc "select count(*) from information_schema.tables where table_schema = 'public' and table_name = '${tableName}';"`,
      { encoding: "utf8", shell: true },
    ).trim();
    return count === "1";
  } catch {
    return false;
  }
}

function columnExists(tableName, columnName, databaseName = activeDatabaseName) {
  try {
    const count = execSync(
      `${psqlCommand(databaseName)} -tAc "select count(*) from information_schema.columns where table_schema = 'public' and table_name = '${tableName}' and column_name = '${columnName}';"`,
      { encoding: "utf8", shell: true },
    ).trim();
    return count === "1";
  } catch {
    return false;
  }
}

function applyInitSqlFile(fileName, databaseName = activeDatabaseName) {
  const sqlPath = join(process.cwd(), "db", "init", fileName);
  const sql = readFileSync(sqlPath, "utf8");
  execSync(`docker exec -i ${CONTAINER_NAME} psql -U postgres -d ${databaseName}`, {
    input: sql,
    stdio: ["pipe", "inherit", "inherit"],
    shell: true,
  });
}

function databaseExists(databaseName) {
  try {
    const count = execSync(
      `docker exec ${CONTAINER_NAME} psql -U postgres -tAc "select count(*) from pg_database where datname = '${databaseName}';"`,
      { encoding: "utf8", shell: true },
    ).trim();
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
  execSync(
    `docker exec ${CONTAINER_NAME} psql -U postgres -c "CREATE DATABASE ${activeDatabaseName};"`,
    { stdio: "inherit", shell: true },
  );
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
    const krogerTermCount = execSync(
      `${psqlCommand()} -tAc "select count(*) from provider_search_terms where provider = 'kroger';"`,
      { encoding: "utf8", shell: true },
    ).trim();
    if (Number(krogerTermCount) < 101) {
      console.log("Applying db/init/013_kroger_search_terms_full.sql to local Postgres...");
      applyInitSqlFile("013_kroger_search_terms_full.sql");
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
    const storeCount = Number(
      execSync(
        `${psqlCommand()} -tAc "select count(*) from stores;"`,
        { encoding: "utf8", shell: true },
      ).trim(),
    );

    if (storeCount >= 8) {
      return;
    }

    console.log(
      "Applying db/ci/014_ci_bootstrap_stores.sql for CI/integration bootstrap pins...",
    );
    const sqlPath = join(process.cwd(), "db", "ci", "014_ci_bootstrap_stores.sql");
    const sql = readFileSync(sqlPath, "utf8");
    execSync(`docker exec -i ${CONTAINER_NAME} psql -U postgres -d ${activeDatabaseName}`, {
      input: sql,
      stdio: ["pipe", "inherit", "inherit"],
      shell: true,
    });
  } catch (error) {
    console.warn(
      "CI bootstrap store seed skipped or failed:",
      error instanceof Error ? error.message : error,
    );
  }
}

function seedMatchesCurrentMvp() {
  try {
    const catalogStoreCount = execSync(
      `${psqlCommand()} -tAc "select count(*) from stores;"`,
      { encoding: "utf8", shell: true },
    ).trim();
    const mockPriceCount = execSync(
      `${psqlCommand()} -tAc "select count(*) from price_observations where source_name = 'mock-market-data';"`,
      { encoding: "utf8", shell: true },
    ).trim();
    const recipeCount = execSync(
      `${psqlCommand()} -tAc "select count(*) from recipes where source_name = 'yum4less-internal-catalog';"`,
      { encoding: "utf8", shell: true },
    ).trim();
    const dynamicPricingColumnCount = execSync(
      `${psqlCommand()} -tAc "select count(*) from information_schema.columns where table_name = 'price_observations' and column_name in ('last_verified_at', 'source_kind', 'valid_through');"`,
      { encoding: "utf8", shell: true },
    ).trim();
    const providerStoreSearchTableCount = execSync(
      `${psqlCommand()} -tAc "select count(*) from information_schema.tables where table_schema = 'public' and table_name = 'provider_store_search_snapshots';"`,
      { encoding: "utf8", shell: true },
    ).trim();
    const providerProductPricingTableCount = execSync(
      `${psqlCommand()} -tAc "select count(*) from information_schema.tables where table_schema = 'public' and table_name = 'provider_product_pricing_snapshots';"`,
      { encoding: "utf8", shell: true },
    ).trim();
    const ingredientAliasesTableCount = execSync(
      `${psqlCommand()} -tAc "select count(*) from information_schema.tables where table_schema = 'public' and table_name = 'ingredient_aliases';"`,
      { encoding: "utf8", shell: true },
    ).trim();
    const recipeEligibilityColumnCount = execSync(
      `${psqlCommand()} -tAc "select count(*) from information_schema.columns where table_name = 'recipes' and column_name = 'eligible_for_ranking';"`,
      { encoding: "utf8", shell: true },
    ).trim();
    const snapRetailerTableCount = execSync(
      `${psqlCommand()} -tAc "select count(*) from information_schema.tables where table_schema = 'public' and table_name = 'snap_retailer_locations';"`,
      { encoding: "utf8", shell: true },
    ).trim();
    const providerSearchTermsTableCount = execSync(
      `${psqlCommand()} -tAc "select count(*) from information_schema.tables where table_schema = 'public' and table_name = 'provider_search_terms';"`,
      { encoding: "utf8", shell: true },
    ).trim();

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
    run("npm run db:reset");
    await waitForHealthyContainer();
    return;
  }

  console.log(`Recreating Postgres database ${activeDatabaseName}...`);
  execSync(
    `docker exec ${CONTAINER_NAME} psql -U postgres -c "DROP DATABASE IF EXISTS ${activeDatabaseName};"`,
    { stdio: "inherit", shell: true },
  );
  execSync(
    `docker exec ${CONTAINER_NAME} psql -U postgres -c "CREATE DATABASE ${activeDatabaseName};"`,
    { stdio: "inherit", shell: true },
  );
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
    return;
  }

  const health = containerHealthStatus();
  if (health !== "healthy") {
    console.log(`Starting Yum4Less Postgres container (previous status: ${health})...`);
    run("npm run db:up");
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

  const snapEnsure = spawnSync("node scripts/ensure-snap-context.mjs --quiet", {
    stdio: "inherit",
    shell: true,
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
