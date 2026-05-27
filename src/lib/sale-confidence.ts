export type SaleConfidenceLevel =
  | "verified-recent"
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
      note: "This sale label comes from legacy sample pricing data, not a live weekly ad pull. Verify current deals in store before relying on it.",
    };
  }

  if (input.dataSource === "unavailable") {
    return {
      level: "no-sale-data",
      label: "Price unavailable",
      note: "PostgreSQL market data was unavailable, so this line item could not be priced from ingested observations.",
    };
  }

  if (input.freshnessDaysAgo <= 1) {
    return {
      level: "verified-recent",
      label: "Recent advertised sale",
      note: "This item was tagged with a sale label from relatively fresh local data, but weekly ads can change before you shop. Confirm in store or in the chain app.",
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
      note: "This advertised sale is older than a typical weekly ad cycle. Assume the deal may have ended until you verify it.",
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
  priceSource?: string;
  matchConfidence?: number;
}): SaleConfidence {
  const chainLabel = formatWeeklyAdChainLabel(input.priceSource);
  const matchPercent =
    input.matchConfidence !== undefined
      ? `${Math.round(input.matchConfidence * 100)}% ingredient match`
      : "directional ingredient match";
  const weakMatch =
    input.matchConfidence !== undefined && input.matchConfidence < 0.7;

  if (input.saleLabel) {
    return {
      level: weakMatch ? "directional-provider-match" : "advertised-recent",
      label: weakMatch
        ? `Estimated ${chainLabel} weekly ad match`
        : `${chainLabel} weekly ad special — verify in store`,
      note: `This sale came from a scraped ${chainLabel} weekly-ad pull (${matchPercent}). Weekly ads change often, so confirm price and package size in store.`,
    };
  }

  return {
    level: weakMatch ? "directional-provider-match" : "advertised-recent",
    label: weakMatch
      ? `Estimated ${chainLabel} weekly ad price`
      : `${chainLabel} weekly ad price — verify in store`,
    note: `This price came from a scraped ${chainLabel} weekly-ad pull (${matchPercent}). Treat it as directional until you verify the exact product in store.`,
  };
}

function formatWeeklyAdChainLabel(priceSource?: string) {
  if (!priceSource) {
    return "store";
  }

  return priceSource
    .replace(/-weekly-ad-scrape$/, "")
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function getKrogerOfficialSaleConfidence(input: {
  saleLabel?: string;
  freshnessDaysAgo: number;
  matchConfidence?: number;
}): SaleConfidence {
  const matchPercent =
    input.matchConfidence !== undefined
      ? `${Math.round(input.matchConfidence * 100)}% product match`
      : "directional product match";
  const weakMatch =
    input.matchConfidence !== undefined && input.matchConfidence < 0.7;

  if (input.saleLabel) {
    return {
      level: weakMatch ? "directional-provider-match" : "advertised-recent",
      label: weakMatch
        ? "Estimated Kroger promo — verify in store"
        : "Kroger promo — verify in store",
      note: `This promo/sale price came from the official Kroger API path (${matchPercent}). Weekly ads and in-store tags can still differ, so confirm before checkout.`,
    };
  }

  return {
    level: weakMatch ? "directional-provider-match" : "verified-recent",
    label: weakMatch
      ? "Estimated Kroger price — verify in store"
      : "Kroger shelf price — verify in store",
    note: `This price came from the official Kroger API path (${matchPercent}). Confirm the exact product and package size in store before relying on it.`,
  };
}
