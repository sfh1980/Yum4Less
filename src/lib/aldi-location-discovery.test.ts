import { describe, expect, it } from "vitest";
import { findNearestOsmAldiStore } from "@/lib/aldi-location-discovery";
import { fixtureOsmFoodRetailStores23111 } from "@/lib/fixtures/osm-food-retail.fixtures";
import type { OsmDiscoveredFoodRetailStore } from "@/lib/osm-food-retail-discovery";

const liveOsmAldiMechanicsville: OsmDiscoveredFoodRetailStore = {
  osmType: "node",
  osmId: 6531578976,
  name: "Aldi",
  kind: "grocery",
  city: "Mechanicsville",
  state: "VA",
  latitude: 37.611004,
  longitude: -77.336853,
  shopTag: "supermarket",
};

describe("aldi-location-discovery", () => {
  it("ignores synthetic fixture Aldi ids for ranked nearest-OSM selection", () => {
    const nearest = findNearestOsmAldiStore(fixtureOsmFoodRetailStores23111, {
      latitude: 37.6085,
      longitude: -77.3321,
    });

    expect(nearest).toBeUndefined();
  });

  it("finds the nearest live OSM Aldi store to a search anchor", () => {
    const nearest = findNearestOsmAldiStore(
      [...fixtureOsmFoodRetailStores23111, liveOsmAldiMechanicsville],
      {
        latitude: 37.6085,
        longitude: -77.3321,
      },
    );

    expect(nearest?.name).toBe("Aldi");
    expect(nearest?.osmId).toBe(6531578976);
  });
});
