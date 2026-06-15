import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getMarketSearchExperience } from "@/lib/recommendation-service";
import { clearMapSearchOsmCacheForTests } from "@/lib/map-search-osm-cache";
import { buildZip23111RankingSnapshot } from "@/lib/recommendation-service-ranking.fixture";
import { zip23111MechanicsvilleLocation } from "@/lib/recommendation-service-ranking.fixture";

const { buildProviderPricingPreviews, searchOfficialProviderStores, getMarketDataSnapshot } =
  vi.hoisted(() => ({
    buildProviderPricingPreviews: vi.fn(),
    searchOfficialProviderStores: vi.fn(),
    getMarketDataSnapshot: vi.fn(),
  }));

vi.mock("@/lib/provider-pricing-preview-service", () => ({
  buildProviderPricingPreviews,
}));

vi.mock("@/lib/provider-market-service", () => ({
  searchOfficialProviderStores,
}));

vi.mock("@/lib/market-repository", () => ({
  getMarketDataSnapshot,
}));

describe("getMarketSearchExperience map merge", () => {
  beforeEach(() => {
    buildProviderPricingPreviews.mockResolvedValue([]);
    searchOfficialProviderStores.mockResolvedValue([]);
    getMarketDataSnapshot.mockResolvedValue({
      source: "database",
      snapshot: buildZip23111RankingSnapshot(),
    });
    clearMapSearchOsmCacheForTests();
    vi.stubEnv("YUM4LESS_MAP_SPARSE_PIN_THRESHOLD", "999");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("includes provider-discovered Kroger stores on the map when absent from seed DB", async () => {
    searchOfficialProviderStores.mockResolvedValue([
      {
        provider: "kroger",
        label: "Kroger",
        status: "available",
        provenance: "official-api",
        retrievalMode: "cached",
        configured: true,
        fallbackUsed: false,
        stores: [
          {
            provider: "kroger",
            providerStoreId: "08888888",
            name: "Kroger Provider Only",
            city: "Mechanicsville",
            state: "VA",
            latitude: 37.62,
            longitude: -77.35,
          },
        ],
        message: "Cached Kroger stores.",
        fetchedAt: new Date().toISOString(),
      },
    ]);

    const { market } = await getMarketSearchExperience(
      8,
      zip23111MechanicsvilleLocation,
      true,
    );

    expect(market.nearbyStores.some((store) => store.id === "kroger-08888888")).toBe(
      true,
    );
  });

  it("suppresses conflicting OSM Kroger when ingested Kroger is already on the map", async () => {
    const snapshot = buildZip23111RankingSnapshot();
    getMarketDataSnapshot.mockResolvedValue({
      source: "database",
      snapshot: {
        ...snapshot,
        stores: snapshot.stores.filter((store) => store.id === "kroger-mechanicsville"),
      },
    });
    vi.stubEnv("YUM4LESS_MAP_SPARSE_PIN_THRESHOLD", "3");
    vi.stubEnv("YUM4LESS_MAP_CATALOG_FIXTURE", "1");

    const { market } = await getMarketSearchExperience(
      12,
      zip23111MechanicsvilleLocation,
      false,
    );

    const krogerPins = market.nearbyStores.filter((store) => store.chain === "kroger");
    expect(krogerPins.some((store) => store.id === "kroger-mechanicsville")).toBe(true);
    expect(krogerPins.some((store) => store.id.startsWith("osm-"))).toBe(false);
    expect(market.nearbyStores.some((store) => store.id.startsWith("osm-"))).toBe(
      true,
    );
  });

  it("merges SNAP context pins when enabled and DB pins are sparse", async () => {
    getMarketDataSnapshot.mockResolvedValue({
      source: "database",
      snapshot: {
        ...buildZip23111RankingSnapshot(),
        stores: [],
      },
    });
    vi.stubEnv("YUM4LESS_MAP_CATALOG_FIXTURE", "1");
    vi.stubEnv("YUM4LESS_MAP_SNAP_CONTEXT", "1");
    vi.stubEnv("YUM4LESS_SNAP_FIXTURE", "1");

    const { market } = await getMarketSearchExperience(
      12,
      zip23111MechanicsvilleLocation,
      false,
    );

    expect(market.nearbyStores.some((store) => store.id.startsWith("snap-"))).toBe(
      true,
    );
    expect(market.mapDiscoveryNotice).toMatch(/USDA SNAP/i);
  });

  it("merges ephemeral OSM pins when DB pin count is below sparse threshold", async () => {
    getMarketDataSnapshot.mockResolvedValue({
      source: "database",
      snapshot: {
        ...buildZip23111RankingSnapshot(),
        stores: [],
      },
    });
    vi.stubEnv("YUM4LESS_MAP_CATALOG_FIXTURE", "1");

    const { market } = await getMarketSearchExperience(
      12,
      zip23111MechanicsvilleLocation,
      false,
    );

    expect(market.nearbyStores.some((store) => store.id.startsWith("osm-"))).toBe(
      true,
    );
    expect(market.usesEphemeralOsmDiscovery).toBe(true);
    expect(market.mapDiscoveryNotice).toMatch(/OpenStreetMap/i);
  });
});
