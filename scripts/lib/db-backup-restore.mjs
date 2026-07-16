import { mkdirSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { join, resolve, basename } from "node:path";
import { spawnSync } from "node:child_process";
import {
  YUM4LESS_POSTGRES_CONTAINER,
  assertSafeSqlIdentifier,
  containerHealthStatus,
  dockerAvailable,
  dockerExecFile,
  dropDatabaseIfExists,
  createDatabase,
  psqlQueryScalar,
} from "./spawn-safe.mjs";

export const DEFAULT_BACKUP_DIR = join(process.cwd(), "backups");

/** Databases that require an explicit destructive confirm flag to restore into. */
export const PROTECTED_RESTORE_DATABASES = new Set([
  "yum4less_dev",
  "postgres",
  "template0",
  "template1",
]);

export function ensurePostgresReady() {
  if (!dockerAvailable()) {
    throw new Error("Docker is not available. Start Docker Desktop / Engine first.");
  }

  const health = containerHealthStatus();
  if (health !== "healthy") {
    throw new Error(
      `Postgres container ${YUM4LESS_POSTGRES_CONTAINER} is not healthy (status=${health}). Run npm run db:up.`,
    );
  }
}

export function resolveBackupDir(dir = DEFAULT_BACKUP_DIR) {
  const resolved = resolve(dir);
  mkdirSync(resolved, { recursive: true });
  return resolved;
}

export function buildBackupFilename(databaseName, when = new Date()) {
  assertSafeSqlIdentifier(databaseName, "database name");
  const stamp = when.toISOString().replace(/[:.]/g, "-");
  return `${databaseName}_${stamp}.sql`;
}

/**
 * Logical SQL dump via `pg_dump` inside the compose Postgres container.
 * Returns absolute path to the written file.
 */
export function dumpDatabaseToFile(databaseName, options = {}) {
  assertSafeSqlIdentifier(databaseName, "database name");
  ensurePostgresReady();

  const backupDir = resolveBackupDir(options.backupDir);
  const filename = options.filename ?? buildBackupFilename(databaseName);
  if (filename.includes("..") || filename.includes("/") || filename.includes("\\")) {
    throw new Error(`Unsafe backup filename: ${filename}`);
  }

  const outPath = join(backupDir, filename);
  const result = spawnSync(
    "docker",
    [
      "exec",
      YUM4LESS_POSTGRES_CONTAINER,
      "pg_dump",
      "-U",
      "postgres",
      "-d",
      databaseName,
      "--no-owner",
      "--no-acl",
    ],
    {
      encoding: "utf8",
      maxBuffer: 256 * 1024 * 1024,
      shell: false,
    },
  );

  if (result.status !== 0) {
    throw new Error(
      `pg_dump failed for ${databaseName}: ${result.stderr || result.stdout || `exit ${result.status}`}`,
    );
  }

  if (!result.stdout || result.stdout.length < 32) {
    throw new Error(`pg_dump produced an empty dump for ${databaseName}`);
  }

  writeFileSync(outPath, result.stdout, "utf8");
  return outPath;
}

export function readIntegritySnapshot(databaseName) {
  assertSafeSqlIdentifier(databaseName, "database name");
  ensurePostgresReady();

  return {
    databaseName,
    stores: Number(psqlQueryScalar(databaseName, "select count(*)::text from stores")),
    priceObservations: Number(
      psqlQueryScalar(databaseName, "select count(*)::text from price_observations"),
    ),
    schemaMigrations: Number(
      psqlQueryScalar(databaseName, "select count(*)::text from schema_migrations"),
    ),
  };
}

export function assertSnapshotsMatch(before, after, label = "restore") {
  const keys = ["stores", "priceObservations", "schemaMigrations"];
  for (const key of keys) {
    if (before[key] !== after[key]) {
      throw new Error(
        `${label} integrity mismatch on ${key}: source=${before[key]} restored=${after[key]}`,
      );
    }
  }
}

/**
 * Restore a SQL dump into targetDatabase.
 * Drops and recreates the target DB — destructive for that name only.
 */
export function restoreDatabaseFromFile(targetDatabase, dumpPath, options = {}) {
  assertSafeSqlIdentifier(targetDatabase, "database name");
  ensurePostgresReady();

  const absoluteDump = resolve(dumpPath);
  if (!existsSync(absoluteDump)) {
    throw new Error(`Dump file not found: ${absoluteDump}`);
  }

  if (
    PROTECTED_RESTORE_DATABASES.has(targetDatabase) &&
    !options.allowProtectedRestore
  ) {
    throw new Error(
      `Refusing to restore into protected database "${targetDatabase}". ` +
        `Pass --i-understand-destructively-restore-dev (or allowProtectedRestore) only when intentional.`,
    );
  }

  const sql = readFileSync(absoluteDump, "utf8");
  if (!sql.includes("PostgreSQL database dump") && !sql.includes("SET ")) {
    throw new Error(`Dump file does not look like a pg_dump SQL export: ${absoluteDump}`);
  }

  // Terminate sessions so DROP DATABASE succeeds during drills.
  dockerExecFile(
    [
      "exec",
      YUM4LESS_POSTGRES_CONTAINER,
      "psql",
      "-U",
      "postgres",
      "-d",
      "postgres",
      "-v",
      "ON_ERROR_STOP=1",
      "-c",
      `SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '${targetDatabase}' AND pid <> pg_backend_pid();`,
    ],
    { stdio: "ignore" },
  );

  dropDatabaseIfExists(targetDatabase);
  createDatabase(targetDatabase);

  dockerExecFile(
    [
      "exec",
      "-i",
      YUM4LESS_POSTGRES_CONTAINER,
      "psql",
      "-U",
      "postgres",
      "-d",
      targetDatabase,
      "-v",
      "ON_ERROR_STOP=1",
    ],
    {
      input: sql,
      stdio: ["pipe", "inherit", "inherit"],
    },
  );

  return {
    targetDatabase,
    dumpPath: absoluteDump,
    dumpBasename: basename(absoluteDump),
  };
}
