import { loadEnvLocal } from "@/lib/load-env-local";
import { fixtureSnapRetailers23111 } from "@/lib/fixtures/snap-retailers.fixtures";
import { loadSnapRetailerCsvFromFileWithReport } from "@/lib/snap-retailer-ingest";
import { upsertSnapRetailerLocations } from "@/lib/snap-retailer-locations";

loadEnvLocal();

async function main() {
  if (!process.env.DATABASE_URL) {
    process.env.DATABASE_URL =
      "postgresql://postgres:postgres@localhost:5433/yum4less_dev";
  }

  const useFixture =
    process.argv.includes("--fixture") ||
    process.env.YUM4LESS_SNAP_FIXTURE === "1" ||
    process.env.YUM4LESS_MAP_CATALOG_FIXTURE === "1";

  const snapshotDate =
    process.env.YUM4LESS_SNAP_SNAPSHOT_DATE?.trim() || "2025-12-31";

  let rows = fixtureSnapRetailers23111;

  if (!useFixture) {
    const csvPath = process.env.YUM4LESS_SNAP_CSV_PATH?.trim();
    if (!csvPath) {
      console.error(
        "Set YUM4LESS_SNAP_CSV_PATH to a USDA SNAP retailer CSV export, or run with --fixture for CI/local rehearsal.",
      );
      process.exit(1);
    }

    const parsed = loadSnapRetailerCsvFromFileWithReport({
      filePath: csvPath,
      snapshotDate,
    });
    rows = parsed.rows;

    console.log(
      `Parsed USDA CSV: ${parsed.report.parsedRows.toLocaleString()} row(s); ` +
        `${parsed.report.includedRows.toLocaleString()} active grocery pin(s) after filters ` +
        `(skipped inactive=${parsed.report.skippedInactive.toLocaleString()}, ` +
        `store type=${parsed.report.skippedStoreType.toLocaleString()}, ` +
        `incomplete=${parsed.report.skippedIncomplete.toLocaleString()}).`,
    );

    if (rows.length === 0) {
      console.error(
        "No rows matched. Expected FNS columns like Store Name, Store Type, Latitude, Longitude. " +
          "Grocery types include Supermarket, Super Store, Large/Medium/Small Grocery Store.",
      );
      process.exit(1);
    }
  }

  const upserted = await upsertSnapRetailerLocations(rows);

  console.log(
    `SNAP retailer ingest finished: ${upserted.toLocaleString()} row(s) upserted from ${useFixture ? "fixture" : "CSV"} (snapshot ${snapshotDate}).`,
  );

  if (useFixture) {
    console.log("Fixture mode: npm run ingest:snap-retailers:fixture");
  } else {
    console.log(
      "Live mode loaded USDA SNAP CSV into snap_retailer_locations (map context reference only).",
    );
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
