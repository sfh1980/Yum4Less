import { getDistanceMiles } from "@/lib/geo-distance";
import { collapseSameChainCollocatedCatalogStores } from "@/lib/catalog-store-colocated-identity";
import {
  FIXTURE_CHAIN_MEMBERSHIP,
  isSettingsSelectableChain,
  membershipFromShopperRankedIds,
  type ChainMembershipSnapshot,
} from "@/lib/chain-membership";
import {
  isConvenienceOrBakeryPin,
  isPharmacyPin,
} from "@/lib/owner/owner-market-admission";
import {
  isFixtureOsmCatalogSource,
  isFixtureOsmStoreId,
  isLiveOsmStoreId,
  isNonLiveOsmCatalogIdentity,
} from "@/lib/osm-food-retail-discovery";
import type { NearbyStoreSummary } from "@/lib/recommendation-types";

/** Keep aligned with MAP_RANKED_CHAIN_DEDUPE_PROXIMITY_MILES in market-store-catalog-merge.ts */
const SETTINGS_RANKED_CHAIN_DEDUPE_MILES = 1.5;

export function membershipFromMarket(market: {
  shopperRankedChainIds?: readonly string[];
} | null | undefined): ChainMembershipSnapshot {
  if (!market || market.shopperRankedChainIds === undefined) {
    return FIXTURE_CHAIN_MEMBERSHIP;
  }

  return membershipFromShopperRankedIds(market.shopperRankedChainIds);
}

export { SETTINGS_SELECTABLE_CHAINS } from "@/lib/chain-rollout-policy";

function isLiveOsmSelectableStoreId(storeId: string): boolean {
  return isLiveOsmStoreId(storeId);
}

function isShopperExcludedMapFixture(store: NearbyStoreSummary): boolean {
  return (
    isFixtureOsmStoreId(store.id) ||
    isFixtureOsmCatalogSource(store.sourceName) ||
    isNonLiveOsmCatalogIdentity({ id: store.id, sourceName: store.sourceName })
  );
}

function osmStoreConflictsWithCatalogPin(
  osmStore: NearbyStoreSummary,
  catalogStores: NearbyStoreSummary[],
  proximityMiles = SETTINGS_RANKED_CHAIN_DEDUPE_MILES,
): boolean {
  return catalogStores.some(
    (catalogStore) =>
      getDistanceMiles(
        catalogStore.latitude,
        catalogStore.longitude,
        osmStore.latitude,
        osmStore.longitude,
      ) <= proximityMiles,
  );
}

function settingsDedupeKey(store: NearbyStoreSummary): string {
  if (store.chain !== "unknown") {
    return store.chain;
  }
  return `name:${store.name.trim().toLowerCase()}`;
}

function isShopperSettingsGroceryPin(store: NearbyStoreSummary): boolean {
  if (isShopperExcludedMapFixture(store)) {
    return false;
  }
  if (
    isConvenienceOrBakeryPin({
      name: store.name,
      kind: store.kind,
    })
  ) {
    return false;
  }
  if (isPharmacyPin(store.name)) {
    return false;
  }
  return true;
}

function orderedDedupeKeys(
  stores: NearbyStoreSummary[],
  membership: ChainMembershipSnapshot,
): string[] {
  const present = new Set(stores.map(settingsDedupeKey));
  const ranked = membership.shopperRankedChainIds.filter((chain) =>
    present.has(chain),
  );
  const rest = [...present]
    .filter((key) => !isSettingsSelectableChain(membership, key))
    .sort();
  return [...ranked, ...rest];
}

/**
 * Stores eligible for the Settings / wizard picker — grocery and food-capable
 * pins in radius, not the TypeScript ranked-chain allowlist. Omit convenience,
 * bakeries, pharmacies, and map fixtures. Per dedupe key, keep catalog rows and
 * include live OSM pins unless a catalog row is already within 1.5 mi.
 * Dinner estimates still require recommendationEnabled / promotion floors.
 */
export function filterSettingsSelectableStores(
  stores: NearbyStoreSummary[],
  membership: ChainMembershipSnapshot = FIXTURE_CHAIN_MEMBERSHIP,
): NearbyStoreSummary[] {
  const groceryStores = stores.filter(isShopperSettingsGroceryPin);

  if (groceryStores.length === 0) {
    return [];
  }

  const pool: NearbyStoreSummary[] = [];

  for (const key of orderedDedupeKeys(groceryStores, membership)) {
    const chainStores = groceryStores.filter(
      (store) => settingsDedupeKey(store) === key,
    );
    if (chainStores.length === 0) {
      continue;
    }

    const catalogStores = chainStores.filter(
      (store) => !isLiveOsmSelectableStoreId(store.id),
    );
    const osmStores = chainStores.filter((store) =>
      isLiveOsmSelectableStoreId(store.id),
    );

    pool.push(...catalogStores);

    for (const osmStore of osmStores) {
      if (!osmStoreConflictsWithCatalogPin(osmStore, catalogStores)) {
        pool.push(osmStore);
      }
    }
  }

  return collapseSameChainCollocatedCatalogStores(
    [...pool].sort((left, right) => left.distanceMiles - right.distanceMiles),
  );
}

export function defaultSelectedStoreIdsForSettings(
  stores: NearbyStoreSummary[],
  shoppingStyle: "single-store" | "multi-store",
  membership: ChainMembershipSnapshot = FIXTURE_CHAIN_MEMBERSHIP,
): string[] {
  const selectable = filterSettingsSelectableStores(stores, membership);
  const preferred =
    selectable.find((store) => store.recommendationEnabled) ?? selectable[0];

  if (shoppingStyle === "single-store") {
    return preferred ? [preferred.id] : [];
  }

  const enabled = selectable.filter((store) => store.recommendationEnabled);
  if (enabled.length > 0) {
    return enabled.map((store) => store.id);
  }

  return selectable.map((store) => store.id);
}
