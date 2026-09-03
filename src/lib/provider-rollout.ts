import {
  buildDirectionalRolloutNote,
  inferStoreChainFromCatalog,
  inferStoreChainFromName,
  listProviderCatalogRolloutChains,
  type CatalogStoreChainInput,
} from "@/lib/chain-rollout-policy";
import type { CatalogStore } from "@/lib/market-catalog-types";

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
    note: buildDirectionalRolloutNote("Walmart"),
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
    priority: 5,
    note:
      "Shown on the map for nearby planning — Lidl circulars we can fetch are not bound to this store, so dinner price estimates are not available from Lidl yet.",
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
      "Dollar General dinner estimates use a packaged/pantry weekly ad when this is the main grocery stop nearby and coverage floors pass. Totals are directional estimates from an area circular — verify in store.",
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

export function getProviderRolloutForCatalogStore(
  store: Pick<CatalogStore, "id" | "name" | "sourceName"> | CatalogStoreChainInput,
): ProviderRolloutEntry {
  return PROVIDER_ROLLOUT[inferStoreChainFromCatalog(store)];
}

export function resolveProviderRolloutForStore(
  storeName: string,
  weeklyAdContext?: WeeklyAdRolloutContext,
): ProviderRolloutEntry {
  return resolveProviderRolloutForBase(
    getProviderRolloutForStore(storeName),
    weeklyAdContext,
  );
}

export function resolveProviderRolloutForCatalogStore(
  store: Pick<CatalogStore, "id" | "name" | "sourceName"> | CatalogStoreChainInput,
  weeklyAdContext?: WeeklyAdRolloutContext,
): ProviderRolloutEntry {
  return resolveProviderRolloutForBase(
    getProviderRolloutForCatalogStore(store),
    weeklyAdContext,
  );
}

function resolveProviderRolloutForBase(
  base: ProviderRolloutEntry,
  weeklyAdContext?: WeeklyAdRolloutContext,
): ProviderRolloutEntry {
  if (MEAL_PRICING_COMING_LATER_CHAINS.has(base.chain)) {
    return resolveComingLaterMealPricingRollout(base, weeklyAdContext);
  }

  if (weeklyAdContext?.weeklyAdPromotionPassed) {
    const note =
      base.chain === "dollar-general"
        ? `Dollar General meal prices use a packaged/pantry weekly ad (${weeklyAdContext.matchedIngredientCount} matched ingredients), not a full supermarket. Totals are directional estimates from an area circular — verify price, package size, and tags in store.`
        : `${base.label} meal prices use saved sale prices (${weeklyAdContext.matchedIngredientCount} matched ingredients). Totals are estimated—verify price, package size, and tags in store before checkout.`;
    return {
      ...base,
      status: "weekly-ad-preview",
      recommendationEnabled: true,
      note,
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
    if (MEAL_PRICING_COMING_LATER_CHAINS.has(entry.chain)) {
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

