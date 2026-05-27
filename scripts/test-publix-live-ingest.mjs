import { spawnSync } from "node:child_process";

if (process.env.YUM4LESS_WEEKLY_AD_FIXTURE === "1") {
  delete process.env.YUM4LESS_WEEKLY_AD_FIXTURE;
}

const ensure = spawnSync("node scripts/ensure-test-db.mjs", {
  stdio: "inherit",
  shell: true,
  env: process.env,
});

if (ensure.status !== 0) {
  process.exit(ensure.status ?? 1);
}

const ingest = spawnSync(
  "npx tsx scripts/test-publix-live-ingest-runner.ts",
  {
    stdio: "inherit",
    shell: true,
    env: process.env,
  },
);

process.exit(ingest.status ?? 1);
