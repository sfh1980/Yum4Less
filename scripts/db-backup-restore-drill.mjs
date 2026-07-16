#!/usr/bin/env node
/**
 * Prove backup → restore round-trip without wiping yum4less_dev.
 *
 * Dumps the source DB (default yum4less_dev), restores into disposable
 * yum4less_backup_drill, asserts store / price_observation / schema_migration
 * counts match, then drops the drill database.
 *
 * Usage:
 *   npm run db:backup-restore-drill
 *   node scripts/db-backup-restore-drill.mjs --source=yum4less_test
 */

import { unlinkSync } from "node:fs";
import { loadEnvLocal } from "./lib/load-env-local.mjs";
import {
  dumpDatabaseToFile,
  restoreDatabaseFromFile,
  readIntegritySnapshot,
  assertSnapshotsMatch,
  resolveBackupDir,
} from "./lib/db-backup-restore.mjs";
import { dropDatabaseIfExists } from "./lib/spawn-safe.mjs";

loadEnvLocal();

const DRILL_DATABASE = "yum4less_backup_drill";

function parseArgs(argv) {
  let sourceDatabase = "yum4less_dev";
  let keepDump = false;
  for (const arg of argv) {
    if (arg.startsWith("--source=")) {
      sourceDatabase = arg.slice("--source=".length).trim();
    } else if (arg === "--keep-dump") {
      keepDump = true;
    } else if (arg === "--help" || arg === "-h") {
      console.log(
        "Usage: node scripts/db-backup-restore-drill.mjs [--source=yum4less_dev] [--keep-dump]",
      );
      process.exit(0);
    } else {
      console.error(`Unknown argument: ${arg}`);
      process.exit(1);
    }
  }
  return { sourceDatabase, keepDump };
}

function main() {
  const { sourceDatabase, keepDump } = parseArgs(process.argv.slice(2));

  if (sourceDatabase === DRILL_DATABASE) {
    throw new Error(`Source cannot be the drill database ${DRILL_DATABASE}`);
  }

  console.log(`[drill] source=${sourceDatabase} target=${DRILL_DATABASE}`);
  const before = readIntegritySnapshot(sourceDatabase);
  console.log(
    `[drill] source snapshot stores=${before.stores} price_observations=${before.priceObservations} schema_migrations=${before.schemaMigrations}`,
  );

  if (before.stores < 1 || before.schemaMigrations < 1) {
    throw new Error(
      `Source ${sourceDatabase} looks empty (stores=${before.stores}, schema_migrations=${before.schemaMigrations}). Run npm run db:up && npm run db:migrate (and ingest) before drilling.`,
    );
  }

  const backupDir = resolveBackupDir();
  const dumpPath = dumpDatabaseToFile(sourceDatabase, {
    backupDir,
    filename: `${DRILL_DATABASE}_roundtrip.sql`,
  });
  console.log(`[drill] dumped → ${dumpPath}`);

  restoreDatabaseFromFile(DRILL_DATABASE, dumpPath);
  const after = readIntegritySnapshot(DRILL_DATABASE);
  console.log(
    `[drill] restored snapshot stores=${after.stores} price_observations=${after.priceObservations} schema_migrations=${after.schemaMigrations}`,
  );

  assertSnapshotsMatch(before, after, "backup-restore drill");
  dropDatabaseIfExists(DRILL_DATABASE);
  console.log(`[drill] dropped disposable ${DRILL_DATABASE}`);

  if (!keepDump) {
    unlinkSync(dumpPath);
    console.log(`[drill] removed temporary dump ${dumpPath}`);
  } else {
    console.log(`[drill] kept dump at ${dumpPath}`);
  }

  console.log("[drill] OK — backup/restore round-trip verified");
}

try {
  main();
} catch (error) {
  console.error(`[drill] FAIL ${error instanceof Error ? error.message : error}`);
  try {
    dropDatabaseIfExists(DRILL_DATABASE);
  } catch {
    // best-effort cleanup
  }
  process.exit(1);
}
