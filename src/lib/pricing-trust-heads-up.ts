import type { MarketSummary } from "@/lib/recommendation-service";
import type { RankedPricingSource } from "@/lib/price-source-policy";

export type PricingTrustHeadsUp = {
  title: string;
  message: string;
};

const NON_LIVE_RANKED_SOURCES: RankedPricingSource[] = [
  "weekly-ad-cache",
  "official-api-cache",
  "mixed-live-cache",
  "limited-coverage",
];

export function buildPricingTrustHeadsUp(
  market: Pick<
    MarketSummary,
    | "providerStoreSearches"
    | "providerPricingPreviews"
    | "providerCoverageRollup"
    | "lookupSource"
    | "dataSource"
    | "lookupProviderConfigured"
    | "recommendationReadyStoreCount"
  >,
): PricingTrustHeadsUp | null {
  const reasons: string[] = [];

  const hasProviderFallback =
    market.providerStoreSearches.some((search) => search.fallbackUsed) ||
    market.providerPricingPreviews.some((preview) => preview.fallbackUsed);

  const usesLimitedZipLookup =
    market.lookupSource === "seed" ||
    (!market.lookupProviderConfigured && market.lookupSource !== "browser");

  const databaseUnavailable = market.dataSource === "unavailable";

  const rankedPricingSource = market.providerCoverageRollup.rankedPricingSource;
  const usesNonLivePricing =
    market.recommendationReadyStoreCount > 0 &&
    NON_LIVE_RANKED_SOURCES.includes(rankedPricingSource);

  if (databaseUnavailable) {
    reasons.push(
      "Yum4Less could not load saved store prices right now, so map pins and meal totals may be missing or outdated.",
    );
  }

  if (usesLimitedZipLookup) {
    reasons.push(
      "Your area was matched using a limited local ZIP list, so nearby store coverage may be incomplete.",
    );
  }

  if (hasProviderFallback) {
    reasons.push(
      "Some store lookups used saved backup data instead of a fresh store search.",
    );
  }

  if (usesNonLivePricing) {
    reasons.push(
      "Meal prices come from saved weekly ads and recent store prices, not live checkout totals.",
    );
  } else if (
    market.recommendationReadyStoreCount > 0 &&
    rankedPricingSource === "none"
  ) {
    reasons.push("Meal pricing has limited coverage right now.");
  }

  if (reasons.length === 0) {
    return null;
  }

  return {
    title: "Heads up about these prices",
    message: `${reasons.join(" ")} Treat totals as estimates and confirm price, package size, and deals in the store before you buy.`,
  };
}
