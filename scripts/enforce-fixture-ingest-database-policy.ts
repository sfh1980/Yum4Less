import { enforceFixtureIngestDatabasePolicy } from "@/lib/fixture-ingest-policy";
import { loadEnvLocal } from "@/lib/load-env-local";

loadEnvLocal();

try {
  enforceFixtureIngestDatabasePolicy(process.env);
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
