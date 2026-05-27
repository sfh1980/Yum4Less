import { fetchFlippWeeklyAdOffers } from "../src/lib/weekly-ad-ingestion/flipp-weekly-ad-feed.ts";
import { fetchKrogerWeeklyAdPage } from "../src/lib/weekly-ad-ingestion/kroger-weekly-ad-fetcher.ts";
import { parseKrogerWeeklyAd } from "../src/lib/weekly-ad-ingestion/parse-kroger-weekly-ad.ts";
import { resolveKrogerStoreForZip } from "../src/lib/weekly-ad-ingestion/kroger-weekly-ad-store.ts";
import { buildKrogerWeeklyAdUrl } from "../src/lib/weekly-ad-ingestion/kroger-weekly-ad-url.ts";
import { fetchKrogerOffersFromOfficialApi } from "../src/lib/weekly-ad-ingestion/kroger-weekly-ad-api-fallback.ts";
import { WEEKLY_AD_TRACKED_INGREDIENT_IDS } from "../src/lib/weekly-ad-ingestion/weekly-ad-fixture-ingest.ts";
import { matchWeeklyAdOffers } from "../src/lib/weekly-ad-ingestion/weekly-ad-ingredient-matching.ts";
import { probeKrogerApiSetup } from "../src/lib/providers/kroger/kroger-api-client.ts";
import { loadEnvLocal } from "./lib/load-env-local.mjs";

loadEnvLocal();

const zipCode = process.env.YUM4LESS_INGEST_ZIP ?? "23111";
const trackedIngredientIds = WEEKLY_AD_TRACKED_INGREDIENT_IDS;

async function main() {
  const storeContext = await resolveKrogerStoreForZip(zipCode);
  const url = buildKrogerWeeklyAdUrl({
    zipCode,
    locationId: storeContext.locationId,
  });
  console.log(`\n=== Kroger live scrape test (ZIP ${zipCode}) ===`);
  console.log(`URL: ${url}`);
  if (storeContext.locationId) {
    console.log(`Store location ID: ${storeContext.locationId}`);
  }
  console.log();

  const started = Date.now();
  let pageFetch;
  let scrapeOffers = [];

  try {
    console.log("1) Browser fetch (HTTP fallback on browser failure)...");
    pageFetch = await fetchKrogerWeeklyAdPage({ url });
    console.log(
      `   OK via ${pageFetch.method} in ${formatElapsed(started)} (${pageFetch.attempts} attempt(s))`,
    );
    console.log(`   HTML: ${pageFetch.html.length} bytes`);
    console.log(`   Network JSON payloads: ${pageFetch.networkJsonBodies.length}`);
    console.log(`   Wait selector matched: ${pageFetch.waitSelectorMatched}`);
    if (pageFetch.browserFailed) {
      console.log("   Browser fetch failed; HTTP fallback was used.");
    }

    scrapeOffers = parseKrogerWeeklyAd({
      html: pageFetch.html,
      networkJsonBodies: pageFetch.networkJsonBodies,
    });
    console.log(`   Parsed ${scrapeOffers.length} offer(s) from scrape payloads`);
  } catch (error) {
    console.log(`   FAILED: ${error instanceof Error ? error.message : error}`);
  }

  console.log("\n2) Flipp syndicated weekly-ad feed...");
  let flippOffers = [];
  try {
    flippOffers = await fetchFlippWeeklyAdOffers({
      zipCode,
      merchantName: "Kroger",
    });
    console.log(`   Parsed ${flippOffers.length} offer(s) from Flipp feed`);
  } catch (error) {
    console.log(`   FAILED: ${error instanceof Error ? error.message : error}`);
  }

  console.log("\n3) Official API fallback (if credentials configured)...");
  const apiProbe = await probeKrogerApiSetup(zipCode);
  console.log(`   ${apiProbe.message}`);
  const apiOffers = await fetchKrogerOffersFromOfficialApi({
    zipCode,
    trackedIngredientIds,
  });
  console.log(
    `   ${apiOffers.length} priced offer(s)${apiProbe.pricingAvailable ? "" : " (catalog only; no store prices in this environment)"}`,
  );

  const rawOffers =
    scrapeOffers.length > 0
      ? scrapeOffers
      : flippOffers.length > 0
        ? flippOffers
        : apiOffers;
  const source =
    scrapeOffers.length > 0
      ? "browser/http scrape"
      : flippOffers.length > 0
        ? "Flipp syndicated feed"
        : apiOffers.length > 0
          ? "official API"
          : "none";

  console.log("\n4) Ingredient matching on best available offers...");
  const matched = matchWeeklyAdOffers({
    chain: "kroger",
    storeId: "kroger-mechanicsville",
    sourceUrl: url,
    observedAt: new Date().toISOString(),
    rawOffers,
    trackedIngredientIds,
  });
  const matchedCount = matched.filter((offer) => offer.ingredientId).length;

  console.log(`   Best source: ${source}`);
  console.log(`   Raw offers: ${rawOffers.length}`);
  console.log(`   Matched tracked ingredients: ${matchedCount}`);
  if (rawOffers.length > 0) {
    console.log("   Sample offers:");
    for (const offer of rawOffers.slice(0, 5)) {
      console.log(`   - ${offer.productName} @ $${offer.price}${offer.saleLabel ? ` (${offer.saleLabel})` : ""}`);
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
