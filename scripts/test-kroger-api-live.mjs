import { probeKrogerApiSetup } from "../src/lib/providers/kroger/kroger-api-client.ts";
import { loadEnvLocal } from "./lib/load-env-local.mjs";

loadEnvLocal();

const zipCode = process.env.YUM4LESS_INGEST_ZIP ?? "23111";

async function main() {
  console.log(`\n=== Kroger API setup probe (ZIP ${zipCode}) ===\n`);
  const probe = await probeKrogerApiSetup(zipCode);

  console.log(`Environment: ${probe.environment}`);
  console.log(`Base URL: ${probe.baseUrl}`);
  console.log(`Configured: ${probe.configured}`);
  console.log(`Token OK: ${probe.tokenOk}`);
  console.log(`Location ID: ${probe.locationId ?? "(none)"}`);
  console.log(`Catalog search OK: ${probe.catalogOk}`);
  console.log(`Store pricing available: ${probe.pricingAvailable}`);
  if (probe.sampleProductDescription) {
    console.log(`Sample product: ${probe.sampleProductDescription}`);
  }
  if (probe.productId) {
    console.log(`Product ID: ${probe.productId}`);
  }
  if (probe.searchPriceSummary) {
    console.log(`Search price summary: ${JSON.stringify(probe.searchPriceSummary)}`);
  }
  if (probe.detailPriceSummary) {
    console.log(`Detail price summary: ${JSON.stringify(probe.detailPriceSummary)}`);
  }
  if (probe.productionPromotionSteps?.length) {
    console.log("\nProduction promotion checklist:");
    for (const [index, step] of probe.productionPromotionSteps.entries()) {
      console.log(`  ${index + 1}. ${step}`);
    }
    console.log(`Production-ready: ${probe.productionPromotionReady ? "yes" : "no (expected in certification)"}`);
  }
  console.log(`\n${probe.message}\n`);

  process.exit(probe.configured && probe.tokenOk && probe.catalogOk ? 0 : 1);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : error);
  process.exit(1);
});
