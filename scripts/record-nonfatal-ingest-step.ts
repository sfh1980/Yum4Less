import { loadEnvLocal } from "@/lib/load-env-local";
import { markNonFatalIngestJob, type IngestJobKind } from "@/lib/ingest-jobs";
import { isScheduledIngestStepNonFatal } from "@/lib/scheduled-ingest-pipeline";

loadEnvLocal();

async function main() {
  const kind = process.argv[2] ?? "";
  const error = process.argv.slice(3).join(" ").trim() || "non-fatal";
  if (!isScheduledIngestStepNonFatal(kind) || !process.env.DATABASE_URL) {
    return;
  }
  await markNonFatalIngestJob({ kind: kind as IngestJobKind, error });
}

main().catch((error) => {
  console.warn(error instanceof Error ? error.message : error);
});
