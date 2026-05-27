import { copyFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const envLocalPath = join(process.cwd(), ".env.local");
const envExamplePath = join(process.cwd(), ".env.example");

function run(command) {
  const result = spawnSync(command, {
    stdio: "inherit",
    shell: true,
    env: process.env,
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

if (!existsSync(envLocalPath)) {
  if (!existsSync(envExamplePath)) {
    console.error("Missing .env.example — cannot create .env.local.");
    process.exit(1);
  }

  copyFileSync(envExamplePath, envLocalPath);
  console.log(
    "Created .env.local from .env.example (includes DATABASE_URL for local Postgres).",
  );
} else {
  console.log(".env.local already exists — leaving it unchanged.");
}

run("npm run db:up");
run("npm run ingest:weekly-ads:fixture");

console.log("");
console.log("Local demo setup complete.");
console.log("Next: npm run dev → open http://localhost:3000 → search ZIP 23111");
console.log("");
console.log(
  "Fixture ingest writes rehearsal weekly-ad rows to Postgres — not live retailer feeds.",
);
