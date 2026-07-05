export type SaleConfidenceLevel =
  | "advertised-recent"
  | "advertised-aging"
  | "advertised-stale"
  | "regular-price"
  | "no-sale-data"
  | "directional-provider-match";

export type SaleConfidence = {
  level: SaleConfidenceLevel;
  label: string;
  note: string;
};

export function getSaleConfidence(input: {
  saleLabel?: string;
  freshnessDaysAgo: number;
  freshnessHoursAgo?: number;
  dataSource: "database" | "unavailable";
  priceSource?: string;
  matchConfidence?: number;
}): SaleConfidence {
  if (input.priceSource === "kroger-official-api") {
    return getKrogerOfficialSaleConfidence(input);
  }

  if (input.priceSource?.endsWith("-weekly-ad-scrape")) {
    return getWeeklyAdScrapeSaleConfidence(input);
  }

  if (!input.saleLabel) {
    return {
      level: "regular-price",
      label: "Regular price estimate",
      note: "No advertised sale was attached to this line item. Treat the price as a shelf-price estimate, not a confirmed deal.",
    };
  }

  if (input.priceSource === "mock-market-data") {
    return {
      level: "no-sale-data",
      label: "Sample sale reference",
      note: "This sale label comes from sample pricing data, not a live store check. Verify current deals in store before relying on it.",
    };
  }

  if (input.dataSource === "unavailable") {
    return {
      level: "no-sale-data",
      label: "Price unavailable",
      note: "Saved store prices were unavailable, so this line item could not be priced.",
    };
  }

  if (input.freshnessDaysAgo <= 1) {
    return {
      level: "advertised-recent",
      label: "Recent advertised price — verify",
      note: "This item was tagged with a sale label from relatively fresh local data, but prices can change before you shop. Confirm in store.",
    };
  }

  if (input.freshnessDaysAgo <= 3) {
    return {
      level: "advertised-recent",
      label: "Advertised sale (verify)",
      note: "The sale reference is a few days old. The deal may still be active, but it is not guaranteed to be current.",
    };
  }

  if (input.freshnessDaysAgo <= 7) {
    return {
      level: "advertised-aging",
      label: "Aging sale snapshot",
      note: "This advertised sale is older than a typical ad cycle. Assume the deal may have ended until you verify it.",
    };
  }

  return {
    level: "advertised-stale",
    label: "Stale sale reference",
    note: "This sale label is based on old pricing data. Do not assume the item is still on sale.",
  };
}

function getWeeklyAdScrapeSaleConfidence(input: {
  saleLabel?: string;
  freshnessDaysAgo: number;
  freshnessHoursAgo?: number;
  priceSource?: string;
  matchConfidence?: number;
}): SaleConfidence {
  const matchPercent =
    input.matchConfidence !== undefined
      ? `${Math.round(input.matchConfidence * 100)}% ingredient match`
      : "directional ingredient match";
  const weakMatch =
    input.matchConfidence !== undefined && input.matchConfidence < 0.7;
  const staleLevel =
    input.freshnessDaysAgo > 7
      ? "advertised-stale"
      : input.freshnessDaysAgo > 3
        ? "advertised-aging"
        : undefined;

  if (staleLevel) {
    return {
      level: staleLevel,
      label:
        staleLevel === "advertised-stale"
          ? "Stale sale price — estimate only"
          : "Aging sale price — estimate only",
      note: `This price came from saved sale data (${matchPercent}) that is ${input.freshnessDaysAgo} day(s) old. Treat it as an estimate and verify the current shelf tag before shopping.`,
    };
  }

  if (input.saleLabel) {
    return {
      level: weakMatch ? "directional-provider-match" : "advertised-recent",
      label: weakMatch
        ? "Estimated sale match — verify in store"
        : "Sale price — estimate only",
      note: `This sale came from saved store prices (${matchPercent}). Shelf labels can change before you shop, so confirm price and package size in store.`,
    };
  }

  return {
    level: weakMatch ? "directional-provider-match" : "advertised-recent",
    label: weakMatch
      ? "Estimated sale price — verify in store"
      : "Sale price — estimate only",
    note: `This price came from saved store prices (${matchPercent}). Treat it as an estimate until you verify the exact product and shelf tag in store.`,
  };
}

function getKrogerOfficialSaleConfidence(input: {
  saleLabel?: string;
  freshnessDaysAgo: number;
  freshnessHoursAgo?: number;
  matchConfidence?: number;
}): SaleConfidence {
  const matchPercent =
    input.matchConfidence !== undefined
      ? `${Math.round(input.matchConfidence * 100)}% product match`
      : "directional product match";
  const weakMatch =
    input.matchConfidence !== undefined && input.matchConfidence < 0.7;

  const freshnessHours = input.freshnessHoursAgo ?? input.freshnessDaysAgo * 24;
  const freshnessLabel =
    freshnessHours <= 1
      ? "Recently checked"
      : freshnessHours <= 24
        ? "Same-day checked"
        : "Previously checked";

  if (input.saleLabel) {
    return {
      level: weakMatch ? "directional-provider-match" : "advertised-recent",
      label: weakMatch
        ? "Estimated sale — verify in store"
        : `${freshnessLabel} sale price — verify at shelf`,
      note: `This promo/sale price came from recently checked online store data (${matchPercent}). Shelf labels and checkout systems can still change before you shop, so confirm before checkout.`,
    };
  }

  return {
    level: weakMatch ? "directional-provider-match" : "advertised-recent",
    label: weakMatch
      ? "Estimated store price — verify in store"
      : `${freshnessLabel} store price — verify at shelf`,
    note: `This price came from recently checked online store data (${matchPercent}). Treat it as an estimate until you verify the exact product and shelf tag in store.`,
  };
}
