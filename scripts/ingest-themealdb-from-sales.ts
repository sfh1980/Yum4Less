import { loadEnvLocal } from "@/lib/load-env-local";
import {
  runSaleDrivenThemealdbImport,
  summarizeThemealdbImportReport,
} from "@/lib/recipe-import/sale-driven-themealdb-import";

loadEnvLocal();

async function main() {
  if (!process.env.DATABASE_URL) {
    process.env.DATABASE_URL =
      "postgresql://postgres:postgres@localhost:5433/yum4less_dev";
  }

  console.log("Running sale-driven TheMealDB import (dev test key only)...");
  console.log(
    "Prerequisite: weekly-ad ingest with on-sale price_observations (npm run ingest:weekly-ads:fixture).",
  );

  const report = await runSaleDrivenThemealdbImport();
  console.log(`\n${summarizeThemealdbImportReport(report)}`);

  if (report.imported.length > 0) {
    console.log("\nImported meals:");
    for (const meal of report.imported) {
      console.log(`  - ${meal.title} (${meal.id}, idMeal=${meal.idMeal})`);
    }
  }

  if (report.importedCount === 0 && report.saleIngredientCount === 0) {
    console.log(
      "\nNo on-sale weekly-ad ingredients found. Run npm run ingest:weekly-ads:fixture first.",
    );
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
