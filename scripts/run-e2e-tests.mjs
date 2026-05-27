import { spawnSync } from "node:child_process";
import { ensureTestDatabase } from "./ensure-test-db.mjs";

async function main() {
  await ensureTestDatabase();

  const build = spawnSync("npm run build", {
    stdio: "inherit",
    shell: true,
    env: process.env,
  });

  if (build.status !== 0) {
    process.exit(build.status ?? 1);
  }

  const fixtureIngest = spawnSync("npm run ingest:weekly-ads:fixture", {
    stdio: "inherit",
    shell: true,
    env: process.env,
  });

  if (fixtureIngest.status !== 0) {
    process.exit(fixtureIngest.status ?? 1);
  }

  const e2e = spawnSync("npx playwright test", {
    stdio: "inherit",
    shell: true,
    env: {
      ...process.env,
      PLAYWRIGHT_FORCE_NEW_SERVER: "1",
      CI: "1",
    },
  });

  process.exit(e2e.status ?? 1);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
