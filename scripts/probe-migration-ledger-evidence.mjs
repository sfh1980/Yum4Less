import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import {
  applyPendingMigrations,
  createPostgresMigrationDb,
  listInitMigrationFiles,
} from "./lib/apply-migrations.mjs";
import {
  columnExists,
  containerHealthStatus,
  createDatabase,
  dockerAvailable,
  dropDatabaseIfExists,
  psqlApplySqlContent,
  psqlQueryRows,
  psqlQueryScalar,
  runNpmScript,
  tableExists,
} from "./lib/spawn-safe.mjs";

const PARTIAL_DB = "yum4less_mig_sim_partial";
const FRESH_DB = "yum4less_mig_sim_fresh";

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForHealthyContainer() {
  for (let attempt = 1; attempt <= 30; attempt += 1) {
    if (containerHealthStatus() === "healthy") {
      return;
    }
    await sleep(2000);
  }
  throw new Error("Postgres container did not become healthy.");
}

function migrationDb(databaseName) {
  return createPostgresMigrationDb(databaseName, {
    tableExists,
    columnExists,
    psqlQueryScalar,
    psqlQueryRows,
    psqlApplySqlContent,
  });
}

function readLedger(databaseName) {
  if (!tableExists("schema_migrations", databaseName)) {
    return [];
  }
  return psqlQueryRows(
    databaseName,
    "select version, filename, checksum, applied_at::text from schema_migrations order by version;",
  );
}

function applyInitFilesUpTo(databaseName, lastVersionInclusive) {
  const files = listInitMigrationFiles().filter((fileName) => {
    const version = fileName.slice(0, 3);
    return version >= "001" && version <= lastVersionInclusive && fileName.endsWith(".sql");
  });

  for (const fileName of files) {
    if (fileName.startsWith("000_")) {
      continue;
    }
    const sql = readFileSync(join(process.cwd(), "db", "init", fileName), "utf8");
    psqlApplySqlContent(databaseName, sql);
  }
}

function simulateDockerFirstBoot(databaseName) {
  const initDir = join(process.cwd(), "db", "init");
  const files = readdirSync(initDir)
    .filter((fileName) => fileName.endsWith(".sql"))
    .sort();

  for (const fileName of files) {
    const sql = readFileSync(join(initDir, fileName), "utf8");
    psqlApplySqlContent(databaseName, sql);
  }
}

function recreateDatabase(databaseName) {
  dropDatabaseIfExists(databaseName);
  createDatabase(databaseName);
}

async function runPartialVolumeScenario() {
  recreateDatabase(PARTIAL_DB);
  applyInitFilesUpTo(PARTIAL_DB, "013");

  psqlApplySqlContent(
    PARTIAL_DB,
    `insert into stores (id, name, kind, city, state, latitude, longitude, source_name)
     values ('publix-atlee', 'Publix', 'grocery', 'Mechanicsville', 'VA', 37.66, -77.36, 'yum4less-internal-catalog')
     on conflict (id) do nothing;`,
  );

  const beforeLedger = readLedger(PARTIAL_DB);
  const beforeAtlee = psqlQueryScalar(
    PARTIAL_DB,
    "select count(*) from stores where id = 'publix-atlee';",
  );

  const summary = applyPendingMigrations(migrationDb(PARTIAL_DB));

  const afterLedger = readLedger(PARTIAL_DB);
  const afterAtlee = psqlQueryScalar(
    PARTIAL_DB,
    "select count(*) from stores where id = 'publix-atlee';",
  );
  const after1626 = psqlQueryScalar(
    PARTIAL_DB,
    "select count(*) from stores where id = 'publix-1626';",
  );

  return {
    scenario: "partial-volume-backfill",
    database: PARTIAL_DB,
    before: {
      ledgerRowCount: beforeLedger.length,
      ledger: beforeLedger,
      publixAtleeCount: beforeAtlee,
    },
    migrationSummary: summary,
    after: {
      ledgerRowCount: afterLedger.length,
      ledger: afterLedger,
      publixAtleeCount: afterAtlee,
      publix1626Count: after1626,
    },
  };
}

async function runFreshVolumeScenario() {
  recreateDatabase(FRESH_DB);
  simulateDockerFirstBoot(FRESH_DB);

  const ledgerAfterDocker = readLedger(FRESH_DB);
  const krogerTermsBefore = psqlQueryScalar(
    FRESH_DB,
    "select count(*) from provider_search_terms where provider = 'kroger';",
  );

  const summary = applyPendingMigrations(migrationDb(FRESH_DB));

  const ledgerAfterEnsure = readLedger(FRESH_DB);
  const krogerTermsAfter = psqlQueryScalar(
    FRESH_DB,
    "select count(*) from provider_search_terms where provider = 'kroger';",
  );

  return {
    scenario: "fresh-docker-init-then-ledger-backfill",
    database: FRESH_DB,
    afterDockerInit: {
      ledgerRowCount: ledgerAfterDocker.length,
      krogerTermCount: krogerTermsBefore,
    },
    migrationSummary: summary,
    afterLedgerBackfill: {
      ledgerRowCount: ledgerAfterEnsure.length,
      ledger: ledgerAfterEnsure,
      krogerTermCount: krogerTermsAfter,
    },
  };
}

async function main() {
  if (!dockerAvailable()) {
    throw new Error("Docker is required for migration ledger evidence probes.");
  }

  if (containerHealthStatus() !== "healthy") {
    runNpmScript("db:up");
    await waitForHealthyContainer();
  }

  const partial = await runPartialVolumeScenario();
  const fresh = await runFreshVolumeScenario();

  console.log(JSON.stringify({ partial, fresh }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
