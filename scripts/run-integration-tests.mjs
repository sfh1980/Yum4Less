import { spawnSync } from "node:child_process";

if (process.argv.includes("--reset")) {
  process.env.YUM4LESS_TEST_DB_RESET = "1";
}

const result = spawnSync("npx vitest run --config vitest.integration.config.ts", {
  stdio: "inherit",
  shell: true,
  env: process.env,
});

process.exit(result.status ?? 1);
