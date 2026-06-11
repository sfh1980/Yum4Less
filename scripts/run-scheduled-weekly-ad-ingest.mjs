import { spawnSync } from "node:child_process";

console.log(`[${new Date().toISOString()}] Starting scheduled Yum4Less pricing ingest...`);

const useFixture = process.argv.includes("--fixture");
const weeklyOnly = process.argv.includes("--weekly-only");
const providerOnly = process.argv.includes("--provider-only");

if (!useFixture && !weeklyOnly && !providerOnly) {
  const envCheck = spawnSync("npx tsx scripts/assert-live-ingest-env.ts", {
    stdio: "inherit",
    shell: true,
    env: process.env,
  });

  if (envCheck.status !== 0) {
    process.exit(envCheck.status ?? 1);
  }
}

const ensure = spawnSync("node scripts/ensure-test-db.mjs", {
  stdio: "inherit",
  shell: true,
  env: process.env,
});

if (ensure.status !== 0) {
  console.error("Scheduled ingest failed while preparing Postgres.");
  process.exit(ensure.status ?? 1);
}

const ingestCommand = useFixture
  ? "node scripts/run-weekly-ad-ingest.mjs --fixture"
  : "node scripts/run-weekly-ad-ingest.mjs";

if (!providerOnly) {
  const ingest = spawnSync(ingestCommand, {
    stdio: "inherit",
    shell: true,
    env: process.env,
  });

  if (ingest.status !== 0) {
    console.error("Scheduled ingest failed during weekly-ad pull.");
    process.exit(ingest.status ?? 1);
  }
}

if (!weeklyOnly) {
  const mapCatalogCommand = useFixture
    ? "npm run ingest:map-catalog:fixture"
    : "npm run ingest:map-catalog";

  const mapCatalog = spawnSync(mapCatalogCommand, {
    stdio: "inherit",
    shell: true,
    env: process.env,
  });

  if (mapCatalog.status !== 0) {
    console.warn(
      `[${new Date().toISOString()}] Map catalog step failed (often OSM Overpass-only). Continuing ranked catalog + provider sync.`,
    );
    console.warn(
      "Check YUM4LESS_OSM_OVERPASS_URL or Overpass logs above. OSM context pins may be missing until the next run.",
    );
  }
}

if (!weeklyOnly && !useFixture) {
  const providerSync = spawnSync("npm run sync:provider-prices", {
    stdio: "inherit",
    shell: true,
    env: process.env,
  });

  if (providerSync.status !== 0) {
    console.error("Scheduled ingest failed during provider price sync.");
    process.exit(providerSync.status ?? 1);
  }

  const themealdbImport = spawnSync("npm run ingest:themealdb:from-sales", {
    stdio: "inherit",
    shell: true,
    env: process.env,
  });

  if (themealdbImport.status !== 0) {
    console.error("Scheduled ingest failed during TheMealDB sale-driven import.");
    process.exit(themealdbImport.status ?? 1);
  }
}

console.log(`[${new Date().toISOString()}] Scheduled pricing ingest completed.`);
