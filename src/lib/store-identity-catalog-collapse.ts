/**
 * Option A Slice 5a — collapse confirmed identity-linked catalog pins to
 * the canonical member. Proximity-only / OSM-suppress paths stay separate.
 */

import type { CatalogStore } from "@/lib/market-catalog-types";
import {
  isStoreIdentityExpandEnabled,
  type StoreIdentityEnv,
} from "@/lib/store-identity-flags";
import {
  canonicalizeStoreId,
  expandStoreIds,
  type StoreIdentityLookup,
} from "@/lib/store-identity-resolvers";

/**
 * When expand is ON, keep one CatalogStore per confirmed identity (canonical
 * id preferred when present in the list). Flag OFF → passthrough.
 *
 * Does not apply proximity or same-chain OSM suppress — those remain in
 * mergeCatalogStoresForMap / filterMapContextCatalogStoresConflictingWithIngestedRankedChains.
 */
export function collapseConfirmedIdentityLinkedCatalogStores(
  stores: CatalogStore[],
  lookup: StoreIdentityLookup,
  env: StoreIdentityEnv = process.env,
): CatalogStore[] {
  if (!isStoreIdentityExpandEnabled(env)) {
    return [...stores];
  }

  const byId = new Map(stores.map((store) => [store.id, store]));
  const kept: CatalogStore[] = [];
  const seenCanonical = new Set<string>();

  for (const store of stores) {
    const canonicalId = canonicalizeStoreId(lookup, store.id);
    if (seenCanonical.has(canonicalId)) {
      continue;
    }
    seenCanonical.add(canonicalId);

    const members = expandStoreIds(lookup, [store.id]);
    const preferred =
      byId.get(canonicalId) ??
      members.map((id) => byId.get(id)).find((row) => row !== undefined) ??
      store;
    kept.push(preferred);
  }

  return kept;
}
