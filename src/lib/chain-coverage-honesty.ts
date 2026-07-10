import { INTERNAL_CATALOG_INGREDIENT_IDS } from "@/lib/internal-catalog";
import { getCanonicalShopperChainDisplayName } from "@/lib/chain-rollout-policy";
import type { MealRecommendation } from "@/lib/recommendation-types";
import type { NearbyStoreSummary } from "@/lib/recommendation-types";
import type { StoreChain } from "@/lib/provider-rollout";

/** Dinner-tracked ingredient count used for coverage rollups and honesty copy. */
export const TRACKED_DINNER_INGREDIENT_COUNT = INTERNAL_CATALOG_INGREDIENT_IDS.length;

/** v1 ranked chains surfaced in coverage-honesty copy (excludes Walmart). */
export const RANKED_COVERAGE_HONESTY_CHAINS: readonly StoreChain[] = [
  "kroger",
  "publix",
  "food-lion",
  "aldi",
] as const;

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
    if (!RANKED_COVERAGE_HONESTY_CHAINS.includes(store.chain)) {
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

  return RANKED_COVERAGE_HONESTY_CHAINS.flatMap((chain) => {
    const entry = bestByChain.get(chain);
    return entry ? [entry] : [];
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

export function buildMultiStoreCoverageSummary(
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
): string | null {
  const selectedIdSet = new Set(selectedStoreIds);
  const selectedStores = stores.filter(
    (store) => selectedIdSet.has(store.id) && store.recommendationEnabled,
  );

  if (selectedStores.length < 2) {
    return null;
  }

  const depthEntries = buildBestChainCoverageDepth(selectedStores);
  if (depthEntries.length < 2) {
    return null;
  }

  const parts = depthEntries.map(
    (entry) =>
      `${entry.chainLabel} ~${formatChainCoverageRatio(entry.matchedIngredientCount, entry.totalTrackedIngredientCount)}`,
  );

  return `Sale-price coverage this week near you: ${parts.join(" · ")}. Multi-store picks the lowest estimated priced item per ingredient — many ingredients may only have a price at the chain with the deepest coverage right now.`;
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
