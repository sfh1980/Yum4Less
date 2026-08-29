import { describe, expect, it, vi } from "vitest";
import {
  buildOsmCatalogStoreId,
  discoverFoodRetailStoresNearLocation,
  GROCERY_OSM_SHOP_TAG_ALLOWLIST,
  isAllowedGroceryOsmShopTag,
  parseOverpassElements,
  resolveOsmAddressLocality,
  resolveOsmFoodRetailDisplayName,
  resolveOverpassEndpoints,
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
    expect(buildOsmCatalogStoreId(result.stores[0]!, { fixture: true })).toMatch(
      /^fixture-osm-(node|way)-\d+$/,
    );
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

  it("filters fixture OSM by search coordinates when ZIP is omitted", async () => {
    const near = await discoverFoodRetailStoresNearLocation({
      latitude: 37.6085,
      longitude: -77.3321,
      radiusMiles: 12,
      useFixture: true,
    });
    expect(near.stores.length).toBeGreaterThan(0);

    const far = await discoverFoodRetailStoresNearLocation({
      latitude: 33.75,
      longitude: -84.39,
      radiusMiles: 8,
      useFixture: true,
    });
    expect(far.stores).toHaveLength(0);
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

  it("honors YUM4LESS_OSM_OVERPASS_URL as the first endpoint", () => {
    const previous = process.env.YUM4LESS_OSM_OVERPASS_URL;
    process.env.YUM4LESS_OSM_OVERPASS_URL = "https://overpass.kumi.systems/api/interpreter";

    try {
      expect(resolveOverpassEndpoints()[0]).toBe(
        "https://overpass.kumi.systems/api/interpreter",
      );
    } finally {
      if (previous === undefined) {
        delete process.env.YUM4LESS_OSM_OVERPASS_URL;
      } else {
        process.env.YUM4LESS_OSM_OVERPASS_URL = previous;
      }
    }
  });

  it("retries Overpass fetch on timeout before returning empty stores", async () => {
    const previousAttempts = process.env.YUM4LESS_OSM_OVERPASS_MAX_ATTEMPTS;
    process.env.YUM4LESS_OSM_OVERPASS_MAX_ATTEMPTS = "2";

    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new Error("TimeoutError"))
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          elements: [
            {
              type: "node",
              id: 900001,
              lat: 37.61,
              lon: -77.33,
              tags: {
                brand: "Aldi",
                shop: "supermarket",
                "addr:city": "Mechanicsville",
                "addr:state": "VA",
              },
            },
          ],
        }),
      });

    vi.stubGlobal("fetch", fetchMock);

    try {
      const result = await discoverFoodRetailStoresNearLocation({
        latitude: 37.6085,
        longitude: -77.3321,
        radiusMiles: 5,
        zipCode: "23112",
        useFixture: false,
      });

      expect(fetchMock.mock.calls.length).toBeGreaterThanOrEqual(2);
      expect(result.stores.some((store) => store.name === "Aldi")).toBe(true);
    } finally {
      vi.unstubAllGlobals();
      if (previousAttempts === undefined) {
        delete process.env.YUM4LESS_OSM_OVERPASS_MAX_ATTEMPTS;
      } else {
        process.env.YUM4LESS_OSM_OVERPASS_MAX_ATTEMPTS = previousAttempts;
      }
    }
  });

  it("reads town/suburb tags and leaves missing OSM address blank instead of Unknown", () => {
    expect(resolveOsmAddressLocality({ "addr:town": "Ashland", "addr:state": "VA" })).toEqual(
      { city: "Ashland", state: "VA" },
    );
    expect(resolveOsmAddressLocality({})).toEqual({ city: "", state: "" });

    const stores = parseOverpassElements({
      elements: [
        {
          type: "node",
          id: 800010,
          lat: 37.61,
          lon: -77.33,
          tags: { name: "7-Eleven", shop: "convenience" },
        },
      ],
    });

    expect(stores).toHaveLength(1);
    expect(stores[0]?.city).toBe("");
    expect(stores[0]?.state).toBe("");
  });
});
