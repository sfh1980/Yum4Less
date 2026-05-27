import { parseKrogerWeeklyAd } from "@/lib/weekly-ad-ingestion/parse-kroger-weekly-ad";
import type { WeeklyAdRawOffer } from "@/lib/weekly-ad-ingestion/weekly-ad-ingestion-types";

/** Walmart weekly-ad pages expose offers in embedded JSON similar to other retailers. */
export function parseWalmartWeeklyAd(input: {
  html: string;
  networkJsonBodies?: string[];
}): WeeklyAdRawOffer[] {
  return parseKrogerWeeklyAd(input);
}
