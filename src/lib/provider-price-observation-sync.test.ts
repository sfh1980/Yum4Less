import { afterEach, describe, expect, it } from "vitest";
import { getSaleConfidence } from "@/lib/sale-confidence";
import {
  resolveInternalKrogerStoreId,
  syncKrogerPreviewToPriceObservations,
} from "@/lib/provider-price-observation-sync";
import type { NearbyStoreSummary } from "@/lib/recommendation-service";

const nearbyStores: NearbyStoreSummary[] = [
  {
    id: "kroger-mechanicsville",
    name: "Kroger Mechanicsville",
    kind: "grocery",
    latitude: 37.6153,
    longitude: -77.3491,
    distanceMiles: 2.4,
    chain: "kroger",
    chainLabel: "Kroger",
    rolloutStatus: "seed-preview",
    recommendationEnabled: true,
    rolloutNote: "Seed preview coverage.",
  },
];

describe("getSaleConfidence", () => {
  it("labels Kroger official API promo prices with verify language", () => {
    const confidence = getSaleConfidence({
      saleLabel: "Kroger promo price",
      freshnessDaysAgo: 0,
      dataSource: "database",
      priceSource: "kroger-official-api",
      matchConfidence: 0.88,
    });

    expect(confidence.label).toBe("Recently checked Kroger promo — verify at shelf");
    expect(confidence.note).toContain("official Kroger API");
  });

  it("labels weak Kroger matches as directional", () => {
    const confidence = getSaleConfidence({
      freshnessDaysAgo: 0,
      dataSource: "database",
      priceSource: "kroger-official-api",
      matchConfidence: 0.52,
    });

    expect(confidence.level).toBe("directional-provider-match");
    expect(confidence.label).toBe("Estimated Kroger price — verify in store");
  });
});

describe("resolveInternalKrogerStoreId", () => {
  it("maps a Kroger preview store to the local Kroger market store", () => {
    expect(
      resolveInternalKrogerStoreId({
        previewStoreName: "Kroger Mechanicsville",
        providerStoreId: "01100479",
        nearbyStores,
      }),
    ).toBe("kroger-mechanicsville");
  });

  it("does not guess when multiple nearby Kroger stores are plausible", () => {
    expect(
      resolveInternalKrogerStoreId({
        previewStoreName: "Kroger",
        providerStoreId: "01100479",
        nearbyStores: [
          ...nearbyStores,
          {
            id: "kroger-atlee",
            name: "Kroger Atlee",
            kind: "grocery",
            latitude: 37.665,
            longitude: -77.44,
            distanceMiles: 4.9,
            chain: "kroger",
            chainLabel: "Kroger",
            rolloutStatus: "seed-preview",
            recommendationEnabled: true,
            rolloutNote: "Seed preview coverage.",
          },
        ],
      }),
    ).toBeUndefined();
  });
});

const originalApiEnv = process.env.KROGER_API_ENV;

describe("syncKrogerPreviewToPriceObservations", () => {
  afterEach(() => {
    if (originalApiEnv === undefined) {
      delete process.env.KROGER_API_ENV;
    } else {
      process.env.KROGER_API_ENV = originalApiEnv;
    }
  });

  it("skips official-online sync when KROGER_API_ENV is not production", async () => {
    process.env.KROGER_API_ENV = "certification";

    const summary = await syncKrogerPreviewToPriceObservations({
      nearbyStores,
      preview: {
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
            providerProductId: "0001111000001",
            description: "Fresh Chicken Thighs Family Pack",
            regularPrice: 6.49,
            currencyCode: "USD",
            inStock: true,
            matchConfidence: 0.9,
            matchReason: "description contains chicken thighs",
          },
        ],
        coverageStatus: "strong",
        matchedIngredientCount: 1,
        totalTrackedIngredients: 5,
        message: "Preview available.",
        fetchedAt: "2026-05-20T12:00:00.000Z",
      },
    });

    expect(summary.syncedCount).toBe(0);
    expect(summary.skippedCount).toBe(1);
    expect(summary.message).toContain("KROGER_API_ENV=production");
  });

  it("reports when official preview items are unavailable", async () => {
    process.env.KROGER_API_ENV = "production";

    const summary = await syncKrogerPreviewToPriceObservations({
      nearbyStores,
      preview: {
        provider: "kroger",
        label: "Kroger official pricing preview",
        status: "not-configured",
        provenance: "not-configured",
        retrievalMode: "none",
        configured: false,
        fallbackUsed: false,
        storeName: "Kroger Mechanicsville",
        providerStoreId: "01100479",
        items: [],
        coverageStatus: "none",
        matchedIngredientCount: 0,
        totalTrackedIngredients: 5,
        message: "Not configured.",
        fetchedAt: "2026-05-20T12:00:00.000Z",
      },
    });

    expect(summary.syncedCount).toBe(0);
    expect(summary.message).toContain("No official Kroger preview items");
  });
});
