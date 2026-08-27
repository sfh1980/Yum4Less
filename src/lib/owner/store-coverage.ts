import { inferStoreChainFromCatalog } from "@/lib/chain-rollout-policy";

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

export function matchRegistryChainId(
  store: Pick<StoreCoverageSourceRow, "storeId" | "name" | "sourceName">,
  registry: readonly ChainRegistryRow[],
): string {
  const catalogChain = inferStoreChainFromCatalog({
    id: store.storeId,
    name: store.name,
    sourceName: store.sourceName,
  });
  if (catalogChain !== "unknown" && registry.some((row) => row.chainId === catalogChain)) {
    return catalogChain;
  }

  const normalizedName = store.name.trim().toLowerCase();
  const byFragment = registry.find((row) =>
    row.nameMatchFragments.some((fragment) => {
      const needle = fragment.trim().toLowerCase();
      return needle.length > 0 && normalizedName.includes(needle);
    }),
  );
  if (byFragment) {
    return byFragment.chainId;
  }

  return catalogChain === "unknown" ? "unknown" : catalogChain;
}

export function buildStoreCoverageRow(
  store: StoreCoverageSourceRow,
  registry: readonly ChainRegistryRow[],
): StoreCoverageRow {
  const chainId = matchRegistryChainId(store, registry);
  const chain = registry.find((row) => row.chainId === chainId);
  const sales = store.freshSaleCount > 0;
  const recipeReady = Boolean(chain?.shopperRanked && sales);

  return {
    ...store,
    chainId,
    chainLabel: chain?.displayName ?? "Other",
    sales,
    recipeReady,
    usableInApp: recipeReady,
  };
}

export function filterStoreCoverageRows(
  rows: readonly StoreCoverageRow[],
  input: {
    nameQuery?: string;
    locationQuery?: string;
    usable?: StoreCoverageUsableFilter;
  },
): StoreCoverageRow[] {
  const nameQuery = input.nameQuery?.trim().toLowerCase() ?? "";
  const locationQuery = input.locationQuery?.trim().toLowerCase() ?? "";
  const usable = input.usable ?? "all";

  return rows.filter((row) => {
    if (usable === "yes" && !row.usableInApp) {
      return false;
    }
    if (usable === "no" && row.usableInApp) {
      return false;
    }
    if (nameQuery) {
      const haystack = `${row.name} ${row.chainLabel} ${row.chainId}`.toLowerCase();
      if (!haystack.includes(nameQuery)) {
        return false;
      }
    }
    if (locationQuery) {
      const haystack = `${row.city} ${row.state}`.toLowerCase();
      if (!haystack.includes(locationQuery)) {
        return false;
      }
    }
    return true;
  });
}

export function summarizeStoreCoverage(
  rows: readonly StoreCoverageRow[],
  registry: readonly ChainRegistryRow[],
): StoreCoverageSummary[] {
  const counts = new Map<string, StoreCoverageSummary>();
  for (const chain of [...registry].sort((a, b) => a.sortOrder - b.sortOrder)) {
    counts.set(chain.chainId, {
      chainId: chain.chainId,
      chainLabel: chain.displayName,
      rolloutStage: chain.rolloutStage,
      storeCount: 0,
      mappedCount: 0,
      salesCount: 0,
      usableCount: 0,
    });
  }

  const unknown: StoreCoverageSummary = {
    chainId: "unknown",
    chainLabel: "Other / untracked",
    rolloutStage: "upcoming",
    storeCount: 0,
    mappedCount: 0,
    salesCount: 0,
    usableCount: 0,
  };
  counts.set("unknown", unknown);

  for (const row of rows) {
    const bucket = counts.get(row.chainId) ?? unknown;
    bucket.storeCount += 1;
    if (row.mapped) {
      bucket.mappedCount += 1;
    }
    if (row.sales) {
      bucket.salesCount += 1;
    }
    if (row.usableInApp) {
      bucket.usableCount += 1;
    }
  }

  if (unknown.storeCount === 0) {
    counts.delete("unknown");
  }

  return [...counts.values()];
}
