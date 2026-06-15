import { describe, expect, it } from "vitest";
import { findNearestOsmAldiStore } from "@/lib/aldi-location-discovery";
import { fixtureOsmFoodRetailStores23111 } from "@/lib/fixtures/osm-food-retail.fixtures";

describe("aldi-location-discovery", () => {
  it("finds the nearest OSM Aldi store to a search anchor", () => {
    const nearest = findNearestOsmAldiStore(fixtureOsmFoodRetailStores23111, {
      latitude: 37.6085,
      longitude: -77.3321,
    });

    expect(nearest?.name).toBe("Aldi");
    expect(nearest?.osmId).toBe(900007);
  });
});
