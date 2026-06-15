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
const MEAL_PRICING_COMING_LATER_CHAINS = new Set<StoreChain>([
  "publix",
  "food-lion",
]);

const PROVIDER_ROLLOUT: Record<StoreChain, ProviderRolloutEntry> = {
  kroger: {
    chain: "kroger",
    label: "Kroger",
    status: "coming-soon",
    recommendationEnabled: false,
    priority: 1,
    note:
      "Kroger meal estimates are not ready in this area yet. Weekly-ad or official online coverage is still building.",
  },
  publix: {
    chain: "publix",
    label: "Publix",
    status: "coming-soon",
    recommendationEnabled: false,
    priority: 2,
    note:
      "BETA: Publix meal estimates use weekly-ad deals when ingested near you and promotion gates pass. Totals are directional—verify in store.",
  },
  walmart: {
    chain: "walmart",
    label: "Walmart",
    status: "coming-soon",
    recommendationEnabled: false,
    priority: 3,
    note:
      "Walmart is nearby context only. Live, current weekly-ad pricing from Walmart is not available yet—this store does not feed ranked meal totals.",
  },
  aldi: {
    chain: "aldi",
    label: "Aldi",
    status: "coming-soon",
    recommendationEnabled: false,
    priority: 4,
    note:
      "BETA: Aldi meal estimates use weekly-ad deals when ingested near you and promotion gates pass. Totals are directional—verify in store.",
  },
  bjs: {
    chain: "bjs",
    label: "BJ's",
    status: "coming-soon",
    recommendationEnabled: false,
    priority: 5,
    note:
      "BJ's remains on the later-chain roadmap and is not active for recommendation pricing yet.",
  },
  "food-lion": {
    chain: "food-lion",
    label: "Food Lion",
    status: "coming-soon",
    recommendationEnabled: false,
    priority: 99,
    note:
      "BETA: Food Lion meal estimates use weekly-ad deals when ingested near you and promotion gates pass. Totals are directional—verify in store.",
  },
  lidl: {
    chain: "lidl",
    label: "Lidl",
    status: "coming-soon",
    recommendationEnabled: false,
    priority: 99,
    note:
      "Lidl is outside the current trusted rollout path, so it is shown only as nearby-store context.",
  },
  "trader-joes": {
    chain: "trader-joes",
    label: "Trader Joe's",
    status: "coming-soon",
    recommendationEnabled: false,
    priority: 99,
    note:
      "Trader Joe's is outside the current trusted rollout path, so it is shown only as nearby-store context.",
  },
  "dollar-general": {
    chain: "dollar-general",
    label: "Dollar General",
    status: "coming-soon",
    recommendationEnabled: false,
    priority: 99,
    note:
      "Dollar General is outside the current trusted rollout path, so it is shown only as nearby-store context.",
  },
  unknown: {
    chain: "unknown",
    label: "Other stores",
    status: "coming-soon",
    recommendationEnabled: false,
    priority: 99,
    note:
      "This store is not part of the current trusted pricing rollout, so it is not used for ranked recommendations.",
  },
};

export function getProviderRolloutForStore(storeName: string): ProviderRolloutEntry {
  return PROVIDER_ROLLOUT[inferStoreChain(storeName)];
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
      note: `${base.label} meal prices use weekly ad deals (${weeklyAdContext.matchedIngredientCount} matched ingredients). Totals are estimated—verify price, package size, and tags in store before checkout.`,
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
      note: `${base.label} meal prices use recently checked official Kroger API data (${freshCount} fresh ingredient price(s) within 24 hours). Totals are estimated—verify price, package size, and tags in store before checkout.`,
    };
  }

  if (weeklyAdContext?.usesWeeklyAdSource) {
    return {
      ...base,
      status: "limited-coverage",
      recommendationEnabled: false,
      note: `${base.label} has some weekly ad prices (${weeklyAdContext.matchedIngredientCount} matched ingredients), but coverage is limited for ranked meal pricing right now.`,
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
      note: `${entry.label} meal prices can use weekly ad deals when nearby stores have enough coverage. Totals are estimated—verify in store before checkout.`,
    };
  });
}

export function listProviderRollout(): ProviderRolloutEntry[] {
  return [
    PROVIDER_ROLLOUT.kroger,
    PROVIDER_ROLLOUT.publix,
    PROVIDER_ROLLOUT.walmart,
    PROVIDER_ROLLOUT.aldi,
    PROVIDER_ROLLOUT.bjs,
  ];
}

const KROGER_FAMILY_NAME_MARKERS = [
  "kroger",
  "harris teeter",
  "ralphs",
  "fred meyer",
  "king soopers",
  "smith's",
  "smiths",
  "fry's",
  "frys",
  "qfc",
  "mariano",
  "pick n save",
  "metro market",
  "jay c",
  "food 4 less",
  "food4less",
  "dillons",
  "gerbes",
  "baker's",
  "bakers",
  "city market",
  "pay less",
];

function inferStoreChain(storeName: string): StoreChain {
  const normalized = storeName.trim().toLowerCase();

  if (KROGER_FAMILY_NAME_MARKERS.some((marker) => normalized.includes(marker))) {
    return "kroger";
  }
  if (normalized.includes("publix")) {
    return "publix";
  }
  if (normalized.includes("walmart")) {
    return "walmart";
  }
  if (normalized.includes("aldi")) {
    return "aldi";
  }
  if (normalized.includes("bj")) {
    return "bjs";
  }
  if (normalized.includes("food lion")) {
    return "food-lion";
  }
  if (normalized.includes("lidl")) {
    return "lidl";
  }
  if (normalized.includes("trader joe")) {
    return "trader-joes";
  }
  if (normalized.includes("dollar general")) {
    return "dollar-general";
  }

  return "unknown";
}

function resolveComingLaterMealPricingRollout(
  base: ProviderRolloutEntry,
  weeklyAdContext?: WeeklyAdRolloutContext,
): ProviderRolloutEntry {
  const rehearsalNote =
    weeklyAdContext?.usesWeeklyAdSource
      ? " Rehearsal or fixture weekly-ad rows may exist in development; they are not used for ranked meal totals."
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
      ? " Saved rehearsal or test rows may exist in development, but they are not live Walmart deals."
      : "";

  return {
    ...base,
    status: "coming-soon",
    recommendationEnabled: false,
    note: `${base.note}${rehearsalNote}`,
  };
}
