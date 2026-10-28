import { describe, expect, it } from "vitest";
import { inferStoreChainFromCatalog } from "@/lib/chain-rollout-policy";
import type { GeoJsonPolygon } from "@/lib/geo/point-in-polygon";
import { storesInsideIngestFence } from "@/lib/ingest/stores-inside-ingest-fence";
import { buildWeeklyAdIngestStoreCandidates } from "@/lib/ingest/weekly-ad-ingest-store-selection";
import { storePassesIngestFence } from "@/lib/market-ingest-fence";
import { filterCatalogStoresNearLocation } from "@/lib/store-catalog-sync";
import { isWeeklyAdChain } from "@/lib/weekly-ad-ingestion/weekly-ad-chain-registry";

const square: GeoJsonPolygon = {
  type: "Polygon",
  coordinates: [
    [
      [-77.5, 37.5],
      [-77.3, 37.5],
      [-77.3, 37.7],
      [-77.5, 37.7],
      [-77.5, 37.5],
    ],
  ],
};

const location = { latitude: 37.6, longitude: -77.4 };
const fence = { ingestMiles: 26, geometry: square };

const catalog = [
  {
    id: "publix-1626",
    name: "Brandy Creek Commons",
    sourceName: "publix-store-locator",
    latitude: 37.61,
    longitude: -77.4,
  },
  {
    id: "publix-1592",
    name: "Harbour Pointe",
    sourceName: "publix-store-locator",
    latitude: 37.61,
    longitude: -77.8,
  },
  {
    id: "osm-node-1",
    name: "Mystery Market",
    sourceName: "openstreetmap-overpass",
    latitude: 37.61,
    longitude: -77.4,
  },
];

/** The filter both callers used before they shared one function. */
function legacyFence<T extends { id: string; latitude: number; longitude: number }>(
  stores: readonly T[],
) {
  return filterCatalogStoresNearLocation([...stores], location, fence.ingestMiles).filter(
    (store) =>
      storePassesIngestFence({
        latitude: store.latitude,
        longitude: store.longitude,
        center: location,
        fence,
      }),
  );
}

describe("storesInsideIngestFence", () => {
  it("matches the weekly-ad fence and the morning-note fence on the same rows", () => {
    const shared = storesInsideIngestFence({ stores: catalog, location, fence });
    expect(shared.map((store) => store.id)).toEqual(legacyFence(catalog).map((store) => store.id));

    const weeklyAdCandidates = buildWeeklyAdIngestStoreCandidates(catalog);
    const weeklyAdAdmitted = storesInsideIngestFence({
      stores: weeklyAdCandidates,
      location,
      fence,
    });
    expect(weeklyAdAdmitted.map((store) => store.id)).toEqual(
      legacyFence(weeklyAdCandidates).map((store) => store.id),
    );
    expect(weeklyAdAdmitted.map((store) => store.id)).toEqual(["publix-1626"]);

    const morningChains = new Set(
      storesInsideIngestFence({ stores: catalog, location, fence })
        .map((store) => inferStoreChainFromCatalog(store))
        .filter((chain) => isWeeklyAdChain(chain)),
    );
    expect(morningChains).toEqual(new Set(["publix"]));
    expect(shared.map((store) => store.id)).toEqual(["publix-1626", "osm-node-1"]);
  });

  it("keeps a store inside the mile cap when the ZIP has no outline", () => {
    const noOutline = { ingestMiles: 26, geometry: null };
    const admitted = storesInsideIngestFence({
      stores: catalog,
      location,
      fence: noOutline,
    });
    expect(admitted.map((store) => store.id)).toEqual([
      "publix-1626",
      "publix-1592",
      "osm-node-1",
    ]);
  });
});
