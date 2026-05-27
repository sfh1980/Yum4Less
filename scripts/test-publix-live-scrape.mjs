import { createPublixServicesApiClient } from "../src/lib/providers/publix/publix-services-api-client.ts";
import { buildPublixWeeklyAdUrl } from "../src/lib/weekly-ad-ingestion/publix-weekly-ad-url.ts";
import { resolvePublixStoreForZip } from "../src/lib/weekly-ad-ingestion/publix-weekly-ad-store.ts";
import { fetchPublixWeeklyAdPage } from "../src/lib/weekly-ad-ingestion/publix-weekly-ad-fetcher.ts";
import { parsePublixWeeklyAd, countListedSavingsCardsInHtml } from "../src/lib/weekly-ad-ingestion/parse-publix-weekly-ad.ts";
import { matchWeeklyAdOffers } from "../src/lib/weekly-ad-ingestion/weekly-ad-ingredient-matching.ts";
import { captureWeeklyAdArtifacts } from "../src/lib/weekly-ad-ingestion/weekly-ad-capture.ts";

import { WEEKLY_AD_TRACKED_INGREDIENT_IDS } from "../src/lib/weekly-ad-ingestion/weekly-ad-fixture-ingest.ts";
import { loadEnvLocal } from "./lib/load-env-local.mjs";

loadEnvLocal();

const zipCode = process.env.YUM4LESS_INGEST_ZIP ?? "23111";
const trackedIngredientIds = WEEKLY_AD_TRACKED_INGREDIENT_IDS;

async function main() {
  console.log(`\n=== Publix live scrape test (ZIP ${zipCode}) ===\n`);

  const started = Date.now();
  const api = createPublixServicesApiClient();

  console.log("1) Resolve nearby store...");
  const storeContext = await resolvePublixStoreForZip(zipCode);
  console.log(
    `   ${storeContext.storeName ?? "none"} (${storeContext.storeKey ?? "no store key"})`,
  );

  const url = buildPublixWeeklyAdUrl({ zipCode });
  console.log(`\n2) Browser fetch: ${url}`);
  let pageFetch;
  try {
    pageFetch = await fetchPublixWeeklyAdPage({
      url,
      storeCookie: storeContext.storeCookie,
    });
    console.log(
      `   OK via ${pageFetch.method} in ${formatElapsed(started)} (${pageFetch.attempts} attempt(s))`,
    );
    console.log(`   HTML: ${pageFetch.html.length} bytes`);
    console.log(
      `   Listed savings cards in HTML: ${pageFetch.savingsCardCount ?? countListedSavingsCardsInHtml(pageFetch.html)}`,
    );
    console.log(`   Network JSON payloads: ${pageFetch.networkJsonBodies.length}`);
    if (pageFetch.visitedUrls?.length) {
      console.log(`   Visited URLs: ${pageFetch.visitedUrls.length}`);
      for (const visitedUrl of pageFetch.visitedUrls) {
        console.log(`     - ${visitedUrl}`);
      }
    }
  } catch (error) {
    console.log(`   FAILED: ${error instanceof Error ? error.message : error}`);
  }

  console.log("\n3) Parse offers...");
  const rawOffers = pageFetch
    ? parsePublixWeeklyAd({
        html: pageFetch.html,
        networkJsonBodies: pageFetch.networkJsonBodies,
      })
    : [];
  console.log(`   Parsed ${rawOffers.length} offer(s)`);
  for (const offer of rawOffers.slice(0, 5)) {
    console.log(`   - ${offer.productName} @ $${offer.price}${offer.saleLabel ? ` (${offer.saleLabel})` : ""}`);
  }

  if (pageFetch && (rawOffers.length === 0 || process.env.YUM4LESS_WEEKLY_AD_CAPTURE === "1")) {
    const captureDir = captureWeeklyAdArtifacts({
      chain: "publix",
      zipCode,
      sourceUrl: url,
      html: pageFetch.html,
      networkJsonBodies: pageFetch.networkJsonBodies,
      errorMessage:
        rawOffers.length === 0
          ? "Live Publix scrape parsed zero offers."
          : undefined,
    });
    if (captureDir) {
      console.log(`\n   Captured artifacts: ${captureDir}`);
    } else if (rawOffers.length === 0) {
      console.log(
        "\n   No capture saved. In PowerShell use: $env:YUM4LESS_WEEKLY_AD_CAPTURE=\"1\"",
      );
    }
  }

  console.log("\n4) Ingredient matching...");
  const matched = matchWeeklyAdOffers({
    chain: "publix",
    storeId: "publix-atlee",
    sourceUrl: url,
    observedAt: new Date().toISOString(),
    rawOffers,
    trackedIngredientIds,
  });
  const matchedCount = matched.filter((offer) => offer.ingredientId).length;
  console.log(`   Matched tracked ingredients: ${matchedCount}`);
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
