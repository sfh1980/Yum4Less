import { loadEnvLocal } from "@/lib/load-env-local";
import { enqueueScheduledIngestJobs } from "@/lib/ingest-jobs";

loadEnvLocal();

async function main() {
  if (!process.env.DATABASE_URL) {
    process.env.DATABASE_URL =
      "postgresql://postgres:postgres@localhost:5433/yum4less_dev";
  }
  const inserted = await enqueueScheduledIngestJobs();
  console.log(
    `[${new Date().toISOString()}] Enqueued ${inserted} ingest job(s) for today.`,
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
