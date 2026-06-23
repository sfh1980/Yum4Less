import { spawnNodeScript, spawnNpx } from "./lib/spawn-safe.mjs";

if (process.argv.includes("--fixture")) {
  process.env.YUM4LESS_WEEKLY_AD_FIXTURE = "1";
}

if (process.argv.includes("--browser")) {
  process.env.YUM4LESS_WEEKLY_AD_BROWSER = "1";
}

if (process.env.YUM4LESS_WEEKLY_AD_FIXTURE === "1") {
  const guard = spawnNpx(
    ["tsx", "scripts/enforce-fixture-ingest-database-policy.ts"],
    { env: process.env },
  );

  if (guard.status !== 0) {
    process.exit(guard.status ?? 1);
  }
}

const ensure = spawnNodeScript("scripts/ensure-test-db.mjs", [], {
  env: process.env,
});

if (ensure.status !== 0) {
  process.exit(ensure.status ?? 1);
}

const ingest = spawnNpx(["tsx", "scripts/ingest-weekly-ads.ts"], {
  env: process.env,
});

process.exit(ingest.status ?? 1);
