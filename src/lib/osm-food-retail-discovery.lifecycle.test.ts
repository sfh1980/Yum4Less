import { describe, expect, it } from "vitest";
import {
  isDisusedOrClosedOsmFoodRetailElement,
  parseOverpassElements,
} from "@/lib/osm-food-retail-discovery";

describe("osm-food-retail-discovery lifecycle filters", () => {
  it("rejects disused, abandoned, and closed OSM food retail elements", () => {
    expect(isDisusedOrClosedOsmFoodRetailElement({ disused: "yes" })).toBe(true);
    expect(isDisusedOrClosedOsmFoodRetailElement({ abandoned: "yes" })).toBe(true);
    expect(isDisusedOrClosedOsmFoodRetailElement({ closed: "yes" })).toBe(true);
    expect(
      isDisusedOrClosedOsmFoodRetailElement({ operational_status: "disused" }),
    ).toBe(true);
    expect(isDisusedOrClosedOsmFoodRetailElement({ "was:shop": "supermarket" })).toBe(
      true,
    );
    expect(isDisusedOrClosedOsmFoodRetailElement({ brand: "Kroger", shop: "supermarket" })).toBe(
      false,
    );
  });

  it("drops lifecycle-closed elements during Overpass parsing", () => {
    const stores = parseOverpassElements({
      elements: [
        {
          type: "node",
          id: 1,
          lat: 37.61,
          lon: -77.35,
          tags: { brand: "Food Lion", shop: "supermarket" },
        },
        {
          type: "node",
          id: 2,
          lat: 37.62,
          lon: -77.36,
          tags: { brand: "Closed Market", shop: "supermarket", disused: "yes" },
        },
      ],
    });

    expect(stores).toHaveLength(1);
    expect(stores[0]?.name).toBe("Food Lion");
  });
});
