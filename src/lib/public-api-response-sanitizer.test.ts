import { describe, expect, it } from "vitest";
import { sanitizeMarketSummaryForPublicApi } from "@/lib/public-api-response-sanitizer";
import type { MarketSummary } from "@/lib/recommendation-service";
import { buildTestNearbyStoreSummary } from "@/lib/test-fixtures/contract-fixtures";

function buildMarketSummary(overrides: Partial<MarketSummary> = {}): MarketSummary {
  return {
    locationLabel: "Mechanicsville, VA",
    searchLatitude: 37.6085,
    searchLongitude: -77.3321,
    radiusMiles: 5,
    nearbyStores: [
      buildTestNearbyStoreSummary({
        id: "kroger-mechanicsville",
        name: "Kroger Mechanicsville",
        latitude: 37.6085,
        longitude: -77.3321,
        distanceMiles: 1.2,
      }),
    ],
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
        stores: [
          {
            provider: "kroger",
            providerStoreId: "01100479",
            name: "Kroger Mechanicsville",
            city: "Mechanicsville",
            state: "VA",
            latitude: 37.6085,
            longitude: -77.3321,
          },
        ],
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
        items: [
          {
            provider: "kroger",
            ingredientId: "chicken-thighs",
            ingredientName: "Chicken thighs",
            providerProductId: "0001111098765",
            description: "Kroger chicken thighs",
            regularPrice: 7.99,
            promoPrice: 6.49,
            currencyCode: "USD",
            inStock: true,
            matchConfidence: 0.88,
            matchReason: "Name match",
          },
        ],
        coverageStatus: "limited",
        matchedIngredientCount: 1,
        totalTrackedIngredients: 5,
        message: "Ready.",
        fetchedAt: "2026-05-20T12:00:00.000Z",
        persistedSnapshotId: 99,
      },
    ],
    providerCoverageRollup: {
      overallCoverageStatus: "none",
      trustGate: "not-available",
      rankedPricingSource: "none",
      totalTrackedIngredients: 0,
      unmatchedIngredientCount: 0,
      usesCachedPreview: false,
      ingredientSummaries: [],
      message: "No provider preview.",
      averageMatchConfidence: 0,
      matchedIngredientCount: 0,
    },
    providerPromotionReadiness: [],
    providerPriceObservationSync: [
      {
        provider: "kroger",
        internalStoreId: "kroger-mechanicsville",
        syncedCount: 3,
        unchangedCount: 0,
        skippedCount: 1,
        failedCount: 0,
        retrievalMode: "live",
        message:
          "Synced 3 ingredient price observation(s) into PostgreSQL for kroger-mechanicsville.",
      },
    ],
    weeklyAdIngestionStatus: [
      {
        chain: "kroger",
        storeId: "kroger-mechanicsville",
        sourceName: "kroger-weekly-ad",
        observationCount: 6,
        lastCapturedAt: "2026-05-20T12:00:00.000Z",
        message:
          "Latest kroger-weekly-ad rows are available for kroger-mechanicsville.",
      },
    ],
    weeklyAdPromotionReadiness: [
      {
        chain: "kroger",
        chainLabel: "Kroger",
        storeId: "kroger-mechanicsville",
        overallStatus: "ready",
        gatesPassedCount: 5,
        gatesTotalCount: 5,
        gates: [],
        weeklyAdRankedPricingEnabled: true,
        message: "Kroger weekly-ad rows are ready for ranked pricing.",
      },
    ],
    lookupSource: "seed",
    lookupProviderConfigured: false,
    dataSource: "database",
    saleIngredientChoices: [],
    message: "Ready.",
    ...overrides,
  };
}

describe("sanitizeMarketSummaryForPublicApi", () => {
  it("removes persisted snapshot ids and internal store ids from public payloads", () => {
    const sanitized = sanitizeMarketSummaryForPublicApi(buildMarketSummary());

    expect(sanitized.providerStoreSearches[0]).not.toHaveProperty("persistedSnapshotId");
    expect(sanitized.providerStoreSearches[0]?.stores[0]).not.toHaveProperty(
      "providerStoreId",
    );
    expect(sanitized.providerPricingPreviews[0]).not.toHaveProperty("persistedSnapshotId");
    expect(sanitized.providerPricingPreviews[0]).not.toHaveProperty("providerStoreId");
    expect(sanitized.providerPricingPreviews[0]?.items[0]).not.toHaveProperty(
      "providerProductId",
    );
    expect(sanitized.providerPriceObservationSync[0]).not.toHaveProperty("internalStoreId");
    expect(sanitized.nearbyStores[0]?.id).toBe("kroger-mechanicsville");
    expect(sanitized.providerPriceObservationSync[0]?.message).not.toContain(
      "kroger-mechanicsville",
    );
    expect(sanitized.weeklyAdIngestionStatus[0]).not.toHaveProperty("storeId");
    expect(sanitized.weeklyAdIngestionStatus[0]).not.toHaveProperty("sourceName");
    expect(sanitized.weeklyAdIngestionStatus[0]?.message).not.toContain(
      "kroger-mechanicsville",
    );
    expect(sanitized.weeklyAdPromotionReadiness[0]).not.toHaveProperty("storeId");
    expect(sanitized.providerPriceObservationSync[0]?.syncedCount).toBe(3);
    expect(sanitized).not.toHaveProperty("message");
  });

  it("strips numeric retailer sourceStoreId from nearby stores", () => {
    const sanitized = sanitizeMarketSummaryForPublicApi(
      buildMarketSummary({
        nearbyStores: [
          buildTestNearbyStoreSummary({
            id: "kroger-mechanicsville",
            name: "Kroger Mechanicsville",
            latitude: 37.6085,
            longitude: -77.3321,
            distanceMiles: 1.2,
            sourceStoreId: "02900529",
          }),
        ],
      }),
    );

    expect(sanitized.nearbyStores[0]).not.toHaveProperty("sourceStoreId");
    expect(sanitized.nearbyStores[0]?.id).toBe("kroger-mechanicsville");
  });

  it("preserves public catalog store ids for each nearby store", () => {
    const sanitized = sanitizeMarketSummaryForPublicApi(
      buildMarketSummary({
        nearbyStores: [
          buildTestNearbyStoreSummary({
            id: "kroger-mechanicsville",
            name: "Kroger Mechanicsville",
            latitude: 37.6085,
            longitude: -77.3321,
            distanceMiles: 1.2,
          }),
          buildTestNearbyStoreSummary({
            id: "publix-1626",
            name: "Publix Brandy Creek",
            latitude: 37.65,
            longitude: -77.35,
            distanceMiles: 2.4,
            chain: "publix",
            chainLabel: "Publix",
            rolloutStatus: "coming-soon",
            recommendationEnabled: false,
            rolloutNote: "Coming soon.",
          }),
        ],
      }),
    );

    expect(sanitized.nearbyStores.map((store) => store.id)).toEqual([
      "kroger-mechanicsville",
      "publix-1626",
    ]);
  });
});
