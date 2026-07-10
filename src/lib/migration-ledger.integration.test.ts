/// <reference path="./test-only/scripts-migrations.d.ts" />
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  applyPendingMigrations,
  createPostgresMigrationDb,
  listInitMigrationFiles,
} from "@scripts-lib/apply-migrations";
import {
  columnExists,
  createDatabase,
  dropDatabaseIfExists,
  psqlApplySqlContent,
  psqlQueryRows,
  psqlQueryScalar,
  tableExists,
} from "@scripts-lib/spawn-safe";

const TEST_DB = "yum4less_migration_itest";

function migrationDb(databaseName = TEST_DB) {
  return createPostgresMigrationDb(databaseName, {
    tableExists,
    columnExists,
    psqlQueryScalar,
    psqlQueryRows,
    psqlApplySqlContent,
  });
}

function recreateTestDatabase() {
  dropDatabaseIfExists(TEST_DB);
  createDatabase(TEST_DB);
}

function readLedger(databaseName = TEST_DB) {
  if (!tableExists("schema_migrations", databaseName)) {
    return [];
  }
  return psqlQueryRows(
    databaseName,
    "select version, filename, checksum, applied_at::text from schema_migrations order by version;",
  );
}

describe("migration ledger integration", () => {
  it(
    "applies missing 015/016 on a partially migrated legacy volume",
    () => {
    recreateTestDatabase();

    for (const fileName of listInitMigrationFiles()) {
      const version = fileName.slice(0, 3);
      if (version < "001" || version > "013") {
        continue;
      }
      const sql = readFileSync(join(process.cwd(), "db", "init", fileName), "utf8");
      psqlApplySqlContent(TEST_DB, sql);
    }

    psqlApplySqlContent(
      TEST_DB,
      `insert into stores (id, name, kind, city, state, latitude, longitude, source_name)
       values ('publix-atlee', 'Publix', 'grocery', 'Mechanicsville', 'VA', 37.66, -77.36, 'yum4less-internal-catalog');`,
    );

    expect(readLedger()).toHaveLength(0);

    const summary = applyPendingMigrations(migrationDb());

    expect(summary.applied).toContain("015");
    expect(readLedger().map((row) => String(row.version))).toContain("015");
    expect(readLedger().map((row) => String(row.version))).toContain("016");
    expect(psqlQueryScalar(TEST_DB, "select count(*) from stores where id = 'publix-atlee';")).toBe("0");
    expect(psqlQueryScalar(TEST_DB, "select count(*) from stores where id = 'publix-1626';")).toBe("1");
    },
    60_000,
  );

  it(
    "backfills ledger rows without re-applying SQL after docker-style init",
    () => {
    recreateTestDatabase();

    for (const fileName of listInitMigrationFiles()) {
      const sql = readFileSync(join(process.cwd(), "db", "init", fileName), "utf8");
      psqlApplySqlContent(TEST_DB, sql);
    }

    const krogerBefore = psqlQueryScalar(
      TEST_DB,
      "select count(*) from provider_search_terms where provider = 'kroger';",
    );

    expect(readLedger()).toHaveLength(0);

    const summary = applyPendingMigrations(migrationDb());
    const krogerAfter = psqlQueryScalar(
      TEST_DB,
      "select count(*) from provider_search_terms where provider = 'kroger';",
    );

    expect(summary.applied).toEqual([]);
    expect(summary.backfilled.length).toBe(listInitMigrationFiles().length);
    expect(readLedger()).toHaveLength(listInitMigrationFiles().length);
    expect(krogerAfter).toBe(krogerBefore);
    },
    120_000,
  );
});
