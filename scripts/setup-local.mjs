import { copyFileSync, existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const envLocalPath = join(process.cwd(), ".env.local");
const envExamplePath = join(process.cwd(), ".env.example");

function loadEnvLocal() {
  if (!existsSync(envLocalPath)) {
    return;
  }

  for (const line of readFileSync(envLocalPath, "utf8").split(/\r?\n/u)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex <= 0) {
      continue;
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    const value = trimmed.slice(separatorIndex + 1).trim();
    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

function envValue(name) {
  return process.env[name]?.trim() ?? "";
}

function hasLiveIngestKeys() {
  loadEnvLocal();
  return Boolean(
    envValue("GEOCODIO_API_KEY") &&
      envValue("KROGER_CLIENT_ID") &&
      envValue("KROGER_CLIENT_SECRET"),
  );
}

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
  loadEnvLocal();
} else {
  console.log(".env.local already exists — leaving it unchanged.");
  loadEnvLocal();
}

run("npm run db:up");

if (hasLiveIngestKeys()) {
  console.log("");
  console.log(
    "Live ingest keys detected — running daily scheduled ingest (network; may take several minutes)...",
  );
  run("npm run ingest:weekly-ads:scheduled");
  console.log("");
  console.log("Local setup complete with live daily ingest.");
  console.log(
    "Ranked prices and map pins reflect the last ingest run (24h cache on reads).",
  );
} else {
  console.log("");
  console.log("Live ingest keys missing — skipping scheduled ingest.");
  console.log(
    "Set GEOCODIO_API_KEY, KROGER_CLIENT_ID, and KROGER_CLIENT_SECRET in .env.local, then run:",
  );
  console.log("  npm run ingest:weekly-ads:scheduled");
  console.log("");
  console.log(
    "Fixture ingest is CI/rehearsal only (deterministic tests, no live retailer feeds):",
  );
  console.log("  npm run ingest:weekly-ads:fixture");
  console.log("");
  console.log(
    "Without ingest, Postgres has bootstrap seed rows only — ranked pricing stays empty until ingest runs.",
  );
}

console.log("");
console.log("Next: npm run dev → open http://localhost:3000 → search ZIP 23111");
