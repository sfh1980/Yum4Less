import { describe, expect, it } from "vitest";
import { fixtureStores } from "@/lib/fixtures/market-catalog.fixtures";
import {
  buildCatalogStoresFromProviderSearches,
  buildProviderDiscoveredCatalogStore,
  MAP_RANKED_CHAIN_DEDUPE_PROXIMITY_MILES,
  mergeCatalogStoresForMap,
} from "@/lib/market-store-catalog-merge";
import type { ProviderStoreSearchResult } from "@/lib/providers/provider-types";

describe("market store catalog merge", () => {
  it("merges provider-discovered Kroger stores absent from seed DB", () => {
    const providerOnly: ProviderStoreSearchResult[] = [
      {
        provider: "kroger",
        label: "Kroger",
        status: "available",
        provenance: "official-api",
        retrievalMode: "cached",
        configured: true,
        fallbackUsed: false,
        stores: [
          {
            provider: "kroger",
            providerStoreId: "09999999",
            name: "Kroger Atlee",
            city: "Mechanicsville",
            state: "VA",
            latitude: 37.615,
            longitude: -77.34,
          },
        ],
        message: "Cached Kroger stores.",
        fetchedAt: new Date().toISOString(),
      },
    ];

    const additions = buildCatalogStoresFromProviderSearches(providerOnly).map(
      (record) => ({
        id: record.id,
        name: record.name,
        kind: record.kind,
        city: record.city,
        state: record.state,
        latitude: record.latitude,
        longitude: record.longitude,
        sourceName: record.sourceName,
      }),
    );

    const merged = mergeCatalogStoresForMap(fixtureStores, additions);
    expect(merged.some((store) => store.id === "kroger-09999999")).toBe(true);
  });

  it("dedupes same-chain provider and bootstrap stores by proximity", () => {
    const seedKroger = fixtureStores.find((store) => store.name.includes("Kroger"));
    expect(seedKroger).toBeDefined();

    const nearDuplicate = buildProviderDiscoveredCatalogStore({
      provider: "kroger",
      providerStoreId: "01400376",
      name: seedKroger!.name,
      city: seedKroger!.city,
      state: seedKroger!.state,
      latitude: seedKroger!.latitude + 0.0001,
      longitude: seedKroger!.longitude + 0.0001,
    });

    const merged = mergeCatalogStoresForMap(fixtureStores, [
      {
        id: nearDuplicate.id,
        name: nearDuplicate.name,
        kind: nearDuplicate.kind,
        city: nearDuplicate.city,
        state: nearDuplicate.state,
        latitude: nearDuplicate.latitude,
        longitude: nearDuplicate.longitude,
        sourceName: nearDuplicate.sourceName,
      },
    ]);

    const krogerPins = merged.filter((store) => store.name.toLowerCase().includes("kroger"));
    expect(krogerPins.length).toBeLessThanOrEqual(fixtureStores.filter((s) => s.name.toLowerCase().includes("kroger")).length + 1);
    expect(merged.length).toBeLessThan(fixtureStores.length + 1);
  });

  it("prefers kroger-official-api coordinates over OSM within ranked dedupe radius", () => {
    const seedKroger = fixtureStores.find((store) => store.id === "kroger-mechanicsville");
    expect(seedKroger).toBeDefined();

    const apiKroger = buildProviderDiscoveredCatalogStore({
      provider: "kroger",
      providerStoreId: "02900529",
      name: "Kroger",
      city: "Mechanicsville",
      state: "VA",
      latitude: 37.6201,
      longitude: -77.345,
    });

    const osmKroger = {
      id: "osm-node-900006",
      name: "Kroger",
      kind: "grocery" as const,
      city: "Mechanicsville",
      state: "VA",
      latitude: 37.6198,
      longitude: -77.3465,
      sourceName: "openstreetmap-overpass",
    };

    const withApi = mergeCatalogStoresForMap(
      [{ ...seedKroger!, sourceName: "yum4less-internal-catalog" }],
      [
        {
          id: apiKroger.id,
          name: apiKroger.name,
          kind: apiKroger.kind,
          city: apiKroger.city,
          state: apiKroger.state,
          latitude: apiKroger.latitude,
          longitude: apiKroger.longitude,
          sourceName: apiKroger.sourceName,
        },
      ],
    );

    const merged = mergeCatalogStoresForMap(withApi, [osmKroger]);
    const krogerPin = merged.find((store) => store.name === "Kroger");

    expect(krogerPin?.sourceName).toBe("kroger-official-api");
    expect(krogerPin?.id).toBe("kroger-02900529");
    expect(merged.some((store) => store.id === "osm-node-900006")).toBe(false);
    expect(MAP_RANKED_CHAIN_DEDUPE_PROXIMITY_MILES).toBeGreaterThanOrEqual(1);
  });
});
