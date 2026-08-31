import { INTERNAL_CATALOG_INGREDIENT_IDS } from "@/lib/internal-catalog";
import { getCanonicalShopperChainDisplayName } from "@/lib/chain-rollout-policy";
import type { MealRecommendation } from "@/lib/recommendation-types";
import type { NearbyStoreSummary } from "@/lib/recommendation-types";
import type { StoreChain } from "@/lib/provider-rollout";

/** Dinner-tracked ingredient count used for coverage rollups and honesty copy. */
export const TRACKED_DINNER_INGREDIENT_COUNT = INTERNAL_CATALOG_INGREDIENT_IDS.length;

const MULTI_STORE_SKEW_THRESHOLD = 0.6;

export type ChainCoverageDepthEntry = {
  chain: StoreChain;
  chainLabel: string;
  matchedIngredientCount: number;
  totalTrackedIngredientCount: number;
};

export function resolveStoreTrackedMatchCount(
  store: Pick<NearbyStoreSummary, "matchedIngredientCount">,
): number {
  return Math.max(0, store.matchedIngredientCount);
}

export function buildBestChainCoverageDepth(
  stores: readonly Pick<
    NearbyStoreSummary,
    | "chain"
    | "chainLabel"
    | "recommendationEnabled"
    | "matchedIngredientCount"
    | "totalTrackedIngredientCount"
  >[],
): ChainCoverageDepthEntry[] {
  const bestByChain = new Map<StoreChain, ChainCoverageDepthEntry>();

  for (const store of stores) {
    if (!store.recommendationEnabled) {
      continue;
    }

    const matchedIngredientCount = resolveStoreTrackedMatchCount(store);
    const totalTrackedIngredientCount =
      store.totalTrackedIngredientCount > 0
        ? store.totalTrackedIngredientCount
        : TRACKED_DINNER_INGREDIENT_COUNT;
    const existing = bestByChain.get(store.chain);
    if (existing && existing.matchedIngredientCount >= matchedIngredientCount) {
      continue;
    }

    bestByChain.set(store.chain, {
      chain: store.chain,
      chainLabel:
        getCanonicalShopperChainDisplayName(store.chain) ?? store.chainLabel,
      matchedIngredientCount,
      totalTrackedIngredientCount,
    });
  }

  return [...bestByChain.values()].sort((left, right) => {
    if (right.matchedIngredientCount !== left.matchedIngredientCount) {
      return right.matchedIngredientCount - left.matchedIngredientCount;
    }
    return left.chainLabel.localeCompare(right.chainLabel);
  });
}

export function formatChainCoverageRatio(
  matched: number,
  total: number,
): string {
  return `${matched}/${total}`;
}

export function buildChainCoverageDepthLiveSummary(
  stores: readonly Pick<
    NearbyStoreSummary,
    | "chain"
    | "chainLabel"
    | "recommendationEnabled"
    | "matchedIngredientCount"
    | "totalTrackedIngredientCount"
  >[],
): string | null {
  const depthEntries = buildBestChainCoverageDepth(stores);
  if (depthEntries.length === 0) {
    return null;
  }

  const parts = depthEntries.map(
    (entry) =>
      `${entry.chainLabel} ~${formatChainCoverageRatio(entry.matchedIngredientCount, entry.totalTrackedIngredientCount)}`,
  );

  return `Near you this week: ${parts.join(" · ")}.`;
}

export type StoreCoverageHelpModel = {
  trackedIngredientCount: number;
  chains: Array<{
    chainLabel: string;
    matchedIngredientCount: number;
  }>;
  includeMultiStoreNote: boolean;
};

export function buildStoreCoverageHelpModel(
  stores: readonly Pick<
    NearbyStoreSummary,
    | "id"
    | "chain"
    | "chainLabel"
    | "recommendationEnabled"
    | "matchedIngredientCount"
    | "totalTrackedIngredientCount"
  >[],
  selectedStoreIds: readonly string[],
): StoreCoverageHelpModel | null {
  const selectedIdSet = new Set(selectedStoreIds);
  const selectedStores = stores.filter(
    (store) => selectedIdSet.has(store.id) && store.recommendationEnabled,
  );
  const coveragePool =
    selectedStores.length > 0
      ? selectedStores
      : stores.filter((store) => store.recommendationEnabled);

  const depthEntries = buildBestChainCoverageDepth(coveragePool);
  const trackedIngredientCount =
    depthEntries[0]?.totalTrackedIngredientCount ?? TRACKED_DINNER_INGREDIENT_COUNT;

  if (trackedIngredientCount <= 0) {
    return null;
  }

  const selectedDepth = buildBestChainCoverageDepth(selectedStores);

  return {
    trackedIngredientCount,
    chains: selectedDepth.map((entry) => ({
      chainLabel: entry.chainLabel,
      matchedIngredientCount: entry.matchedIngredientCount,
    })),
    includeMultiStoreNote: selectedStores.length >= 2 && selectedDepth.length >= 2,
  };
}

export function formatStoreCoverageHelpParagraphs(
  model: StoreCoverageHelpModel,
): string[] {
  const paragraphs = [
    `Yum4Less currently tracks ${model.trackedIngredientCount} dinner ingredients.`,
  ];

  if (model.chains.length === 0) {
    paragraphs.push(
      "After you choose stores, this note shows how many of those ingredients have estimated sale prices nearby this week.",
    );
  } else {
    paragraphs.push("Near you this week:");
    for (const chain of model.chains) {
      paragraphs.push(
        `${chain.chainLabel} is showing estimated prices for ${chain.matchedIngredientCount} of those ${model.trackedIngredientCount}.`,
      );
    }
  }

  if (model.includeMultiStoreNote) {
    paragraphs.push(
      "If you pick more than one store, we use the lowest estimate we have for each ingredient. Some ingredients only have a price at the store with the most coverage right now.",
    );
  }

  paragraphs.push("These are estimates — check the shelf before you shop.");
  return paragraphs;
}

export function formatStoreCoverageHelpOneLiner(
  model: StoreCoverageHelpModel,
): string {
  if (model.chains.length === 0) {
    return `Yum4Less currently tracks ${model.trackedIngredientCount} dinner ingredients.`;
  }

  const parts = model.chains.map(
    (chain) =>
      `${chain.chainLabel} ~${formatChainCoverageRatio(chain.matchedIngredientCount, model.trackedIngredientCount)}`,
  );
  return `Near you this week: ${parts.join(" · ")}.`;
}

export function buildMultiStoreCoverageSkewReason(input: {
  shoppingStyle: "single-store" | "multi-store";
  nearbyStores: readonly NearbyStoreSummary[];
  selectedStoreIds: readonly string[];
  recommendations: readonly MealRecommendation[];
}): string | null {
  if (input.shoppingStyle !== "multi-store") {
    return null;
  }
  if (input.recommendations.length === 0) {
    return null;
  }

  const selectedIdSet = new Set(input.selectedStoreIds);
  const selectedStores = input.nearbyStores.filter(
    (store) => selectedIdSet.has(store.id) && store.recommendationEnabled,
  );
  if (selectedStores.length < 2) {
    return null;
  }

  const depthEntries = buildBestChainCoverageDepth(selectedStores);
  if (depthEntries.length < 2) {
    return null;
  }

  const storeNameToChain = new Map(
    input.nearbyStores.map((store) => [store.name, store.chain] as const),
  );

  const chainItemCounts = new Map<StoreChain, number>();
  let pricedItemCount = 0;

  for (const meal of input.recommendations) {
    for (const item of meal.shoppingPlan) {
      if (item.sourcedFromPantry) {
        continue;
      }

      const storeName = item.storeName;
      if (!storeName) {
        continue;
      }

      const chain = storeNameToChain.get(storeName);
      if (!chain) {
        continue;
      }

      pricedItemCount += 1;
      chainItemCounts.set(chain, (chainItemCounts.get(chain) ?? 0) + 1);
    }
  }

  if (pricedItemCount === 0) {
    return null;
  }

  const rankedChains = [...chainItemCounts.entries()].sort(
    (left, right) => right[1] - left[1],
  );
  const [dominantChain, dominantCount] = rankedChains[0] ?? [];
  if (!dominantChain || dominantCount / pricedItemCount < MULTI_STORE_SKEW_THRESHOLD) {
    return null;
  }

  const dominantDepth =
    depthEntries.find((entry) => entry.chain === dominantChain)?.matchedIngredientCount ??
    0;
  const otherDepths = depthEntries
    .filter((entry) => entry.chain !== dominantChain)
    .map((entry) => entry.matchedIngredientCount);
  const maxOtherDepth = otherDepths.length > 0 ? Math.max(...otherDepths) : 0;

  if (dominantDepth <= maxOtherDepth) {
    return null;
  }

  const dominantLabel =
    getCanonicalShopperChainDisplayName(dominantChain) ?? dominantChain;

  return `Most ingredients in these plans are priced from ${dominantLabel} because other selected stores have fewer current sale matches — not because they are farther away.`;
}
