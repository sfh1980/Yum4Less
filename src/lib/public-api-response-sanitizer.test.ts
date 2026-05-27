import { describe, expect, it } from "vitest";
import { sanitizeMarketSummaryForPublicApi } from "@/lib/public-api-response-sanitizer";
import type { MarketSummary } from "@/lib/recommendation-service";

function buildMarketSummary(overrides: Partial<MarketSummary> = {}): MarketSummary {
  return {
    locationLabel: "Mechanicsville, VA",
    searchLatitude: 37.6085,
    searchLongitude: -77.3321,
    radiusMiles: 5,
    nearbyStores: [],
    recommendationReadyStoreCount: 0,
    providerRollout: [],
    providerStoreSearches: [
      {
        provider: "kroger",
        label: "Kroger official store discovery",
        status: "available",
        provenance: "official-api",
        retrievalMode: "live",
        configured: true,
        fallbackUsed: false,
        stores: [],
        message: "Ready.",
        fetchedAt: "2026-05-20T12:00:00.000Z",
        persistedSnapshotId: 42,
      },
    ],
    providerPricingPreviews: [
      {
        provider: "kroger",
        label: "Kroger official pricing preview",
        status: "available",
        provenance: "official-api",
        retrievalMode: "live",
        configured: true,
        fallbackUsed: false,
        storeName: "Kroger Mechanicsville",
        providerStoreId: "01100479",
        items: [],
        coverageStatus: "limited",
        matchedIngredientCount: 1,
        totalTrackedIngredients: 5,
        message: "Ready.",
        fetchedAt: "2026-05-20T12:00:00.000Z",
        persistedSnapshotId: 99,
      },
    ],
    providerCoverageRollup: {
      providers: [],
      averageMatchConfidence: 0,
      matchedIngredientCount: 0,
      totalTrackedIngredients: 0,
    },
    providerPromotionReadiness: [],
    providerPriceObservationSync: [
      {
        provider: "kroger",
        internalStoreId: "kroger-mechanicsville",
        syncedCount: 3,
        skippedCount: 1,
        retrievalMode: "live",
        message: "Synced rows.",
      },
    ],
    weeklyAdIngestionStatus: [],
    weeklyAdPromotionReadiness: [],
    lookupSource: "seed",
    lookupProviderConfigured: false,
    dataSource: "seed",
    message: "Ready.",
    ...overrides,
  };
}

describe("sanitizeMarketSummaryForPublicApi", () => {
  it("removes persisted snapshot ids and internal store ids from public payloads", () => {
    const sanitized = sanitizeMarketSummaryForPublicApi(buildMarketSummary());

    expect(sanitized.providerStoreSearches[0]).not.toHaveProperty("persistedSnapshotId");
    expect(sanitized.providerPricingPreviews[0]).not.toHaveProperty("persistedSnapshotId");
    expect(sanitized.providerPriceObservationSync[0]).not.toHaveProperty("internalStoreId");
    expect(sanitized.providerPriceObservationSync[0]?.syncedCount).toBe(3);
    expect(sanitized).not.toHaveProperty("message");
  });
});
