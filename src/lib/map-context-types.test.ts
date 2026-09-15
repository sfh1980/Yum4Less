import { describe, expect, it } from "vitest";
import type { CatalogStore } from "@/lib/market-catalog-types";
import {
  isMapContextCatalogStore,
  USDA_SNAP_CONTEXT_SOURCE,
} from "@/lib/map-context-types";
import { OSM_MAP_CATALOG_SOURCE } from "@/lib/osm-food-retail-discovery";

function store(partial: Partial<CatalogStore> & Pick<CatalogStore, "id" | "name">): CatalogStore {
  return {
    kind: "grocery",
    city: "Mechanicsville",
    state: "VA",
    latitude: 37.61,
    longitude: -77.34,
    sourceName: "yum4less-internal-catalog",
    ...partial,
  };
}

describe("isMapContextCatalogStore", () => {
  it("treats Publix store-locator pins as ranked catalog (Q1=1B), not map-context", () => {
    expect(
      isMapContextCatalogStore(
        store({
          id: "publix-1626",
          name: "Publix",
          sourceName: "publix-store-locator",
        }),
      ),
    ).toBe(false);
  });

  it("still marks OSM and SNAP pins as map-context", () => {
    expect(
      isMapContextCatalogStore(
        store({
          id: "osm-node-900001",
          name: "Publix",
          sourceName: OSM_MAP_CATALOG_SOURCE,
        }),
      ),
    ).toBe(true);
    expect(
      isMapContextCatalogStore(
        store({
          id: "snap-123",
          name: "Corner Market",
          sourceName: USDA_SNAP_CONTEXT_SOURCE,
        }),
      ),
    ).toBe(true);
  });
});
