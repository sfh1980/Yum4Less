import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const LEDGER_TABLE = "schema_migrations";
const INIT_DIR = join(process.cwd(), "db", "init");

export function parseMigrationVersion(fileName) {
  const match = fileName.match(/^(\d{3})_/);
  if (!match) {
    throw new Error(`Migration filename must start with NNN_: ${fileName}`);
  }
  return match[1];
}

export function listInitMigrationFiles(initDir = INIT_DIR) {
  return readdirSync(initDir)
    .filter((fileName) => fileName.endsWith(".sql"))
    .sort();
}

export function computeMigrationChecksum(filePathOrContent, { isPath = true } = {}) {
  const content = isPath ? readFileSync(filePathOrContent, "utf8") : filePathOrContent;
  return createHash("sha256").update(content, "utf8").digest("hex");
}

function escapeSqlLiteral(value) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

export function buildLedgerInsertSql(version, fileName, checksum) {
  return `insert into schema_migrations (version, filename, checksum)
values (${escapeSqlLiteral(version)}, ${escapeSqlLiteral(fileName)}, ${escapeSqlLiteral(checksum)})
on conflict (version) do nothing;`;
}

export function readAppliedMigrations(db) {
  if (!db.tableExists(LEDGER_TABLE)) {
    return new Map();
  }

  const rows = db.queryRows(
    "select version, filename, checksum, applied_at from schema_migrations order by version;",
  );
  return new Map(rows.map((row) => [row.version, row]));
}

function isCiStrictChecksum() {
  const ci = process.env.CI?.trim().toLowerCase();
  return ci === "true" || ci === "1" || process.env.GITHUB_ACTIONS === "true";
}

function verifyStoredChecksum(version, storedChecksum, filePath, db) {
  const currentChecksum = computeMigrationChecksum(filePath);
  if (storedChecksum === currentChecksum) {
    return;
  }

  const message = `Migration ${version} checksum mismatch: ledger has ${storedChecksum}, disk has ${currentChecksum}.`;
  if (isCiStrictChecksum() || process.env.YUM4LESS_STRICT_MIGRATION_CHECKSUM === "1") {
    throw new Error(message);
  }

  console.warn(`Warning: ${message}`);
}

function ensureLedgerTable(db, initDir) {
  if (db.tableExists(LEDGER_TABLE)) {
    return false;
  }

  const ledgerFile = "000_schema_migrations.sql";
  const ledgerPath = join(initDir, ledgerFile);
  console.log(`Applying db/init/${ledgerFile} to ${db.databaseName}...`);
  db.applySqlFile(ledgerFile, readFileSync(ledgerPath, "utf8"));
  return true;
}

function recordMigration(db, version, fileName, checksum, mode) {
  db.applySqlContent(buildLedgerInsertSql(version, fileName, checksum));
  if (mode === "backfill") {
    return { kind: "backfilled", version };
  }
  return { kind: "applied", version };
}

export function migrationEffectPresent(version, db) {
  switch (version) {
    case "000":
      return db.tableExists(LEDGER_TABLE);
    case "001":
      return db.tableExists("recipes");
    case "002":
      return Number(db.queryScalar("select count(*) from recipes where source_name = 'yum4less-internal-catalog';")) >= 3;
    case "003":
      return db.tableExists("provider_store_search_snapshots");
    case "004":
      return db.tableExists("provider_product_pricing_snapshots");
    case "005":
      return (
        Number(
          db.queryScalar(
            "select count(*) from information_schema.columns where table_name = 'price_observations' and column_name in ('last_verified_at', 'source_kind', 'valid_through');",
          ),
        ) === 3
      );
    case "006":
      return db.tableExists("analytics_events");
    case "007":
      return db.tableExists("customer_feedback");
    case "008":
      return Number(db.queryScalar("select count(*) from ingredients where id = 'cumin';")) >= 1;
    case "009":
      return (
        db.tableExists("ingredient_aliases") &&
        db.columnExists("recipes", "eligible_for_ranking")
      );
    case "010":
      return db.tableExists("snap_retailer_locations");
    case "011":
      return db.tableExists("provider_search_terms");
    case "012":
      return db.columnExists("provider_search_terms", "notes");
    case "013":
      return (
        db.tableExists("provider_search_terms") &&
        Number(db.queryScalar("select count(*) from provider_search_terms where provider = 'kroger';")) >= 101
      );
    case "015":
      return (
        db.tableExists("stores") &&
        Number(db.queryScalar("select count(*) from stores where id = 'publix-atlee';")) === 0
      );
    case "016":
      return db.tableExists("stores") && Number(countPublixOsmLocatorPairsWithin015Mi(db)) === 0;
    case "017":
      return (
        !db.tableExists("stores") ||
        Number(db.queryScalar("select count(*) from stores where id = 'osm-node-900007';")) === 0
      );
    case "018":
      return Number(countSyntheticOsmFixtureBand(db)) === 0;
    case "019":
      return (
        !db.tableExists("stores") ||
        Number(db.queryScalar("select count(*) from stores where id = 'aldi-23111';")) === 0
      );
    case "020":
      return (
        db.tableExists("provider_search_terms") &&
        Number(countKrogerP2GapTerms(db)) >= 6
      );
    case "021":
      return (
        db.tableExists("store_identities") &&
        db.tableExists("store_identity_aliases")
      );
    default:
      return false;
  }
}

function countKrogerP2GapTerms(db) {
  return db.queryScalar(
    `select count(*) from provider_search_terms
     where provider = 'kroger'
       and priority = 2
       and ingredient_id in (
         'chickpeas',
         'dried-oregano',
         'cornstarch',
         'jalapeno',
         'shredded-cheese-blend',
         'bread-loaf'
       )`,
  );
}

function countSyntheticOsmFixtureBand(db) {
  if (!db.tableExists("stores")) {
    return 0;
  }

  return db.queryScalar(
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
}

function countPublixOsmLocatorPairsWithin015Mi(db) {
  return db.queryScalar(
    `with locator_stores as (
       select id, latitude, longitude
       from stores
       where source_name = 'publix-store-locator'
     ),
     osm_duplicates as (
       select
         osm.id as osm_store_id,
         locator.id as locator_store_id,
         (
           3958.8 * acos(
             least(
               1.0,
               greatest(
                 -1.0,
                 cos(radians(osm.latitude)) * cos(radians(locator.latitude))
                   * cos(radians(locator.longitude) - radians(osm.longitude))
                   + sin(radians(osm.latitude)) * sin(radians(locator.latitude))
               )
             )
           )
         ) as distance_miles
       from stores osm
       cross join locator_stores locator
       where osm.id like 'osm-%'
         and lower(osm.name) like '%publix%'
     )
     select count(*)
     from (
       select distinct on (osm_store_id)
         osm_store_id,
         locator_store_id
       from osm_duplicates
       where distance_miles <= 0.15
       order by osm_store_id, distance_miles
     ) pairs`,
  );
}

export function applyPendingMigrations(db, options = {}) {
  const initDir = options.initDir ?? INIT_DIR;
  const files = listInitMigrationFiles(initDir);
  const ledgerBootstrapped = ensureLedgerTable(db, initDir);
  const appliedLedger = readAppliedMigrations(db);

  const summary = {
    ledgerBootstrapped,
    skipped: [],
    backfilled: [],
    applied: [],
  };

  for (const fileName of files) {
    const version = parseMigrationVersion(fileName);
    const filePath = join(initDir, fileName);
    const checksum = computeMigrationChecksum(filePath);
    const existing = appliedLedger.get(version);

    if (existing) {
      verifyStoredChecksum(version, existing.checksum, filePath, db);
      summary.skipped.push(version);
      continue;
    }

    if (migrationEffectPresent(version, db)) {
      const result = recordMigration(db, version, fileName, checksum, "backfill");
      summary.backfilled.push(result.version);
      appliedLedger.set(version, { version, filename: fileName, checksum });
      continue;
    }

    console.log(`Applying db/init/${fileName} to ${db.databaseName}...`);
    db.applySqlFile(fileName, readFileSync(filePath, "utf8"));
    const result = recordMigration(db, version, fileName, checksum, "apply");
    summary.applied.push(result.version);
    appliedLedger.set(version, { version, filename: fileName, checksum });
  }

  return summary;
}

export function assertNoResidualCollocatedCatalogTwins(db) {
  if (!db.tableExists("stores")) {
    return;
  }

  const collocatedCatalogTwins = db.queryScalar(
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

export function createPostgresMigrationDb(databaseName, helpers) {
  return {
    databaseName,
    tableExists: (tableName) => helpers.tableExists(tableName, databaseName),
    columnExists: (tableName, columnName) =>
      helpers.columnExists(tableName, columnName, databaseName),
    queryScalar: (sql) => helpers.psqlQueryScalar(databaseName, sql),
    queryRows: (sql) => helpers.psqlQueryRows(databaseName, sql),
    applySqlContent: (sql) => helpers.psqlApplySqlContent(databaseName, sql),
    applySqlFile: (_fileName, sql) => helpers.psqlApplySqlContent(databaseName, sql),
  };
}
