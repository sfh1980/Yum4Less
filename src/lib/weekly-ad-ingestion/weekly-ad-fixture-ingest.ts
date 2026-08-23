import { readFileSync } from "node:fs";
import { join } from "node:path";
import { INTERNAL_CATALOG_INGREDIENT_IDS } from "@/lib/internal-catalog";
import {
  matchWeeklyAdOffers,
  weeklyAdMatchFieldsFromIngest,
} from "@/lib/weekly-ad-ingestion/weekly-ad-ingredient-matching";
import { parseWeeklyAdHtml } from "@/lib/weekly-ad-ingestion/parse-weekly-ad-html";
import type {
  WeeklyAdChain,
  WeeklyAdIngestionInput,
  WeeklyAdIngestionResult,
} from "@/lib/weekly-ad-ingestion/weekly-ad-ingestion-types";

export const WEEKLY_AD_TRACKED_INGREDIENT_IDS = INTERNAL_CATALOG_INGREDIENT_IDS;

export function buildWeeklyAdFixtureResult(input: {
  chain: WeeklyAdChain;
  fixtureFileName: string;
  sourceUrl: string;
  label: string;
  fetchedAt: string;
  termsNote: string;
  ingestionInput: WeeklyAdIngestionInput;
}): WeeklyAdIngestionResult {
  const fixturePath = join(
    process.cwd(),
    "src/lib/weekly-ad-ingestion/fixtures",
    input.fixtureFileName,
  );
  const html = readFileSync(fixturePath, "utf8");
  const rawOffers = parseWeeklyAdHtml(html);
  const offers = matchWeeklyAdOffers({
    chain: input.chain,
    storeId: input.ingestionInput.storeId,
    sourceUrl: input.sourceUrl,
    observedAt: input.fetchedAt,
    rawOffers,
    ...weeklyAdMatchFieldsFromIngest(input.ingestionInput),
  });
  const matchedCount = offers.filter((offer) => offer.ingredientId).length;

  return {
    chain: input.chain,
    label: input.label,
    status: "cached",
    provenance: "weekly-ad-scrape",
    retrievalMode: "cached",
    configured: true,
    fallbackUsed: true,
    offers,
    message: `Fixture ${input.chain} weekly-ad run parsed ${rawOffers.length} offer(s) for ${input.ingestionInput.storeName}; ${matchedCount} matched tracked dinner ingredients.`,
    fetchedAt: input.fetchedAt,
    termsNote: input.termsNote,
  };
}
