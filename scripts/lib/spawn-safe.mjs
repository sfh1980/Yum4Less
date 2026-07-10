import { execFileSync, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";

export const YUM4LESS_POSTGRES_CONTAINER = "yum4less-postgres";

const SQL_IDENTIFIER_RE = /^[a-zA-Z_][a-zA-Z0-9_]*$/;

function npmCommand() {
  return process.platform === "win32" ? "npm.cmd" : "npm";
}

function npxCommand() {
  return process.platform === "win32" ? "npx.cmd" : "npx";
}

function resolveNodeBundledNpmCli(cliName) {
  const cliPath = join(
    dirname(process.execPath),
    "node_modules",
    "npm",
    "bin",
    `${cliName}-cli.js`,
  );

  return existsSync(cliPath) ? cliPath : null;
}

function spawnNpmCli(cliName, args, options = {}) {
  const bundledCli = resolveNodeBundledNpmCli(cliName);
  if (process.platform === "win32" && bundledCli) {
    return spawnSync(process.execPath, [bundledCli, ...args], {
      stdio: "inherit",
      shell: false,
      env: process.env,
      ...options,
    });
  }

  const command = cliName === "npm" ? npmCommand() : npxCommand();
  return spawnSync(command, args, {
    stdio: "inherit",
    shell: false,
    env: process.env,
    ...options,
  });
}

export function assertSafeSqlIdentifier(value, label = "SQL identifier") {
  if (typeof value !== "string" || !SQL_IDENTIFIER_RE.test(value)) {
    throw new Error(`Unsafe ${label}: ${String(value)}`);
  }

  return value;
}

export function spawnNpm(args, options = {}) {
  return spawnNpmCli("npm", args, options);
}

export function spawnNpx(args, options = {}) {
  return spawnNpmCli("npx", args, options);
}

export function spawnNodeScript(relativePath, args = [], options = {}) {
  const scriptPath = join(process.cwd(), relativePath);
  return spawnSync(process.execPath, [scriptPath, ...args], {
    stdio: "inherit",
    shell: false,
    env: process.env,
    ...options,
  });
}

export function runNpmScript(scriptName, options = {}) {
  const result = spawnNpm(["run", scriptName], options);
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }

  return result;
}

export function dockerExecFile(args, options = {}) {
  return execFileSync("docker", args, { shell: false, ...options });
}

export function dockerAvailable() {
  try {
    execFileSync("docker", ["info"], { stdio: "ignore", shell: false });
    return true;
  } catch {
    return false;
  }
}

export function containerHealthStatus(
  containerName = YUM4LESS_POSTGRES_CONTAINER,
) {
  if (containerName !== YUM4LESS_POSTGRES_CONTAINER) {
    throw new Error(`Unexpected container name: ${containerName}`);
  }

  try {
    return dockerExecFile(
      ["inspect", "--format={{.State.Health.Status}}", containerName],
      { encoding: "utf8" },
    ).trim();
  } catch {
    return "missing";
  }
}

export function psqlQueryScalar(databaseName, sql) {
  assertSafeSqlIdentifier(databaseName, "database name");
  return dockerExecFile(
    [
      "exec",
      YUM4LESS_POSTGRES_CONTAINER,
      "psql",
      "-U",
      "postgres",
      "-d",
      databaseName,
      "-tAc",
      sql,
    ],
    { encoding: "utf8" },
  ).trim();
}

export function psqlQueryRows(databaseName, sql) {
  assertSafeSqlIdentifier(databaseName, "database name");
  const raw = dockerExecFile(
    [
      "exec",
      YUM4LESS_POSTGRES_CONTAINER,
      "psql",
      "-U",
      "postgres",
      "-d",
      databaseName,
      "-tA",
      "-F",
      "\t",
      "-c",
      sql,
    ],
    { encoding: "utf8" },
  ).trim();

  if (!raw) {
    return [];
  }

  return raw.split("\n").map((line) => {
    const [version, filename, checksum, applied_at] = line.split("\t");
    return { version, filename, checksum, applied_at };
  });
}

export function psqlApplySqlContent(databaseName, sqlContent) {
  assertSafeSqlIdentifier(databaseName, "database name");
  dockerExecFile(
    [
      "exec",
      "-i",
      YUM4LESS_POSTGRES_CONTAINER,
      "psql",
      "-U",
      "postgres",
      "-d",
      databaseName,
    ],
    {
      input: sqlContent,
      stdio: ["pipe", "inherit", "inherit"],
    },
  );
}

export function psqlAdminCommand(sql) {
  dockerExecFile(
    ["exec", YUM4LESS_POSTGRES_CONTAINER, "psql", "-U", "postgres", "-c", sql],
    { stdio: "inherit" },
  );
}

export function createDatabase(databaseName) {
  assertSafeSqlIdentifier(databaseName, "database name");
  psqlAdminCommand(`CREATE DATABASE ${databaseName};`);
}

export function dropDatabaseIfExists(databaseName) {
  assertSafeSqlIdentifier(databaseName, "database name");
  psqlAdminCommand(`DROP DATABASE IF EXISTS ${databaseName};`);
}

export function tableExists(tableName, databaseName) {
  assertSafeSqlIdentifier(databaseName, "database name");
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

export function columnExists(tableName, columnName, databaseName) {
  assertSafeSqlIdentifier(databaseName, "database name");
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
