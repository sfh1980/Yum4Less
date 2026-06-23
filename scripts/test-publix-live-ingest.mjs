import { spawnNodeScript, spawnNpx } from "./lib/spawn-safe.mjs";

if (process.env.YUM4LESS_WEEKLY_AD_FIXTURE === "1") {
  delete process.env.YUM4LESS_WEEKLY_AD_FIXTURE;
}

const ensure = spawnNodeScript("scripts/ensure-test-db.mjs", [], {
  env: process.env,
});

if (ensure.status !== 0) {
  process.exit(ensure.status ?? 1);
}

const ingest = spawnNpx(["tsx", "scripts/test-publix-live-ingest-runner.ts"], {
  env: process.env,
});

process.exit(ingest.status ?? 1);
