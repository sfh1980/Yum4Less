import { spawnSync } from "node:child_process";
import { join } from "node:path";

export default async function globalSetup() {
  const scriptPath = join(process.cwd(), "scripts", "ensure-test-db.mjs");
  const result = spawnSync(process.execPath, [scriptPath], {
    stdio: "inherit",
    env: process.env,
    shell: false,
  });

  if (result.status !== 0) {
    throw new Error("ensure-test-db.mjs failed during integration global setup.");
  }
}
