import { copyFileSync, existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { ensureTestDatabase } from "./ensure-test-db.mjs";
import { runNpmScript, spawnNpm } from "./lib/spawn-safe.mjs";

const envLocalPath = join(process.cwd(), ".env.local");
const envExamplePath = join(process.cwd(), ".env.example");
const DEFAULT_DEV_DATABASE_URL =
  "postgresql://postgres:postgres@localhost:5433/yum4less_dev";
const DEFAULT_TEST_DATABASE_URL =
  "postgresql://postgres:postgres@localhost:5433/yum4less_test";

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

function envValue(name) {
  return process.env[name]?.trim() ?? "";
}

function databaseNameFromUrl(databaseUrl) {
  try {
    return new URL(databaseUrl).pathname.replace(/^\//, "").trim();
  } catch {
    return databaseUrl;
  }
}

function resolveTestDatabaseUrl() {
  const configuredTestUrl = envValue("DATABASE_URL_TEST");
  if (configuredTestUrl) {
    return configuredTestUrl;
  }

  const devUrl = envValue("DATABASE_URL") || DEFAULT_DEV_DATABASE_URL;
  try {
    const parsed = new URL(devUrl);
    parsed.pathname = "/yum4less_test";
    return parsed.toString();
  } catch {
    return DEFAULT_TEST_DATABASE_URL;
  }
}

function hasLiveIngestKeys() {
  loadEnvLocal();
  return Boolean(
    envValue("GEOCODIO_API_KEY") &&
      envValue("KROGER_CLIENT_ID") &&
      envValue("KROGER_CLIENT_SECRET"),
  );
}

async function provisionIntegrationTestDatabase() {
  const devDatabaseUrl =
    process.env.DATABASE_URL?.trim() || DEFAULT_DEV_DATABASE_URL;
  const testDatabaseUrl = resolveTestDatabaseUrl();
  const testDatabaseName = databaseNameFromUrl(testDatabaseUrl);

  console.log("");
  console.log(
    `Provisioning integration test database (${testDatabaseName})...`,
  );

  process.env.DATABASE_URL = testDatabaseUrl;
  if (!process.env.DATABASE_URL_TEST) {
    process.env.DATABASE_URL_TEST = testDatabaseUrl;
  }

  await ensureTestDatabase();

  process.env.DATABASE_URL = devDatabaseUrl;

  console.log(
    `Provisioned yum4less_dev and ${testDatabaseName} (schema/migrations applied to both).`,
  );
}

function runPostSetupUnitTests() {
  console.log("");
  console.log("Running npm test (post-setup smoke check)...");

  const result = spawnNpm(["test"], {
    stdio: "inherit",
    env: process.env,
  });

  if (result.status !== 0) {
    console.error("");
    console.error(
      "Setup completed but unit tests failed — check the output above before running dev",
    );
    process.exit(result.status ?? 1);
  }
}

if (!existsSync(envLocalPath)) {
  if (!existsSync(envExamplePath)) {
    console.error("Missing .env.example — cannot create .env.local.");
    process.exit(1);
  }

  copyFileSync(envExamplePath, envLocalPath);
  console.log(
    "Created .env.local from .env.example (includes DATABASE_URL for local Postgres).",
  );
  loadEnvLocal();
} else {
  console.log(".env.local already exists — leaving it unchanged.");
  loadEnvLocal();
}

async function main() {
  runNpmScript("db:up");
  await ensureTestDatabase();
  await provisionIntegrationTestDatabase();
  // SNAP auto-ensure already runs non-fatally inside ensureTestDatabase().
  // Do not call runNpmScript("ensure:snap-context") here — that npm script exits
  // on failure and would abort setup after DB provisioning succeeded.

  if (hasLiveIngestKeys()) {
    console.log("");
    console.log(
      "Live ingest keys detected — running daily scheduled ingest (network; may take several minutes)...",
    );
    console.log(
      "Order: map-catalog (Kroger API + OSM Aldi/context) → weekly-ad prices → provider sync → TheMealDB import.",
    );
    runNpmScript("ingest:weekly-ads:scheduled");
    console.log("");
    console.log("Local setup complete with live daily ingest.");
    console.log(
      "Ranked prices and map pins reflect the last ingest run (24h cache on reads).",
    );
    console.log(
      "Map-catalog runs first so Kroger-family API pins, nearest OSM Aldi coords, and context rows exist before weekly-ad ingest selects store targets.",
    );
  } else {
    console.log("");
    console.log("Live ingest keys missing — skipping scheduled ingest.");
    console.log(
      "Set GEOCODIO_API_KEY, KROGER_CLIENT_ID, and KROGER_CLIENT_SECRET in .env.local, then run:",
    );
    console.log("  npm run ingest:weekly-ads:scheduled");
    console.log("");
    console.log(
      "Fixture ingest is CI/rehearsal only (deterministic tests, no live retailer feeds):",
    );
    console.log("  npm run ingest:weekly-ads:fixture");
    console.log("  npm run ingest:map-catalog:fixture");
    console.log("");
    console.log(
      "Before running fixture commands locally, set DATABASE_URL_TEST and point DATABASE_URL at the same test database.",
    );
    console.log(
      "Otherwise the fixture guard will refuse rehearsal writes to yum4less_dev.",
    );
    console.log(
      "See .env.example for DATABASE_URL_TEST=postgresql://postgres:postgres@localhost:5433/yum4less_test",
    );
    console.log("");
    console.log(
      "Without ingest, Postgres has CI seed catalog rows only — ranked pricing stays empty until ingest runs.",
    );
    console.log(
      "Scheduled ingest runs map-catalog before weekly-ad. Live path needs Kroger + Geocodio keys; fixture paths are CI/rehearsal only.",
    );
  }

  runPostSetupUnitTests();

  console.log("");
  console.log(
    "Next: npm run dev → open http://localhost:3000 → use your location (Allow location access) or enter ZIP 23111 to search your local market.",
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
