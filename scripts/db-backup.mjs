#!/usr/bin/env node
/**
 * Dump a Yum4Less Postgres database from the compose container.
 *
 * Usage:
 *   node scripts/db-backup.mjs
 *   node scripts/db-backup.mjs --database=yum4less_dev
 *   node scripts/db-backup.mjs --database=yum4less_test --dir=./backups
 */

import { loadEnvLocal } from "./lib/load-env-local.mjs";
import {
  dumpDatabaseToFile,
  readIntegritySnapshot,
} from "./lib/db-backup-restore.mjs";

loadEnvLocal();

function parseArgs(argv) {
  let databaseName = "yum4less_dev";
  let backupDir;
  for (const arg of argv) {
    if (arg.startsWith("--database=")) {
      databaseName = arg.slice("--database=".length).trim();
    } else if (arg.startsWith("--dir=")) {
      backupDir = arg.slice("--dir=".length).trim();
    } else if (arg === "--help" || arg === "-h") {
      console.log(`Usage: node scripts/db-backup.mjs [--database=yum4less_dev] [--dir=./backups]`);
      process.exit(0);
    } else {
      console.error(`Unknown argument: ${arg}`);
      process.exit(1);
    }
  }
  return { databaseName, backupDir };
}

function main() {
  const { databaseName, backupDir } = parseArgs(process.argv.slice(2));
  const snapshot = readIntegritySnapshot(databaseName);
  const outPath = dumpDatabaseToFile(databaseName, { backupDir });
  console.log(`[backup] OK ${databaseName} → ${outPath}`);
  console.log(
    `[backup] snapshot stores=${snapshot.stores} price_observations=${snapshot.priceObservations} schema_migrations=${snapshot.schemaMigrations}`,
  );
}

try {
  main();
} catch (error) {
  console.error(`[backup] FAIL ${error instanceof Error ? error.message : error}`);
  process.exit(1);
}
