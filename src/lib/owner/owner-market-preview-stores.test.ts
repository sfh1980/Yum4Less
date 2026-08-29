import { describe, expect, it } from "vitest";
import type { CatalogStore } from "@/lib/market-catalog-types";
import {
  applyZipLocalityFallback,
  buildOwnerMarketPreviewList,
  formatOwnerMarketPreviewLine,
} from "@/lib/owner/owner-market-preview-stores";

function catalogStore(
  overrides: Partial<CatalogStore> & Pick<CatalogStore, "id" | "name">,
): CatalogStore {
  return {
    kind: "grocery",
    city: "Mechanicsville",
    state: "VA",
    latitude: 37.6085,
    longitude: -77.3739,
    sourceName: "kroger-official-api",
    ...overrides,
  };
}

describe("owner market preview stores", () => {
  it("lists OSM pins without address tags near the ZIP city", () => {
    expect(
      applyZipLocalityFallback(
        { city: "Unknown", state: "VA" },
        { city: "Mechanicsville", state: "VA" },
      ),
    ).toEqual({
      city: "Mechanicsville",
      state: "VA",
      localityIsApproximate: true,
    });

    expect(
      formatOwnerMarketPreviewLine({
        name: "Food Lion",
        city: "Mechanicsville",
        state: "VA",
        kind: "grocery",
        localityIsApproximate: true,
      }),
    ).toBe("Food Lion · near Mechanicsville, VA");
  });

  it("lists ranked banners before convenience OSM pins", () => {
    const preview = buildOwnerMarketPreviewList({
      catalogStores: [],
      osmStores: [
        {
          id: "osm-node-1",
          name: "7-Eleven",
          city: "",
          state: "",
          kind: "specialty",
          latitude: 37.61,
          longitude: -77.37,
          sourceName: "openstreetmap-overpass",
        },
        {
          id: "osm-node-2",
          name: "Kroger",
          city: "Mechanicsville",
          state: "VA",
          kind: "grocery",
          latitude: 37.608,
          longitude: -77.37,
          sourceName: "openstreetmap-overpass",
        },
      ],
      marketCity: "Mechanicsville",
      marketState: "VA",
      limit: 20,
    });

    expect(preview.stores[0]?.name).toBe("Kroger");
    expect(preview.stores[1]?.name).toBe("7-Eleven");
    expect(preview.stores[1]?.localityIsApproximate).toBe(true);
  });

  it("prefers ingested catalog city/state over a nearby OSM twin", () => {
    const preview = buildOwnerMarketPreviewList({
      catalogStores: [
        catalogStore({
          id: "food-lion-601",
          name: "Food Lion",
          city: "Mechanicsville",
          state: "VA",
          sourceName: "food-lion-weekly-ad-scrape",
        }),
      ],
      osmStores: [
        {
          id: "osm-node-3103220732",
          name: "Food Lion",
          city: "Unknown",
          state: "VA",
          kind: "grocery",
          latitude: 37.6086,
          longitude: -77.374,
          sourceName: "openstreetmap-overpass",
        },
      ],
      marketCity: "Mechanicsville",
      marketState: "VA",
      limit: 20,
    });

    expect(preview.total).toBe(1);
    expect(preview.stores[0]).toMatchObject({
      name: "Food Lion",
      city: "Mechanicsville",
      state: "VA",
      localityIsApproximate: false,
    });
  });
});
