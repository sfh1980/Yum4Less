import { spawnSync } from "node:child_process";

if (process.argv.includes("--fixture")) {
  process.env.YUM4LESS_WEEKLY_AD_FIXTURE = "1";
}

if (process.argv.includes("--browser")) {
  process.env.YUM4LESS_WEEKLY_AD_BROWSER = "1";
}

const ensure = spawnSync("node scripts/ensure-test-db.mjs", {
  stdio: "inherit",
  shell: true,
  env: process.env,
});

if (ensure.status !== 0) {
  process.exit(ensure.status ?? 1);
}

const ingest = spawnSync("npx tsx scripts/ingest-weekly-ads.ts", {
  stdio: "inherit",
  shell: true,
  env: process.env,
});

process.exit(ingest.status ?? 1);
