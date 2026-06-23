import { spawnNodeScript, spawnNpx } from "./lib/spawn-safe.mjs";

const ensure = spawnNodeScript("scripts/ensure-test-db.mjs", [], {
  env: process.env,
});

if (ensure.status !== 0) {
  process.exit(ensure.status ?? 1);
}

const ingest = spawnNpx(["tsx", "scripts/ingest-themealdb-from-sales.ts"], {
  env: process.env,
});

process.exit(ingest.status ?? 1);
