import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  containerHealthStatus,
  psqlQueryScalar,
  spawnNpm,
  YUM4LESS_POSTGRES_CONTAINER,
} from "./lib/spawn-safe.mjs";

const envLocalPath = join(process.cwd(), ".env.local");

const quiet = process.argv.includes("--quiet");
const force = process.argv.includes("--force");
const nonFatal = process.argv.includes("--non-fatal");

function log(message) {
  if (!quiet) {
    console.log(message);
  }
}

function loadEnvLocal() {
  if (!existsSync(envLocalPath)) {
    return;
  }

  for (const line of readFileSync(envLocalPath, "utf8").split(/\r?\n/u)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex <= 0) {
      continue;
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    const value = trimmed.slice(separatorIndex + 1).trim();
    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

function envFlag(name) {
  const normalized = process.env[name]?.trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes";
}

function isSnapMapContextEnabled() {
  return envFlag("YUM4LESS_MAP_SNAP_CONTEXT");
}

function isSnapAutoEnsureEnabled() {
  const normalized = process.env.YUM4LESS_SNAP_AUTO_ENSURE?.trim().toLowerCase();
  if (normalized === "0" || normalized === "false" || normalized === "no") {
    return false;
  }
  return true;
}

function snapRowCount() {
  try {
    const count = psqlQueryScalar(
      "yum4less_dev",
      "select count(*) from snap_retailer_locations;",
    );
    return Number(count) || 0;
  } catch {
    return 0;
  }
}

function snapTableExists() {
  try {
    const count = psqlQueryScalar(
      "yum4less_dev",
      "select count(*) from information_schema.tables where table_schema = 'public' and table_name = 'snap_retailer_locations';",
    );
    return count === "1";
  } catch {
    return false;
  }
}

function shouldUseFixtureMode() {
  return (
    process.argv.includes("--fixture") ||
    envFlag("YUM4LESS_SNAP_DEV_FIXTURE") ||
    envFlag("YUM4LESS_SNAP_FIXTURE") ||
    envFlag("YUM4LESS_MAP_CATALOG_FIXTURE")
  );
}

function runIngest(npmScriptName) {
  const result = spawnNpm(["run", npmScriptName], {
    stdio: "inherit",
    env: process.env,
  });

  if (result.status !== 0) {
    if (nonFatal) {
      console.warn(
        `SNAP auto-ensure ingest failed (exit ${result.status ?? 1}) — continuing because --non-fatal was set.`,
      );
      return;
    }
    process.exit(result.status ?? 1);
  }
}

function main() {
  loadEnvLocal();

  if (!isSnapMapContextEnabled()) {
    log("SNAP map context disabled (set YUM4LESS_MAP_SNAP_CONTEXT=1 to auto-ensure).");
    return;
  }

  if (!isSnapAutoEnsureEnabled()) {
    log("SNAP auto-ensure disabled (YUM4LESS_SNAP_AUTO_ENSURE=0). Run npm run ingest:snap-retailers manually.");
    return;
  }

  const health = containerHealthStatus(YUM4LESS_POSTGRES_CONTAINER);
  if (health !== "healthy") {
    log(`Postgres not ready (${health}) — skipping SNAP auto-ensure. Run npm run db:up first.`);
    return;
  }

  if (!snapTableExists()) {
    log("snap_retailer_locations table missing — run npm run db:up or ensure-test-db first.");
    return;
  }

  const existingRows = snapRowCount();
  const shouldForce =
    force || process.env.YUM4LESS_SNAP_ENSURE?.trim().toLowerCase() === "force";

  if (existingRows > 0 && !shouldForce) {
    log(`SNAP context already loaded (${existingRows.toLocaleString()} row(s)) — skipping ingest.`);
    return;
  }

  const useFixture = shouldUseFixtureMode();
  const csvPath = process.env.YUM4LESS_SNAP_CSV_PATH?.trim();

  if (shouldForce) {
    log("Forcing SNAP retailer ingest...");
  } else {
    log("SNAP retailer table empty — running auto-ensure ingest...");
  }

  if (useFixture || !csvPath) {
    if (!useFixture && !csvPath) {
      log(
        "No YUM4LESS_SNAP_CSV_PATH set — loading ZIP 23111 SNAP fixture for local dev. Set YUM4LESS_SNAP_CSV_PATH for nationwide rows.",
      );
    }
    runIngest("ingest:snap-retailers:fixture");
    return;
  }

  runIngest("ingest:snap-retailers");
}

main();
