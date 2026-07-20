import type { SaleConfidenceLevel } from "@/lib/sale-confidence";
import { getSaleConfidence } from "@/lib/sale-confidence";

/**
 * Shopper-facing confidence buckets mapped from existing `SaleConfidenceLevel`s.
 * Do not invent new thresholds — only group levels already produced by getSaleConfidence.
 *
 * directional-provider-match → low: dollar amounts come from weak product/ingredient
 * matches (matchConfidence < 0.7), so a bare "$X" overclaims precision.
 */
export type ShopperPriceConfidenceTier = "high" | "medium" | "low";

export function shopperPriceTierFromSaleConfidenceLevel(
  level: SaleConfidenceLevel,
): ShopperPriceConfidenceTier {
  switch (level) {
    case "advertised-recent":
      return "high";
    case "advertised-aging":
      return "medium";
    case "advertised-stale":
    case "regular-price":
    case "no-sale-data":
    case "directional-provider-match":
      return "low";
  }
}

/** Worst (lowest-trust) tier across priced shopping-plan lines — pantry lines ignored. */
export function shopperPriceTierFromShoppingPlan(
  items: Array<{
    sourcedFromPantry?: boolean;
    saleConfidence?: { level: SaleConfidenceLevel };
  }>,
): ShopperPriceConfidenceTier {
  const priced = items.filter(
    (item) => !item.sourcedFromPantry && item.saleConfidence,
  );
  if (priced.length === 0) {
    return "low";
  }

  let worst: ShopperPriceConfidenceTier = "high";
  for (const item of priced) {
    const tier = shopperPriceTierFromSaleConfidenceLevel(
      item.saleConfidence!.level,
    );
    if (tier === "low") {
      return "low";
    }
    if (tier === "medium") {
      worst = "medium";
    }
  }
  return worst;
}

/** Derive tier for deals / ingredient-picker rows that still expose raw offer fields. */
export function shopperPriceTierFromOfferFields(input: {
  saleLabel?: string;
  freshnessDaysAgo: number;
  freshnessHoursAgo?: number;
  priceSource?: string;
  matchConfidence?: number;
  /** Coarse fallback when full saleConfidence inputs are missing. */
  trustLabel?: "directional" | "estimated";
}): ShopperPriceConfidenceTier {
  if (input.trustLabel === "directional" && input.priceSource === undefined) {
    return "low";
  }

  return shopperPriceTierFromSaleConfidenceLevel(
    getSaleConfidence({
      saleLabel: input.saleLabel,
      freshnessDaysAgo: input.freshnessDaysAgo,
      freshnessHoursAgo: input.freshnessHoursAgo,
      dataSource: "database",
      priceSource: input.priceSource,
      matchConfidence: input.matchConfidence,
    }).level,
  );
}

export function formatShopperPriceWording(
  amount: number,
  tier: ShopperPriceConfidenceTier,
): string {
  switch (tier) {
    case "high":
      return `Lowest price we found: $${amount.toFixed(2)}`;
    case "medium":
      return `Estimated lowest price: $${amount.toFixed(2)}`;
    case "low":
      return "Price estimate — worth verifying in store";
  }
}
