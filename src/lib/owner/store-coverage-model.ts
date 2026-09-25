/**
 * Client-safe coverage types and banner filtering.
 * Do not import database, fence, or Node modules from this file.
 */

export type ChainRolloutStage =
  | "ranked"
  | "map_context"
  | "ingest_only"
  | "blocked"
  | "upcoming";

export type ChainRegistryRow = {
  chainId: string;
  displayName: string;
  rolloutStage: ChainRolloutStage;
  shopperRanked: boolean;
  settingsSelectable: boolean;
  weeklyAdEligible: boolean;
  promotionBlocked: boolean;
  flippMerchantName: string | null;
  primaryStoreIdPrefixes: string[];
  nameMatchFragments: string[];
  locationStrategy: string;
  saleDiscoveryStrategy: string;
  officialPricingAdapter: string | null;
  weeklyAdAdapter: string | null;
  sortOrder: number;
  notes: string | null;
};

export type StoreCoverageSourceRow = {
  storeId: string;
  name: string;
  kind: string;
  city: string;
  state: string;
  latitude: number | null;
  longitude: number | null;
  sourceName: string | null;
  sourceStoreId: string | null;
  seen: boolean;
  mapped: boolean;
  freshSaleCount: number;
  lastSaleAt: string | null;
};

export type StoreCoverageRow = StoreCoverageSourceRow & {
  chainId: string;
  chainLabel: string;
  sales: boolean;
  recipeReady: boolean;
  usableInApp: boolean;
  zipCode?: string;
  /** Other catalog names collapsed into this row because they are the same building. */
  samePlaceNote?: string;
};

export type StoreCoverageSummary = {
  chainId: string;
  chainLabel: string;
  rolloutStage: ChainRolloutStage;
  storeCount: number;
  mappedCount: number;
  salesCount: number;
  usableCount: number;
};

export type StoreCoverageUsableFilter = "all" | "yes" | "no";

/** Banners with at least one storefront in the current search. Skips Other / untracked. */
export function visibleTrackedBannerSummaries(
  summaries: readonly StoreCoverageSummary[],
): StoreCoverageSummary[] {
  return summaries.filter(
    (row) => row.chainId !== "unknown" && row.storeCount > 0,
  );
}
