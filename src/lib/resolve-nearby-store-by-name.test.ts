import { describe, expect, it } from "vitest";
import { resolveNearbyStoreByName } from "@/lib/resolve-nearby-store-by-name";
import type { NearbyStoreSummary } from "@/lib/recommendation-types";

function buildStore(
  partial: Partial<NearbyStoreSummary> & Pick<NearbyStoreSummary, "id" | "name">,
): NearbyStoreSummary {
  return {
    kind: "grocery",
    latitude: 37.6,
    longitude: -77.3,
    distanceMiles: 1,
    chain: "kroger",
    chainLabel: "Kroger",
    rolloutStatus: "weekly-ad-preview",
    recommendationEnabled: true,
    rolloutNote: "Fixture.",
    locationProvenance: "bootstrap",
    locationBadge: "Catalog coordinates",
    locationNote: "Seed.",
    ...partial,
  };
}

describe("resolveNearbyStoreByName", () => {
  it("returns the only name match", () => {
    const stores = [buildStore({ id: "a", name: "Kroger" })];

    expect(resolveNearbyStoreByName("Kroger", stores)?.id).toBe("a");
  });

  it("disambiguates duplicate names with city/state hints", () => {
    const stores = [
      buildStore({ id: "north", name: "Kroger", city: "Richmond", state: "VA" }),
      buildStore({ id: "south", name: "Kroger", city: "Mechanicsville", state: "VA" }),
    ];

    expect(
      resolveNearbyStoreByName("Kroger", stores, {
        city: "Mechanicsville",
        state: "VA",
      })?.id,
    ).toBe("south");
  });

  it("returns undefined when no name matches", () => {
    const stores = [buildStore({ id: "a", name: "Aldi" })];

    expect(resolveNearbyStoreByName("Kroger", stores)).toBeUndefined();
  });
});
