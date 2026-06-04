import { spawnSync } from "node:child_process";

console.log(`[${new Date().toISOString()}] Starting scheduled Yum4Less pricing ingest...`);

const ensure = spawnSync("node scripts/ensure-test-db.mjs", {
  stdio: "inherit",
  shell: true,
  env: process.env,
});

if (ensure.status !== 0) {
  console.error("Scheduled ingest failed while preparing Postgres.");
  process.exit(ensure.status ?? 1);
}

const useFixture = process.argv.includes("--fixture");
const weeklyOnly = process.argv.includes("--weekly-only");
const providerOnly = process.argv.includes("--provider-only");
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
}

console.log(`[${new Date().toISOString()}] Scheduled pricing ingest completed.`);
