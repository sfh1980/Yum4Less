import { spawnSync } from "node:child_process";
import { ensureTestDatabase } from "./ensure-test-db.mjs";

async function main() {
  const ciEnv = {
    ...process.env,
    CI: "1",
    YUM4LESS_CI_BOOTSTRAP_STORES: "1",
  };
  process.env.CI = "1";
  process.env.YUM4LESS_CI_BOOTSTRAP_STORES = "1";
  await ensureTestDatabase();

  const build = spawnSync("npm run build", {
    stdio: "inherit",
    shell: true,
    env: ciEnv,
  });

  if (build.status !== 0) {
    process.exit(build.status ?? 1);
  }

  const fixtureIngest = spawnSync(
    "node scripts/run-weekly-ad-ingest.mjs --fixture",
    {
      stdio: "inherit",
      shell: true,
      env: ciEnv,
    },
  );

  if (fixtureIngest.status !== 0) {
    process.exit(fixtureIngest.status ?? 1);
  }

  const mapCatalogFixture = spawnSync(
    "npx tsx scripts/ingest-map-catalog.ts --fixture",
    {
      stdio: "inherit",
      shell: true,
      env: ciEnv,
    },
  );

  if (mapCatalogFixture.status !== 0) {
    process.exit(mapCatalogFixture.status ?? 1);
  }

  const e2e = spawnSync("npx playwright test", {
    stdio: "inherit",
    shell: true,
    env: {
      ...ciEnv,
      PLAYWRIGHT_FORCE_NEW_SERVER: "1",
    },
  });

  process.exit(e2e.status ?? 1);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
