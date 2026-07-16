#!/usr/bin/env node
/**
 * Restore a SQL dump into a target database (destructive for the target name).
 *
 * Usage:
 *   node scripts/db-restore.mjs --file=./backups/yum4less_dev_....sql --database=yum4less_restore_scratch
 *   node scripts/db-restore.mjs --file=... --database=yum4less_dev --i-understand-destructively-restore-dev
 */

import { loadEnvLocal } from "./lib/load-env-local.mjs";
import {
  restoreDatabaseFromFile,
  readIntegritySnapshot,
} from "./lib/db-backup-restore.mjs";

loadEnvLocal();

function parseArgs(argv) {
  let databaseName;
  let dumpPath;
  let allowProtectedRestore = false;
  for (const arg of argv) {
    if (arg.startsWith("--database=")) {
      databaseName = arg.slice("--database=".length).trim();
    } else if (arg.startsWith("--file=")) {
      dumpPath = arg.slice("--file=".length).trim();
    } else if (arg === "--i-understand-destructively-restore-dev") {
      allowProtectedRestore = true;
    } else if (arg === "--help" || arg === "-h") {
      console.log(
        "Usage: node scripts/db-restore.mjs --file=<dump.sql> --database=<target> [--i-understand-destructively-restore-dev]",
      );
      process.exit(0);
    } else {
      console.error(`Unknown argument: ${arg}`);
      process.exit(1);
    }
  }

  if (!databaseName || !dumpPath) {
    console.error("Required: --file=... and --database=...");
    process.exit(1);
  }

  return { databaseName, dumpPath, allowProtectedRestore };
}

function main() {
  const { databaseName, dumpPath, allowProtectedRestore } = parseArgs(
    process.argv.slice(2),
  );
  restoreDatabaseFromFile(databaseName, dumpPath, { allowProtectedRestore });
  const snapshot = readIntegritySnapshot(databaseName);
  console.log(`[restore] OK → ${databaseName}`);
  console.log(
    `[restore] snapshot stores=${snapshot.stores} price_observations=${snapshot.priceObservations} schema_migrations=${snapshot.schemaMigrations}`,
  );
}

try {
  main();
} catch (error) {
  console.error(`[restore] FAIL ${error instanceof Error ? error.message : error}`);
  process.exit(1);
}
