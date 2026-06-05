import { spawnSync } from "node:child_process";

const ensure = spawnSync("node scripts/ensure-test-db.mjs", {
  stdio: "inherit",
  shell: true,
  env: process.env,
});

if (ensure.status !== 0) {
  process.exit(ensure.status ?? 1);
}

const ingest = spawnSync("npx tsx scripts/ingest-themealdb-from-sales.ts", {
  stdio: "inherit",
  shell: true,
  env: process.env,
});

process.exit(ingest.status ?? 1);
