import {
  buildDirectionalRolloutNote,
  inferStoreChainFromName,
  listProviderCatalogRolloutChains,
} from "@/lib/chain-rollout-policy";

export type StoreChain =
  | "kroger"
  | "publix"
  | "walmart"
  | "aldi"
  | "bjs"
  | "food-lion"
  | "lidl"
  | "trader-joes"
  | "dollar-general"
  | "unknown";

export type ProviderRolloutStatus =
  | "weekly-ad-preview"
  | "official-api-preview"
  | "limited-coverage"
  | "coming-soon";

export type ProviderRolloutEntry = {
  chain: StoreChain;
  label: string;
  status: ProviderRolloutStatus;
  recommendationEnabled: boolean;
  priority: 1 | 2 | 3 | 4 | 5 | 99;
  note: string;
};

export type WeeklyAdRolloutContext = {
  matchedIngredientCount: number;
  usesWeeklyAdSource: boolean;
  weeklyAdPromotionPassed: boolean;
  krogerOfficialApiPromotionPassed?: boolean;
  freshOfficialApiMatchedCount?: number;
};

/** Chains with ingest paths but no honest ranked-meal pricing rollout in beta. */
const MEAL_PRICING_COMING_LATER_CHAINS = new Set<StoreChain>(["lidl"]);

const PROVIDER_ROLLOUT: Record<StoreChain, ProviderRolloutEntry> = {
  kroger: {
    chain: "kroger",
    label: "Kroger",
    status: "coming-soon",
    recommendationEnabled: false,
    priority: 1,
    note: buildDirectionalRolloutNote("Kroger"),
  },
  publix: {
    chain: "publix",
    label: "Publix",
    status: "coming-soon",
    recommendationEnabled: false,
    priority: 2,
    note: buildDirectionalRolloutNote("Publix"),
  },
  walmart: {
    chain: "walmart",
    label: "Walmart",
    status: "coming-soon",
    recommendationEnabled: false,
    priority: 3,
    note:
      "Shown on the map for nearby planning — dinner price estimates are not available from this store yet.",
  },
  aldi: {
    chain: "aldi",
    label: "Aldi",
    status: "coming-soon",
    recommendationEnabled: false,
    priority: 4,
    note: buildDirectionalRolloutNote("Aldi"),
  },
  bjs: {
    chain: "bjs",
    label: "BJ's",
    status: "coming-soon",
    recommendationEnabled: false,
    priority: 5,
    note:
      "Shown on the map for nearby planning — dinner price estimates are not available from this store yet.",
  },
  "food-lion": {
    chain: "food-lion",
    label: "Food Lion",
    status: "coming-soon",
    recommendationEnabled: false,
    priority: 99,
    note: buildDirectionalRolloutNote("Food Lion"),
  },
  lidl: {
    chain: "lidl",
    label: "Lidl",
    status: "coming-soon",
    recommendationEnabled: false,
    priority: 99,
    note:
      "Lidl sale coverage is being rehearsed for Yum4Less, but dinner price estimates are not available from this store yet.",
  },
  "trader-joes": {
    chain: "trader-joes",
    label: "Trader Joe's",
    status: "coming-soon",
    recommendationEnabled: false,
    priority: 99,
    note:
      "Shown on the map for nearby planning — dinner price estimates are not available from this store yet.",
  },
  "dollar-general": {
    chain: "dollar-general",
    label: "Dollar General",
    status: "coming-soon",
    recommendationEnabled: false,
    priority: 99,
    note:
      "Shown on the map for nearby planning — dinner price estimates are not available from this store yet.",
  },
  unknown: {
    chain: "unknown",
    label: "Other stores",
    status: "coming-soon",
    recommendationEnabled: false,
    priority: 99,
    note:
      "Shown on the map for nearby planning — dinner price estimates are not available from this store yet.",
  },
};

export function getProviderRolloutForStore(storeName: string): ProviderRolloutEntry {
  return PROVIDER_ROLLOUT[inferStoreChainFromName(storeName)];
}

export function resolveProviderRolloutForStore(
  storeName: string,
  weeklyAdContext?: WeeklyAdRolloutContext,
): ProviderRolloutEntry {
  const base = getProviderRolloutForStore(storeName);

  if (base.chain === "walmart") {
    return resolveWalmartRollout(base, weeklyAdContext);
  }

  if (MEAL_PRICING_COMING_LATER_CHAINS.has(base.chain)) {
    return resolveComingLaterMealPricingRollout(base, weeklyAdContext);
  }

  if (weeklyAdContext?.weeklyAdPromotionPassed) {
    return {
      ...base,
      status: "weekly-ad-preview",
      recommendationEnabled: true,
      note: `${base.label} meal prices use saved sale prices (${weeklyAdContext.matchedIngredientCount} matched ingredients). Totals are estimated—verify price, package size, and tags in store before checkout.`,
    };
  }

  if (
    base.chain === "kroger" &&
    weeklyAdContext?.krogerOfficialApiPromotionPassed
  ) {
    const freshCount = weeklyAdContext.freshOfficialApiMatchedCount ?? 0;
    return {
      ...base,
      status: "official-api-preview",
      recommendationEnabled: true,
      note: `${base.label} meal prices use recently checked online store prices (${freshCount} fresh ingredient price(s) within 24 hours). Totals are estimated—verify price, package size, and tags in store before checkout.`,
    };
  }

  if (weeklyAdContext?.usesWeeklyAdSource) {
    return {
      ...base,
      status: "limited-coverage",
      recommendationEnabled: false,
      note: `${base.label} has some saved sale prices (${weeklyAdContext.matchedIngredientCount} matched ingredients), but coverage is limited for dinner estimates right now.`,
    };
  }

  return base;
}

export function listResolvedProviderRollout(input?: {
  weeklyAdPromotionByChain?: Partial<Record<StoreChain, WeeklyAdRolloutContext>>;
}): ProviderRolloutEntry[] {
  return listProviderRollout().map((entry) => {
    if (entry.chain === "walmart" || MEAL_PRICING_COMING_LATER_CHAINS.has(entry.chain)) {
      return entry;
    }

    const weeklyAdContext = input?.weeklyAdPromotionByChain?.[entry.chain];
    if (!weeklyAdContext?.weeklyAdPromotionPassed) {
      return entry;
    }

    return {
      ...entry,
      status: "weekly-ad-preview" as const,
      recommendationEnabled: true,
      note: `${entry.label} meal prices can use saved sale prices when nearby stores have enough coverage. Totals are estimated—verify in store before checkout.`,
    };
  });
}

export function listProviderRollout(): ProviderRolloutEntry[] {
  return listProviderCatalogRolloutChains().map((chain) => PROVIDER_ROLLOUT[chain]);
}

function resolveComingLaterMealPricingRollout(
  base: ProviderRolloutEntry,
  weeklyAdContext?: WeeklyAdRolloutContext,
): ProviderRolloutEntry {
  const rehearsalNote =
    weeklyAdContext?.usesWeeklyAdSource
      ? " Saved test prices may exist in development; they are not used for dinner totals."
      : "";

  return {
    ...base,
    status: "coming-soon",
    recommendationEnabled: false,
    note: `${base.note}${rehearsalNote}`,
  };
}

function resolveWalmartRollout(
  base: ProviderRolloutEntry,
  weeklyAdContext?: WeeklyAdRolloutContext,
): ProviderRolloutEntry {
  const rehearsalNote =
    weeklyAdContext?.usesWeeklyAdSource
      ? " Saved test prices may exist in development; they are not live store deals."
      : "";

  return {
    ...base,
    status: "coming-soon",
    recommendationEnabled: false,
    note: `${base.note}${rehearsalNote}`,
  };
}
