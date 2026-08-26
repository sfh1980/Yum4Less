import { resolveFlippWeeklyAdOffersForChain } from "../src/lib/weekly-ad-ingestion/flipp-weekly-ad-resolver.ts";
import { fetchKrogerWeeklyAdPage } from "../src/lib/weekly-ad-ingestion/kroger-weekly-ad-fetcher.ts";
import { fetchKrogerOffersFromOfficialApi } from "../src/lib/weekly-ad-ingestion/kroger-weekly-ad-api-fallback.ts";
import { parseKrogerWeeklyAd } from "../src/lib/weekly-ad-ingestion/parse-kroger-weekly-ad.ts";
import { resolveKrogerStoreForZip } from "../src/lib/weekly-ad-ingestion/kroger-weekly-ad-store.ts";
import { buildKrogerWeeklyAdUrl } from "../src/lib/weekly-ad-ingestion/kroger-weekly-ad-url.ts";
import { persistWeeklyAdBaselineCapture } from "../src/lib/weekly-ad-ingestion/weekly-ad-baseline-capture.ts";
import { analyzeWeeklyAdMatchFunnel } from "../src/lib/weekly-ad-ingestion/weekly-ad-match-funnel-analysis.ts";
import { WEEKLY_AD_TRACKED_INGREDIENT_IDS } from "../src/lib/weekly-ad-ingestion/weekly-ad-fixture-ingest.ts";
import { matchWeeklyAdOffers } from "../src/lib/weekly-ad-ingestion/weekly-ad-ingredient-matching.ts";
import { probeKrogerApiSetup } from "../src/lib/providers/kroger/kroger-api-client.ts";
import { resolveRequiredProbeZipCode } from "../src/lib/ingest-zip-codes.ts";
import { loadEnvLocal } from "./lib/load-env-local.mjs";

loadEnvLocal();

const zipCode = resolveRequiredProbeZipCode();
const trackedIngredientIds = WEEKLY_AD_TRACKED_INGREDIENT_IDS;
const storeId = "kroger-mechanicsville";

async function main() {
  const storeContext = await resolveKrogerStoreForZip(zipCode);
  const url = buildKrogerWeeklyAdUrl({
    zipCode,
    locationId: storeContext.locationId,
  });
  console.log(`\n=== Kroger live weekly-ad probe (ZIP ${zipCode}) ===`);
  console.log("Order: Flipp full resolver → chain scrape → API partial fill");
  console.log(`URL (scrape fallback): ${url}`);
  if (storeContext.locationId) {
    console.log(`Store location ID: ${storeContext.locationId}`);
  }
  console.log();

  const started = Date.now();
  const capturedAt = new Date().toISOString();
  let rawOffers = [];
  let retrievalLabel = "none";
  let tierUsed = "none";

  console.log("1) Flipp full resolver (merchant + flyer + supplemental searches)...");
  try {
    const flipp = await resolveFlippWeeklyAdOffersForChain({
      chain: "kroger",
      zipCode,
      merchantName: "Kroger",
      trackedIngredientIds,
    });
    rawOffers = flipp.rawOffers;
    retrievalLabel = flipp.retrievalLabel;
    tierUsed = "flipp";
    console.log(`   Parsed ${rawOffers.length} offer(s) via ${flipp.retrievalLabel}`);
  } catch (error) {
    console.log(`   FAILED: ${error instanceof Error ? error.message : error}`);
  }

  if (rawOffers.length === 0) {
    console.log("\n2) Kroger chain scrape (browser/HTTP + network JSON)...");
    try {
      const pageFetch = await fetchKrogerWeeklyAdPage({ url });
      rawOffers = parseKrogerWeeklyAd({
        html: pageFetch.html,
        networkJsonBodies: pageFetch.networkJsonBodies,
      });
      retrievalLabel = `${pageFetch.method} scrape`;
      tierUsed = "scrape";
      console.log(
        `   Parsed ${rawOffers.length} offer(s) via ${pageFetch.method} (${pageFetch.attempts} attempt(s))`,
      );
    } catch (error) {
      console.log(`   FAILED: ${error instanceof Error ? error.message : error}`);
    }
  } else {
    console.log("\n2) Kroger chain scrape — skipped (Flipp returned offers)");
  }

  if (rawOffers.length === 0) {
    console.log("\n3) Official API partial fill (tracked ingredients only)...");
    const apiProbe = await probeKrogerApiSetup(zipCode);
    console.log(`   ${apiProbe.message}`);
    rawOffers = await fetchKrogerOffersFromOfficialApi({
      zipCode,
      trackedIngredientIds,
    });
    retrievalLabel = "last-resort product API partial fill";
    tierUsed = "api";
    console.log(`   ${rawOffers.length} offer(s) from API tier`);
  } else {
    console.log("\n3) Official API partial fill — skipped (earlier tier returned offers)");
  }

  const funnel = analyzeWeeklyAdMatchFunnel({
    chain: "kroger",
    storeId,
    sourceUrl: url,
    observedAt: capturedAt,
    rawOffers,
    trackedIngredientIds,
  });
  const captureDir = persistWeeklyAdBaselineCapture({
    chain: "kroger",
    zipCode,
    capturedAt,
    retrievalLabel,
    rawOffers,
    funnel,
  });

  const matched = matchWeeklyAdOffers({
    chain: "kroger",
    storeId,
    sourceUrl: url,
    observedAt: capturedAt,
    rawOffers,
    trackedIngredientIds,
  });
  const matchedCount = matched.filter((offer) => offer.ingredientId).length;

  console.log("\n4) Match funnel summary");
  console.log(`   Tier used: ${tierUsed}`);
  console.log(`   Raw offers: ${rawOffers.length}`);
  console.log(`   Matched (>=0.55): ${matchedCount}`);
  console.log(
    `   Near-miss 0.45-0.54: ${funnel.probes.filter((p) => p.bestConfidence >= 0.45 && p.bestConfidence < 0.55).length}`,
  );
  console.log(
    `   Noise (<=0.05): ${funnel.probes.filter((p) => p.bestConfidence <= 0.05).length}`,
  );
  console.log(`   Capture dir: ${captureDir}`);

  if (rawOffers.length > 0) {
    console.log("   Sample offers:");
    for (const offer of rawOffers.slice(0, 5)) {
      console.log(
        `   - ${offer.productName} @ $${offer.price}${offer.saleLabel ? ` (${offer.saleLabel})` : ""}`,
      );
    }
  }

  console.log(`\n=== Done in ${formatElapsed(started)} ===\n`);

  process.exit(rawOffers.length > 0 ? 0 : 1);
}

function formatElapsed(startedMs) {
  return `${((Date.now() - startedMs) / 1000).toFixed(1)}s`;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
