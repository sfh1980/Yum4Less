import { afterEach, describe, expect, it, vi } from "vitest";
import {
  clearMapSearchOsmCacheForTests,
  discoverOsmStoresForMapSearch,
} from "@/lib/map-search-osm-cache";
import { OSM_OVERPASS_DISABLED_MESSAGE } from "@/lib/osm-food-retail-discovery";

describe("discoverOsmStoresForMapSearch", () => {
  afterEach(() => {
    clearMapSearchOsmCacheForTests();
    vi.unstubAllGlobals();
    delete process.env.YUM4LESS_OSM_OVERPASS_DISABLED;
  });

  it("does not return a cached result or call Overpass when lookup is turned off", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const input = {
      latitude: 37.6085,
      longitude: -77.3321,
      radiusMiles: 8,
      zipCode: "23111",
    };

    const cached = await discoverOsmStoresForMapSearch(input);
    expect(cached.stores.length).toBeGreaterThan(0);

    process.env.YUM4LESS_OSM_OVERPASS_DISABLED = "1";
    const blocked = await discoverOsmStoresForMapSearch(input);

    expect(fetchMock).not.toHaveBeenCalled();
    expect(blocked).toEqual({
      stores: [],
      message: OSM_OVERPASS_DISABLED_MESSAGE,
      source: "openstreetmap-overpass",
      cacheHit: false,
    });
  });
});
