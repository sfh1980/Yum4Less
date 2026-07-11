/**
 * Option A Slice 5b — Map pin contract: inherit 5a collapse + expand-aware
 * scope/highlight for stale alias selection (client/server flag mismatch).
 */
import { describe, expect, it } from "vitest";
import {
  buildStoreMapLocationBadge,
  buildStoreMapLocationNote,
  resolveStoreMapLocationProvenance,
} from "@/lib/store-map-location-copy";
import { buildDiscoveryMapModel } from "@/lib/nearby-stores-map-model";
import { filterMapContextCatalogStoresConflictingWithIngestedRankedChains } from "@/lib/map-osm-ranked-chain-policy";
import { MAP_RANKED_CHAIN_DEDUPE_PROXIMITY_MILES } from "@/lib/market-store-catalog-merge";
import type { CatalogStore } from "@/lib/market-catalog-types";
import {
  createLinkedAldiOsmIdentityLookup,
  createLinkedKrogerIdentityLookup,
  FIXTURE_ALDI_CATALOG,
  FIXTURE_ALDI_OSM,
  FIXTURE_KROGER_API,
  FIXTURE_KROGER_SLUG,
} from "@/lib/fixtures/store-identity.fixtures";
import { collapseConfirmedIdentityLinkedCatalogStores } from "@/lib/store-identity-catalog-collapse";
import { createMapPinIdentityLookup } from "@/lib/store-identity-map-lookup";
import {
  filterNearbyStoresBySelectionForMap,
  resolveSelectedMapMarkerId,
  scopeMarketSummaryToSelectedStoresForMap,
} from "@/lib/store-identity-map-pin-resolve";
import { buildTestNearbyStoreSummary, buildTestMarketSummary } from "@/lib/test-fixtures/contract-fixtures";
import type { NearbyStoreSummary } from "@/lib/recommendation-types";

const EXPAND_ON = { YUM4LESS_STORE_IDENTITY_EXPAND: "1" } as const;
const EXPAND_OFF = {} as const;

function withLocationFields(
  store: Partial<NearbyStoreSummary> & Pick<NearbyStoreSummary, "id" | "name">,
): NearbyStoreSummary {
  const locationInput = {
    storeId: store.id,
    sourceName: store.sourceName,
    lastVerifiedAt: store.lastVerifiedAt,
  };

  return buildTestNearbyStoreSummary({
    ...store,
    locationProvenance: resolveStoreMapLocationProvenance(locationInput),
    locationBadge: buildStoreMapLocationBadge(locationInput),
    locationNote: buildStoreMapLocationNote(locationInput),
  });
}

function catalogFromFixture(
  fixture: {
    id: string;
    name: string;
    latitude: number;
    longitude: number;
    sourceSystem: string;
  },
): CatalogStore {
  return {
    id: fixture.id,
    name: fixture.name,
    kind: "grocery",
    city: "Mechanicsville",
    state: "VA",
    latitude: fixture.latitude,
    longitude: fixture.longitude,
    sourceName: fixture.sourceSystem,
  };
}

function nearbyFromFixture(
  fixture: {
    id: string;
    name: string;
    latitude: number;
    longitude: number;
    sourceSystem: string;
  },
  chain: NearbyStoreSummary["chain"],
): NearbyStoreSummary {
  return withLocationFields({
    id: fixture.id,
    name: fixture.name,
    kind: "grocery",
    latitude: fixture.latitude,
    longitude: fixture.longitude,
    distanceMiles: 1,
    chain,
    chainLabel: chain === "kroger" ? "Kroger" : "Aldi",
    rolloutStatus: "weekly-ad-preview",
    recommendationEnabled: true,
    rolloutNote: "test",
    sourceName: fixture.sourceSystem,
  });
}

function bareMarket(nearbyStores: NearbyStoreSummary[]) {
  return buildTestMarketSummary({
    nearbyStores,
    recommendationReadyStoreCount: nearbyStores.filter((s) => s.recommendationEnabled)
      .length,
    searchLatitude: 37.6085,
    searchLongitude: -77.3739,
    lookupSource: "geocodio",
    lookupProviderConfigured: true,
  });
}

describe("Option A Slice 5b — Map pin contract (collapsed model)", () => {
  it("linked Aldi/OSM → one discovery pin at canonical coords (flag ON)", () => {
    const collapsed = collapseConfirmedIdentityLinkedCatalogStores(
      [
        catalogFromFixture(FIXTURE_ALDI_CATALOG),
        catalogFromFixture(FIXTURE_ALDI_OSM),
      ],
      createLinkedAldiOsmIdentityLookup(),
      EXPAND_ON,
    );
    expect(collapsed).toHaveLength(1);

    const nearby = [
      nearbyFromFixture(
        {
          id: collapsed[0]!.id,
          name: collapsed[0]!.name,
          latitude: collapsed[0]!.latitude,
          longitude: collapsed[0]!.longitude,
          sourceSystem: collapsed[0]!.sourceName ?? "aldi-weekly-ad-scrape",
        },
        "aldi",
      ),
    ];
    const model = buildDiscoveryMapModel({
      locationLabel: "Mechanicsville, VA",
      searchLatitude: 37.6085,
      searchLongitude: -77.3739,
      lookupSource: "geocodio",
      radiusMiles: 5,
      nearbyStores: nearby,
    });

    expect(model.stores).toHaveLength(1);
    expect(model.stores[0]?.id).toBe("aldi-mechanicsville");
    expect(model.stores[0]?.latitude).toBe(FIXTURE_ALDI_CATALOG.latitude);
    expect(model.stores[0]?.longitude).toBe(FIXTURE_ALDI_CATALOG.longitude);
  });

  it("linked Kroger → one discovery pin at API/canonical coords (flag ON)", () => {
    const collapsed = collapseConfirmedIdentityLinkedCatalogStores(
      [
        catalogFromFixture(FIXTURE_KROGER_API),
        catalogFromFixture(FIXTURE_KROGER_SLUG),
      ],
      createLinkedKrogerIdentityLookup(),
      EXPAND_ON,
    );
    expect(collapsed).toHaveLength(1);
    expect(collapsed[0]?.id).toBe(FIXTURE_KROGER_API.id);

    const nearby = [
      nearbyFromFixture(
        {
          id: collapsed[0]!.id,
          name: collapsed[0]!.name,
          latitude: collapsed[0]!.latitude,
          longitude: collapsed[0]!.longitude,
          sourceSystem: "kroger-official-api",
        },
        "kroger",
      ),
    ];
    const model = buildDiscoveryMapModel({
      locationLabel: "Mechanicsville, VA",
      searchLatitude: 37.6085,
      searchLongitude: -77.3739,
      lookupSource: "geocodio",
      radiusMiles: 5,
      nearbyStores: nearby,
    });

    expect(model.stores).toHaveLength(1);
    expect(model.stores[0]?.id).toBe("kroger-02900529");
    expect(model.stores[0]?.latitude).toBe(FIXTURE_KROGER_API.latitude);
    expect(model.stores[0]?.longitude).toBe(FIXTURE_KROGER_API.longitude);
  });
});

describe("Option A Slice 5b — stale alias selection gap (flag mismatch)", () => {
  const lookup = createMapPinIdentityLookup();

  it("server expand ON + stale alias client selection → map still shows store (not empty)", () => {
    // Server already collapsed to canonical only (5a side effect).
    const market = bareMarket([
      nearbyFromFixture(FIXTURE_KROGER_API, "kroger"),
    ]);
    // Client still has slug in localStorage / NEXT_PUBLIC lagging.
    const staleSelection = [FIXTURE_KROGER_SLUG.id];

    const exactEmpty = filterNearbyStoresBySelectionForMap(
      market.nearbyStores,
      staleSelection,
      { identityLookup: lookup, env: EXPAND_OFF },
    );
    expect(exactEmpty).toHaveLength(0);

    const scoped = scopeMarketSummaryToSelectedStoresForMap(
      market,
      staleSelection,
      { identityLookup: lookup, env: EXPAND_ON },
    );
    expect(scoped.nearbyStores).toHaveLength(1);
    expect(scoped.nearbyStores[0]?.id).toBe(FIXTURE_KROGER_API.id);

    const model = buildDiscoveryMapModel({
      locationLabel: scoped.locationLabel,
      searchLatitude: scoped.searchLatitude,
      searchLongitude: scoped.searchLongitude,
      lookupSource: scoped.lookupSource,
      radiusMiles: scoped.radiusMiles,
      nearbyStores: scoped.nearbyStores,
    });
    expect(model.stores).toHaveLength(1);
    expect(model.stores[0]?.id).toBe("kroger-02900529");
  });

  it("resolveSelectedMapMarkerId maps stale alias highlight to canonical marker", () => {
    const markerIds = [FIXTURE_KROGER_API.id];
    expect(
      resolveSelectedMapMarkerId(FIXTURE_KROGER_SLUG.id, markerIds, {
        identityLookup: lookup,
        env: EXPAND_ON,
      }),
    ).toBe(FIXTURE_KROGER_API.id);

    expect(
      resolveSelectedMapMarkerId(FIXTURE_KROGER_SLUG.id, markerIds, {
        identityLookup: lookup,
        env: EXPAND_OFF,
      }),
    ).toBeUndefined();
  });

  it("flag OFF both sides → exact-id empty when selection is alias and market is canonical", () => {
    const market = bareMarket([
      nearbyFromFixture(FIXTURE_KROGER_API, "kroger"),
    ]);
    const scoped = scopeMarketSummaryToSelectedStoresForMap(
      market,
      [FIXTURE_KROGER_SLUG.id],
      { identityLookup: lookup, env: EXPAND_OFF },
    );
    expect(scoped.nearbyStores).toHaveLength(0);
  });
});

describe("Option A Slice 5b — OSM 1.5 mi suppress regressions (unlinked, unmodified)", () => {
  const ingestedAldi: CatalogStore = {
    id: "aldi-mechanicsville",
    name: "Aldi",
    kind: "grocery",
    city: "Mechanicsville",
    state: "VA",
    latitude: FIXTURE_ALDI_CATALOG.latitude,
    longitude: FIXTURE_ALDI_CATALOG.longitude,
    sourceName: "aldi-weekly-ad-scrape",
  };

  it("unlinked OSM within 1.5 mi still suppressed", () => {
    const unlinkedNearOsm: CatalogStore = {
      id: "osm-node-9990001",
      name: "ALDI",
      kind: "grocery",
      city: "Mechanicsville",
      state: "VA",
      latitude: FIXTURE_ALDI_CATALOG.latitude + 0.001,
      longitude: FIXTURE_ALDI_CATALOG.longitude,
      sourceName: "openstreetmap-overpass",
    };

    const result = filterMapContextCatalogStoresConflictingWithIngestedRankedChains(
      [ingestedAldi],
      [unlinkedNearOsm],
      MAP_RANKED_CHAIN_DEDUPE_PROXIMITY_MILES,
    );
    expect(result.suppressedCount).toBe(1);
    expect(result.kept).toHaveLength(0);
  });

  it("unlinked OSM outside 1.5 mi still present", () => {
    const unlinkedFarOsm: CatalogStore = {
      id: "osm-node-9990002",
      name: "ALDI",
      kind: "grocery",
      city: "Mechanicsville",
      state: "VA",
      latitude: FIXTURE_ALDI_CATALOG.latitude + 0.03,
      longitude: FIXTURE_ALDI_CATALOG.longitude,
      sourceName: "openstreetmap-overpass",
    };

    const result = filterMapContextCatalogStoresConflictingWithIngestedRankedChains(
      [ingestedAldi],
      [unlinkedFarOsm],
      MAP_RANKED_CHAIN_DEDUPE_PROXIMITY_MILES,
    );
    expect(result.suppressedCount).toBe(0);
    expect(result.kept.map((store) => store.id)).toEqual(["osm-node-9990002"]);
  });
});
