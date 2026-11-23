import { loadEnvLocal } from "@/lib/load-env-local";
import { readOsmGroceryFile } from "@/lib/osm-grocery-file";
import {
  formatOsmGroceryLoadSummary,
  loadOsmGroceryFile,
} from "@/lib/osm-grocery-load";

loadEnvLocal();

const dryRun = process.argv.includes("--dry-run");
const filePath = readOsmGroceryFile();

loadOsmGroceryFile({ filePath, dryRun })
  .then((summary) => {
    console.log(formatOsmGroceryLoadSummary(summary));
    if (!dryRun && summary.kept === 0) {
      process.exitCode = 1;
    }
  })
  .catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(message);
    if (message.includes("osm_grocery_places")) {
      console.error("Apply migration 047 before loading grocery pins.");
    }
    process.exitCode = 1;
  });
