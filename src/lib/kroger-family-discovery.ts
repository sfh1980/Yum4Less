import type { ProviderDiscoveredStore } from "@/lib/providers/provider-types";
import { getProviderRolloutForStore } from "@/lib/provider-rollout";

export const DEFAULT_KROGER_LOCATION_SEARCH_LIMIT = 25;
export const MAX_KROGER_LOCATION_SEARCH_LIMIT = 50;

export function resolveKrogerLocationSearchLimit(
  value = process.env.YUM4LESS_KROGER_LOCATION_SEARCH_LIMIT,
): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return DEFAULT_KROGER_LOCATION_SEARCH_LIMIT;
  }

  return Math.min(Math.round(parsed), MAX_KROGER_LOCATION_SEARCH_LIMIT);
}

export function filterKrogerFamilyDiscoveredStores(
  stores: ProviderDiscoveredStore[],
): ProviderDiscoveredStore[] {
  const seen = new Set<string>();

  return stores.filter((store) => {
    if (getProviderRolloutForStore(store.name).chain !== "kroger") {
      return false;
    }

    if (seen.has(store.providerStoreId)) {
      return false;
    }

    seen.add(store.providerStoreId);
    return true;
  });
}
