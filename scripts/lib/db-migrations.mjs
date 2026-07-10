import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  applyPendingMigrations,
  assertNoResidualCollocatedCatalogTwins,
  createPostgresMigrationDb,
} from "./apply-migrations.mjs";
import {
  columnExists,
  psqlApplySqlContent,
  psqlQueryRows,
  psqlQueryScalar,
  tableExists,
} from "./spawn-safe.mjs";

function createMigrationDb(databaseName) {
  return createPostgresMigrationDb(databaseName, {
    tableExists,
    columnExists,
    psqlQueryScalar,
    psqlQueryRows,
    psqlApplySqlContent,
  });
}

function applyInitSqlFile(fileName, databaseName) {
  const sqlPath = join(process.cwd(), "db", "init", fileName);
  const sql = readFileSync(sqlPath, "utf8");
  psqlApplySqlContent(databaseName, sql);
}

export function applyAllInitSqlFiles(databaseName) {
  return applyPendingMigrations(createMigrationDb(databaseName));
}

export function applySchemaMigrations(databaseName) {
  const summary = applyPendingMigrations(createMigrationDb(databaseName));
  assertNoResidualCollocatedCatalogTwins(createMigrationDb(databaseName));
  return summary;
}

export { applyInitSqlFile };
