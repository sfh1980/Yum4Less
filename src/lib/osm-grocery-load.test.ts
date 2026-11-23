import { describe, expect, it } from "vitest";
import { buildStoreMapLocationNote } from "@/lib/store-map-location-copy";
import { buildStoreMapPricingLabel } from "@/lib/store-pricing-status-copy";
import { readPricedAreaCoverageSentence } from "@/lib/priced-area-coverage";
import { getProviderRolloutForCatalogStore } from "@/lib/provider-rollout";
import { explainOsmGrocerySkip, parseOsmXml } from "@/lib/osm-grocery-load";
import { mergeOsmGroceryPlaces } from "@/lib/osm-grocery-places";
import { OSM_EXTRACT_SOURCE } from "@/lib/osm-grocery-file";

const FIXTURE = `<?xml version="1.0"?>
<osm>
  <node id="880101" lat="35.3200" lon="-80.8400" timestamp="2026-11-01T00:00:00Z">
    <tag k="shop" v="supermarket"/>
    <tag k="name" v="Fixture Grocery"/>
  </node>
  <node id="880102" lat="35.3201" lon="-80.8401" timestamp="2026-11-01T00:00:00Z">
    <tag k="shop" v="convenience"/>
    <tag k="name" v="Fixture Convenience"/>
  </node>
  <node id="880103" lat="35.3202" lon="-80.8402" timestamp="2026-11-01T00:00:00Z">
    <tag k="amenity" v="fuel"/>
    <tag k="name" v="Fixture Fuel"/>
  </node>
  <node id="880104" lat="35.3210" lon="-80.8410" timestamp="2026-11-01T00:00:00Z">
    <tag k="shop" v="department_store"/>
    <tag k="name" v="Marshalls"/>
  </node>
  <node id="880105" lat="35.3211" lon="-80.8411" timestamp="2026-11-01T00:00:00Z">
    <tag k="shop" v="department_store"/>
    <tag k="name" v="Target"/>
  </node>
  <node id="880110" lat="35.3200" lon="-80.8400" timestamp="2026-11-01T00:00:00Z"/>
  <node id="880111" lat="35.3204" lon="-80.8404" timestamp="2026-11-01T00:00:00Z"/>
  <way id="880201" timestamp="2026-11-01T00:00:00Z">
    <nd ref="880110"/>
    <nd ref="880111"/>
    <tag k="shop" v="bakery"/>
    <tag k="name" v="Fixture Bakery"/>
  </way>
</osm>
`;

describe("osm grocery file filter", () => {
  it("keeps grocery and Target, and never keeps convenience or fuel", () => {
    const extract = parseOsmXml(FIXTURE, new Date("2026-11-01T00:00:00Z"));
    expect(extract.places.map((place) => place.name).sort()).toEqual([
      "Fixture Bakery",
      "Fixture Grocery",
      "Target",
    ]);
    expect(extract.counts.skippedConvenience).toBe(1);
    expect(extract.counts.skippedFuel).toBe(1);
    expect(extract.counts.skippedOther).toBe(1);
    expect(extract.fileTimestamp.toISOString()).toBe("2026-11-01T00:00:00.000Z");
    expect(explainOsmGrocerySkip({
      tags: { shop: "convenience" },
      name: "Shop",
      hasPoint: true,
    })).toBe("convenience");
  });

  it("uses the existing no-price wording and does not duplicate a saved pin", () => {
    const place = {
      id: "osm-node-880101",
      name: "Fixture Grocery",
      kind: "grocery" as const,
      city: "",
      state: "",
      latitude: 35.32,
      longitude: -80.84,
      sourceName: OSM_EXTRACT_SOURCE,
    };
    const rollout = getProviderRolloutForCatalogStore(place);
    expect(rollout.recommendationEnabled).toBe(false);
    expect(
      buildStoreMapPricingLabel({
        recommendationEnabled: rollout.recommendationEnabled,
        rolloutStatus: rollout.status,
        chain: rollout.chain,
      }),
    ).toBe("Available in a future release");
    expect(buildStoreMapLocationNote({ storeId: place.id, sourceName: place.sourceName })).toContain(
      "OpenStreetMap",
    );
    expect(readPricedAreaCoverageSentence({ NODE_ENV: "test" })).toContain(
      "Dinner price estimates are available today",
    );
    const merged = mergeOsmGroceryPlaces(
      [{ ...place, name: "Publix Locator", sourceName: "publix-store-locator" }],
      [place],
    );
    expect(merged).toHaveLength(1);
    expect(merged[0]?.name).toBe("Publix Locator");
    expect(merged[0]?.sourceName).toBe("publix-store-locator");
  });
});
