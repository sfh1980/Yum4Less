import {
  containerHealthStatus,
  dockerAvailable,
  runNpmScript,
} from "./lib/spawn-safe.mjs";
import { applySchemaMigrations } from "./lib/db-migrations.mjs";

async function waitForHealthy() {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    if (containerHealthStatus() === "healthy") {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }
  throw new Error("Postgres container is not healthy.");
}

async function main() {
  if (!dockerAvailable()) {
    throw new Error("Docker is required. Start Docker Desktop and rerun `npm run db:migrate`.");
  }

  if (containerHealthStatus() !== "healthy") {
    runNpmScript("db:up");
    await waitForHealthy();
  }

  const databaseUrl = process.env.DATABASE_URL?.trim() || "postgresql://postgres:postgres@localhost:5433/yum4less_dev";
  const databaseName = new URL(databaseUrl).pathname.replace(/^\//, "") || "yum4less_dev";

  const summary = applySchemaMigrations(databaseName);
  console.log(`Applied pending migrations on ${databaseName}:`, summary);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
