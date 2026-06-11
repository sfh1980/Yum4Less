import { describe, expect, it } from "vitest";
import {
  buildAldiCatalogStoreForMarket,
  buildKrogerCatalogStore,
  buildOsmCatalogStore,
  filterCatalogStoresNearLocation,
  findPrimaryStoreIdForChain,
  getCatalogStoreRole,
  isBootstrapCoordinateRefreshEligible,
  isMapContextOnlyCatalogSource,
  parseIngestZipCodesFromEnv,
  resolveIngestRadiusMiles,
} from "@/lib/store-catalog-sync";
import { getProviderRolloutForStore } from "@/lib/provider-rollout";
import type { ProviderDiscoveredStore } from "@/lib/providers/provider-types";
import { fixtureOsmFoodRetailStores23111 } from "@/lib/fixtures/osm-food-retail.fixtures";
import { OSM_MAP_CATALOG_SOURCE } from "@/lib/osm-food-retail-discovery";

describe("store-catalog-sync", () => {
  it("builds stable Kroger catalog ids from provider store ids", () => {
    const discovered: ProviderDiscoveredStore = {
      provider: "kroger",
      providerStoreId: "01400376",
      name: "Kroger Marketplace",
      city: "Atlanta",
      state: "GA",
      latitude: 33.75,
      longitude: -84.39,
    };

    expect(buildKrogerCatalogStore(discovered)).toEqual({
      id: "kroger-01400376",
      name: "Kroger Marketplace",
      kind: "grocery",
      city: "Atlanta",
      state: "GA",
      latitude: 33.75,
      longitude: -84.39,
      sourceName: "kroger-official-api",
      sourceStoreId: "01400376",
    });
  });

  it("builds one Aldi catalog row per ZIP market", () => {
    expect(
      buildAldiCatalogStoreForMarket({
        location: {
          city: "Atlanta",
          state: "GA",
          latitude: 33.75,
          longitude: -84.39,
          source: "geocodio",
          zipCode: "30301",
        },
        zipCode: "30301",
      }).id,
    ).toBe("aldi-30301");
  });

  it("parses ingest ZIP codes from env-style comma lists", () => {
    expect(parseIngestZipCodesFromEnv("30301, 23111")).toEqual([
      "30301",
      "23111",
    ]);
  });

  it("falls back when ingest ZIP env has no valid codes", () => {
    expect(parseIngestZipCodesFromEnv("bad, also-bad")).toEqual(["23111"]);
  });

  it("filters catalog stores to those within the ingest radius of a market anchor", () => {
    const stores = [
      { id: "near", latitude: 37.61, longitude: -77.33 },
      { id: "far", latitude: 33.75, longitude: -84.39 },
    ];

    expect(
      filterCatalogStoresNearLocation(
        stores,
        { latitude: 37.6085, longitude: -77.3321 },
        8,
      ).map((store) => store.id),
    ).toEqual(["near"]);
  });

  it("defaults ingest radius to 8 miles when env is invalid", () => {
    expect(resolveIngestRadiusMiles("0")).toBe(8);
    expect(resolveIngestRadiusMiles("12")).toBe(12);
  });

  it("distinguishes map-context OSM rows from ranked-ready catalog sources", () => {
    expect(isMapContextOnlyCatalogSource(OSM_MAP_CATALOG_SOURCE)).toBe(true);
    expect(getCatalogStoreRole("kroger-official-api")).toBe("ranked-ready");
    expect(getCatalogStoreRole("yum4less-internal-catalog")).toBe("ranked-ready");
  });

  it("builds stable OSM catalog ids and map-context source names", () => {
    const store = buildOsmCatalogStore(fixtureOsmFoodRetailStores23111[0]!);

    expect(store.id).toBe("osm-node-900001");
    expect(store.sourceName).toBe(OSM_MAP_CATALOG_SOURCE);
    expect(isMapContextOnlyCatalogSource(store.sourceName)).toBe(true);
  });

  it("prefers bootstrap seed ids when multiple Kroger rows exist", () => {
    const storeId = findPrimaryStoreIdForChain(
      [
        { id: "kroger-02900529", name: "Kroger", source_name: "kroger-official-api" },
        {
          id: "kroger-mechanicsville",
          name: "Kroger",
          source_name: "yum4less-internal-catalog",
        },
      ],
      "kroger",
      getProviderRolloutForStore,
    );

    expect(storeId).toBe("kroger-mechanicsville");
  });

  it("allows bootstrap coordinate refresh after weekly-ad ingest source names", () => {
    expect(isBootstrapCoordinateRefreshEligible("yum4less-internal-catalog")).toBe(
      true,
    );
    expect(isBootstrapCoordinateRefreshEligible("kroger-weekly-ad-scrape")).toBe(
      true,
    );
    expect(isBootstrapCoordinateRefreshEligible("openstreetmap-overpass")).toBe(
      false,
    );
  });
});
