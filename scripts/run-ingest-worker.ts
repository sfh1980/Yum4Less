import { spawnSync } from "node:child_process";
import { loadEnvLocal } from "@/lib/load-env-local";
import { claimNextIngestJob, finishIngestJob } from "@/lib/ingest-jobs";

loadEnvLocal();

const once = process.argv.includes("--once");

function spawnJob(kind: string) {
  const npm = (args: string[]) =>
    spawnSync("npm", args, { stdio: "inherit", env: process.env, shell: true });

  switch (kind) {
    case "map-catalog":
      return process.env.YUM4LESS_MAP_CATALOG_FIXTURE === "1"
        ? npm(["run", "ingest:map-catalog:fixture"])
        : npm(["run", "ingest:map-catalog"]);
    case "weekly-ad":
      return spawnSync(
        "node",
        [
          "scripts/run-weekly-ad-ingest.mjs",
          ...(process.env.YUM4LESS_WEEKLY_AD_FIXTURE === "1" ? ["--fixture"] : []),
        ],
        { stdio: "inherit", env: process.env, shell: true },
      );
    case "snap-ensure":
      return spawnSync("node", ["scripts/ensure-snap-context.mjs", "--quiet"], {
        stdio: "inherit",
        env: process.env,
        shell: true,
      });
    case "provider-sync":
      return npm(["run", "sync:provider-prices"]);
    case "themealdb-from-sales":
      return npm(["run", "ingest:themealdb:from-sales"]);
    case "ranked-price-freshness":
      return npm(["run", "check:ranked-price-freshness"]);
    default:
      return { status: 1 };
  }
}

function isNonFatal(kind: string): boolean {
  return kind === "map-catalog" || kind === "snap-ensure";
}

async function main() {
  if (!process.env.DATABASE_URL) {
    process.env.DATABASE_URL =
      "postgresql://postgres:postgres@localhost:5433/yum4less_dev";
  }

  let drained = 0;
  for (;;) {
    const job = await claimNextIngestJob();
    if (!job) {
      break;
    }
    console.log(
      `[${new Date().toISOString()}] Worker running ${job.kind} (${job.id})`,
    );
    const spawned = spawnJob(job.kind);
    const status = spawned.status ?? 1;
    if (status === 0) {
      await finishIngestJob({ id: job.id, status: "succeeded" });
    } else if (isNonFatal(job.kind)) {
      await finishIngestJob({
        id: job.id,
        status: "succeeded",
        error: `${job.kind} failed non-fatally (exit ${status})`,
      });
      console.warn(
        `[${new Date().toISOString()}] ${job.kind} failed non-fatally; continuing.`,
      );
    } else {
      await finishIngestJob({
        id: job.id,
        status: "failed",
        error: `${job.kind} exit ${status}`,
      });
      process.exit(status);
    }
    drained += 1;
    if (once) {
      break;
    }
  }

  console.log(
    `[${new Date().toISOString()}] Ingest worker drained ${drained} job(s).`,
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
