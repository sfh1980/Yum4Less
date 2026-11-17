import { loadEnvLocal } from "@/lib/load-env-local";
import { readBusinessTimeZone } from "@/lib/business-time-zone";

loadEnvLocal();

try {
  readBusinessTimeZone();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
