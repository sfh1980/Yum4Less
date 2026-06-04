import type {
  MealRecommendation,
  MarketSummary,
} from "@/lib/recommendation-service";
import type { RankedPricingSource } from "@/lib/price-source-policy";

export type MealPriceSourceInput = {
  meal: Pick<
    MealRecommendation,
    "primaryStore" | "storeCount" | "shoppingPlan" | "explanation"
  >;
  market: Pick<MarketSummary, "dataSource" | "providerCoverageRollup">;
};

export type MealPriceSourceSummary = {
  summary: string;
  detail: string;
};

export function buildMealPriceSourceSummary(
  input: MealPriceSourceInput,
): MealPriceSourceSummary {
  const { meal, market } = input;
  const storePhrase = formatStorePhrase(meal);
  const rankedPricingSource = market.providerCoverageRollup.rankedPricingSource;
  const hasDirectionalSaleMatch = meal.shoppingPlan.some(
    (item) => item.saleConfidence.level === "directional-provider-match",
  );
  const explanationNotesOlderPrices =
    /older|directional/i.test(meal.explanation) ||
    meal.shoppingPlan.some((item) =>
      /older|directional|aging|stale/i.test(item.saleConfidence.label),
    );

  if (market.dataSource === "unavailable") {
    return {
      summary:
        "Saved prices unavailable — treat this total as an estimate only.",
      detail:
        "Yum4Less could not load saved store prices for this search. Any totals shown are placeholders or stale estimates — confirm everything in store before you buy.",
    };
  }

  const base = buildRankedSourceCopy(rankedPricingSource, storePhrase);
  let summary = base.summary;

  if (
    hasDirectionalSaleMatch ||
    explanationNotesOlderPrices ||
    rankedPricingSource === "limited-coverage"
  ) {
    summary = ensureDirectionalWording(summary);
  }

  return {
    summary,
    detail: base.detail,
  };
}

export function buildResultsPanelPriceSourceLine(
  market: Pick<MarketSummary, "dataSource" | "providerCoverageRollup">,
): string | null {
  if (market.dataSource === "unavailable") {
    return "Saved store prices are unavailable — meal totals below are estimates only.";
  }

  switch (market.providerCoverageRollup.rankedPricingSource) {
    case "weekly-ad-cache":
      return "Ranked meal totals below use saved weekly-ad prices — not live checkout.";
    case "official-api-cache":
    case "online-cache":
      return "Ranked meal totals below use recently checked online store prices — not live checkout.";
    case "mixed-online-weekly-ad-cache":
      return "Ranked meal totals below use recently checked online prices plus saved weekly ads — not live checkout.";
    case "limited-coverage":
      return "Ranked meal totals below use limited saved prices — treat them as directional estimates.";
    case "none":
      return "Ranked meal totals below have limited price coverage — confirm everything in store.";
    default:
      return null;
  }
}

function buildRankedSourceCopy(
  rankedPricingSource: RankedPricingSource,
  storePhrase: string,
): MealPriceSourceSummary {
  switch (rankedPricingSource) {
    case "weekly-ad-cache":
      return {
        summary: `Saved weekly-ad prices ${storePhrase} — not live checkout; confirm in store.`,
        detail:
          "This total combines ingredient prices from saved weekly-ad pulls for nearby stores on the trusted rollout. Weekly ads change often and are not the same as live checkout — verify price, package size, and deals before you buy.",
      };
    case "official-api-cache":
    case "online-cache":
      return {
        summary: `Recently checked online store prices ${storePhrase} — not live checkout; confirm at the shelf.`,
        detail:
          "This total uses recently checked online store prices from ingested observations. Electronic shelf labels and checkout systems can still change before you shop — verify the exact product and deal before you rely on this estimate.",
      };
    case "mixed-online-weekly-ad-cache":
      return {
        summary: `Recently checked online prices and saved weekly ads ${storePhrase} — not live checkout; confirm in store.`,
        detail:
          "This total mixes recently checked online prices with saved weekly-ad prices from nearby stores on the trusted rollout. Neither source is live checkout — confirm price, package size, and deals in store.",
      };
    case "limited-coverage":
      return {
        summary: `Limited saved prices ${storePhrase} — directional estimate; confirm in store.`,
        detail:
          "Only part of this meal could be priced from saved store data near your search. Treat the total as a directional estimate and confirm every line item in store.",
      };
    case "none":
      return {
        summary: "Limited price coverage — estimates only; confirm in store.",
        detail:
          "Yum4Less does not yet have enough saved store prices near this search to price every ingredient confidently. Treat the total as an estimate and confirm everything in store.",
      };
    default:
      return {
        summary: "Estimated from saved store data — confirm in store.",
        detail:
          "This total comes from saved store pricing data, not live checkout. Verify price, package size, and current deals before you shop.",
      };
  }
}

function formatStorePhrase(
  meal: Pick<MealRecommendation, "primaryStore" | "storeCount" | "shoppingPlan">,
) {
  if (meal.storeCount <= 1) {
    return `at ${meal.primaryStore}`;
  }

  const storeNames = [
    ...new Set(meal.shoppingPlan.map((item) => item.storeName)),
  ];

  if (storeNames.length === 1) {
    return `at ${storeNames[0]}`;
  }

  if (storeNames.length === 2) {
    return `at ${storeNames[0]} and ${storeNames[1]}`;
  }

  return "across nearby stores";
}

function ensureDirectionalWording(summary: string) {
  if (/directional/i.test(summary)) {
    return summary;
  }

  return summary.replace(
    /^Saved /,
    "Directional saved ",
  );
}
