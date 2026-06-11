import { loadEnvLocal } from "@/lib/load-env-local";
import {
  formatLiveIngestEnvError,
  validateLiveIngestEnv,
} from "@/lib/live-ingest-env";

loadEnvLocal();

const validation = validateLiveIngestEnv();

if (!validation.ok) {
  console.error(formatLiveIngestEnvError(validation));
  process.exit(1);
}
