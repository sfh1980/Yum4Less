import { describe, expect, it } from "vitest";
import {
  buildOsmCatalogStoreId,
  discoverFoodRetailStoresNearLocation,
} from "@/lib/osm-food-retail-discovery";

describe("osm food retail discovery", () => {
  it("returns deterministic fixture stores near ZIP 23111", async () => {
    const result = await discoverFoodRetailStoresNearLocation({
      latitude: 37.6085,
      longitude: -77.3321,
      radiusMiles: 12,
      zipCode: "23111",
      useFixture: true,
    });

    expect(result.source).toBe("fixture");
    expect(result.stores.length).toBeGreaterThan(0);
    expect(result.stores.some((store) => store.name.includes("Costco"))).toBe(true);
    expect(buildOsmCatalogStoreId(result.stores[0]!)).toMatch(/^osm-(node|way)-\d+$/);
  });

  it("returns no fixture stores outside the known fixture ZIP", async () => {
    const result = await discoverFoodRetailStoresNearLocation({
      latitude: 33.75,
      longitude: -84.39,
      radiusMiles: 8,
      zipCode: "30301",
      useFixture: true,
    });

    expect(result.stores).toHaveLength(0);
  });
});
