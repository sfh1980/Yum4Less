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
};

const PROVIDER_ROLLOUT: Record<StoreChain, ProviderRolloutEntry> = {
  kroger: {
    chain: "kroger",
    label: "Kroger",
    status: "coming-soon",
    recommendationEnabled: false,
    priority: 1,
    note:
      "Kroger meal prices are not ready for ranked dinners in this area yet. Weekly ad coverage is still building near ZIP 23111.",
  },
  publix: {
    chain: "publix",
    label: "Publix",
    status: "coming-soon",
    recommendationEnabled: false,
    priority: 2,
    note:
      "Publix is an approved next target, but it is not yet active for trusted recommendation pricing in this MVP.",
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
      "Aldi remains a later target and is intentionally hidden from trusted recommendation pricing for now.",
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
      "Food Lion is outside the current trusted rollout path, so it is shown only as nearby-store context.",
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

  if (weeklyAdContext?.weeklyAdPromotionPassed) {
    return {
      ...base,
      status: "weekly-ad-preview",
      recommendationEnabled: true,
      note: `${base.label} meal prices use weekly ad deals (${weeklyAdContext.matchedIngredientCount} matched ingredients). Totals are estimated—verify price, package size, and tags in store before checkout.`,
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
    if (entry.chain === "walmart") {
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

function inferStoreChain(storeName: string): StoreChain {
  const normalized = storeName.trim().toLowerCase();

  if (normalized.includes("kroger")) {
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
