import { resolveRequiredProbeZipCode } from "../src/lib/ingest-zip-codes.ts";
import { loadEnvLocal } from "./lib/load-env-local.mjs";
import { resolveFlippWeeklyAdOffersForChain } from "../src/lib/weekly-ad-ingestion/flipp-weekly-ad-resolver.ts";
import { mergeWeeklyAdRawOffers } from "../src/lib/weekly-ad-ingestion/flipp-weekly-ad-feed.ts";
import { loadWeeklyAdMatchCatalog } from "../src/lib/weekly-ad-ingestion/weekly-ad-match-catalog.ts";
import { flyerLineLooksLikeJunk } from "../src/lib/weekly-ad-ingestion/weekly-ad-junk-heuristics.ts";
import { parseWalmartWeeklyAd } from "../src/lib/weekly-ad-ingestion/parse-walmart-weekly-ad.ts";
import { fetchWalmartWeeklyAdPage } from "../src/lib/weekly-ad-ingestion/walmart-weekly-ad-fetcher.ts";
import { buildWalmartWeeklyAdUrl } from "../src/lib/weekly-ad-ingestion/walmart-weekly-ad-url.ts";
import { classifyWeeklyAdFlyerLine } from "../src/lib/weekly-ad-ingestion/classify-weekly-ad-flyer-line.ts";

loadEnvLocal();

const zipCode = resolveRequiredProbeZipCode();

function tally(offers, catalog) {
  let junk = 0;
  let match = 0;
  let review = 0;
  let autoCreate = 0;
  let skipTable = 0;
  const matches = [];
  const reviews = [];
  for (const offer of offers) {
    if (flyerLineLooksLikeJunk(offer.productName)) {
      junk += 1;
      continue;
    }
    const [classification] = classifyWeeklyAdFlyerLine({
      productName: offer.productName,
      chain: "walmart",
      catalog,
    });
    if (classification?.action === "match") {
      match += 1;
      matches.push(`${offer.productName} → ${classification.ingredientId}`);
    } else if (classification?.action === "auto-create") {
      autoCreate += 1;
    } else if (classification?.action === "review") {
      review += 1;
      if (reviews.length < 8) {
        reviews.push(offer.productName);
      }
    } else if (classification?.action === "skip") {
      skipTable += 1;
    }
  }
  return { junk, match, autoCreate, review, skipTable, total: offers.length, matches, reviews };
}

async function main() {
  if (process.env.YUM4LESS_WEEKLY_AD_FIXTURE === "1") {
    console.error("Refusing fixture mode. Unset YUM4LESS_WEEKLY_AD_FIXTURE for a live probe.");
    process.exit(1);
  }

  const catalog = await loadWeeklyAdMatchCatalog();
  const trackedIngredientIds = catalog.ingredients.map((ingredient) => ingredient.id);
  const sourceUrl = buildWalmartWeeklyAdUrl({
    storeId: process.env.WALMART_STORE_ID?.trim(),
  });

  console.log(`\n=== Live Walmart Flipp + scrape (ZIP ${zipCode}, no persist) ===`);
  console.log(`Catalog foods: ${trackedIngredientIds.length} (Postgres when DATABASE_URL is set)`);
  console.log(`Source URL: ${sourceUrl}\n`);

  const started = Date.now();

  console.log("1) Flipp grocery-first resolver...");
  const flippResult = await resolveFlippWeeklyAdOffersForChain({
    chain: "walmart",
    zipCode,
    merchantName: "Walmart",
    trackedIngredientIds,
    catalogIngredients: catalog.ingredients,
    extraSearchTermsByIngredientId: catalog.extraSearchTermsByIngredientId,
  });
  console.log(`   ${flippResult.retrievalLabel}: ${flippResult.rawOffers.length} offer(s)`);

  console.log("\n2) Live weekly-ad page scrape...");
  const pageFetch = await fetchWalmartWeeklyAdPage({ url: sourceUrl });
  const scrapedOffers = parseWalmartWeeklyAd({
    html: pageFetch.html,
    networkJsonBodies: pageFetch.networkJsonBodies,
  });
  console.log(`   ${pageFetch.method} scrape: ${scrapedOffers.length} offer(s)`);

  const merged = mergeWeeklyAdRawOffers(flippResult.rawOffers, scrapedOffers);
  const stats = tally(merged, catalog);
  console.log("\n3) Universal junk / classify (would persist matches only; this probe writes nothing)");
  console.log(
    `   total=${stats.total} junk=${stats.junk} match=${stats.match} auto-create=${stats.autoCreate} review=${stats.review} skip-table=${stats.skipTable}`,
  );
  if (stats.matches.length > 0) {
    console.log("   matches:");
    for (const line of stats.matches) {
      console.log(`     - ${line}`);
    }
  }
  if (stats.reviews.length > 0) {
    console.log("   review sample:");
    for (const line of stats.reviews) {
      console.log(`     - ${line}`);
    }
  }
  console.log(`\n=== Done in ${((Date.now() - started) / 1000).toFixed(1)}s ===\n`);

  process.exit(merged.length > 0 ? 0 : 1);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
