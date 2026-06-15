import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clearMapSearchOsmCacheForTests } from "@/lib/map-search-osm-cache";
import { discoverMapContextStores } from "@/lib/map-context-discovery";

describe("discoverMapContextStores", () => {
  beforeEach(() => {
    clearMapSearchOsmCacheForTests();
    vi.stubEnv("YUM4LESS_MAP_CATALOG_FIXTURE", "1");
    vi.stubEnv("YUM4LESS_MAP_SNAP_CONTEXT", "1");
    vi.stubEnv("YUM4LESS_SNAP_FIXTURE", "1");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns OSM and SNAP map-context candidates when both are enabled", async () => {
    const result = await discoverMapContextStores({
      latitude: 37.6085,
      longitude: -77.3321,
      radiusMiles: 12,
      zipCode: "23111",
    });

    expect(result.stores.some((store) => store.id.startsWith("osm-"))).toBe(true);
    expect(result.stores.some((store) => store.id.startsWith("snap-"))).toBe(true);
    expect(result.sources.some((source) => source.source === "fixture")).toBe(true);
    expect(
      result.sources.some((source) => source.source === "usda-snap-retailer-locator"),
    ).toBe(true);
  });

  it("skips SNAP when YUM4LESS_MAP_SNAP_CONTEXT is off", async () => {
    vi.stubEnv("YUM4LESS_MAP_SNAP_CONTEXT", "0");

    const result = await discoverMapContextStores({
      latitude: 37.6085,
      longitude: -77.3321,
      radiusMiles: 12,
      zipCode: "23111",
    });

    expect(result.stores.some((store) => store.id.startsWith("snap-"))).toBe(false);
  });
});
