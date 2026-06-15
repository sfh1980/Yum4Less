import { describe, expect, it } from "vitest";
import {
  buildOsmCatalogStoreId,
  discoverFoodRetailStoresNearLocation,
  GROCERY_OSM_SHOP_TAG_ALLOWLIST,
  isAllowedGroceryOsmShopTag,
  parseOverpassElements,
  resolveOsmFoodRetailDisplayName,
} from "@/lib/osm-food-retail-discovery";
import { getProviderRolloutForStore } from "@/lib/provider-rollout";

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

  it("prefers brand over missing name for Food Lion-like OSM elements", () => {
    const stores = parseOverpassElements({
      elements: [
        {
          type: "node",
          id: 700001,
          lat: 37.61,
          lon: -77.33,
          tags: {
            brand: "Food Lion",
            shop: "supermarket",
            "addr:city": "Mechanicsville",
            "addr:state": "VA",
          },
        },
      ],
    });

    expect(stores).toHaveLength(1);
    expect(stores[0]?.name).toBe("Food Lion");
    expect(getProviderRolloutForStore(stores[0]!.name).chain).toBe("food-lion");
  });

  it("resolveOsmFoodRetailDisplayName uses brand then operator then name", () => {
    expect(resolveOsmFoodRetailDisplayName({ brand: "Food Lion", name: "FL #1234" })).toBe(
      "Food Lion",
    );
    expect(resolveOsmFoodRetailDisplayName({ operator: "Ahold Delhaize", shop: "supermarket" })).toBe(
      "Ahold Delhaize",
    );
    expect(resolveOsmFoodRetailDisplayName({ name: "Neighborhood Market" })).toBe(
      "Neighborhood Market",
    );
  });

  it("exports a grocery-only shop tag allowlist without general retail tags", () => {
    expect(GROCERY_OSM_SHOP_TAG_ALLOWLIST).toContain("supermarket");
    expect(GROCERY_OSM_SHOP_TAG_ALLOWLIST).not.toContain("department_store");
    expect(GROCERY_OSM_SHOP_TAG_ALLOWLIST).not.toContain("variety_store");
    expect(GROCERY_OSM_SHOP_TAG_ALLOWLIST).not.toContain("general");
    expect(isAllowedGroceryOsmShopTag("supermarket")).toBe(true);
    expect(isAllowedGroceryOsmShopTag("department_store")).toBe(false);
    expect(isAllowedGroceryOsmShopTag("variety_store")).toBe(false);
  });

  it("parseOverpassElements drops non-grocery shop tags like department_store and variety_store", () => {
    const stores = parseOverpassElements({
      elements: [
        {
          type: "node",
          id: 800001,
          lat: 37.6,
          lon: -77.35,
          tags: { name: "Marshalls", shop: "department_store" },
        },
        {
          type: "node",
          id: 800002,
          lat: 37.61,
          lon: -77.35,
          tags: { name: "Five Below", shop: "variety_store" },
        },
        {
          type: "node",
          id: 800003,
          lat: 37.61,
          lon: -77.34,
          tags: { name: "Kohl's", shop: "department_store" },
        },
        {
          type: "node",
          id: 800004,
          lat: 37.61,
          lon: -77.33,
          tags: {
            brand: "Food Lion",
            shop: "supermarket",
            "addr:city": "Mechanicsville",
            "addr:state": "VA",
          },
        },
        {
          type: "node",
          id: 800005,
          lat: 37.62,
          lon: -77.32,
          tags: { name: "Wawa", shop: "convenience" },
        },
      ],
    });

    expect(stores.map((store) => store.name)).toEqual(["Food Lion", "Wawa"]);
    expect(stores.every((store) => isAllowedGroceryOsmShopTag(store.shopTag))).toBe(true);
  });
});
