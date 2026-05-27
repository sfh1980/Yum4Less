import { beforeEach, describe, expect, it, vi } from "vitest";

const { getDbPool } = vi.hoisted(() => ({
  getDbPool: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  getDbPool,
}));

import {
  getLatestProviderPricingPreviewSnapshot,
  persistProviderPricingPreviewResult,
} from "@/lib/provider-product-pricing-cache";

describe("provider product pricing cache", () => {
  beforeEach(() => {
    getDbPool.mockReset();
  });

  it("persists provider pricing previews when the database is available", async () => {
    const query = vi.fn().mockResolvedValue({
      rows: [{ id: "5" }],
    });
    getDbPool.mockReturnValue({ query });

    const snapshotId = await persistProviderPricingPreviewResult(
      {
        store: {
          provider: "kroger",
          providerStoreId: "01100479",
          name: "Kroger Mechanicsville",
          city: "Mechanicsville",
          state: "VA",
          latitude: 37.6652,
          longitude: -77.3651,
        },
        ingredients: [
          {
            ingredientId: "chicken-thighs",
            ingredientName: "Chicken thighs",
            searchTerm: "Chicken thighs",
          },
        ],
      },
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
        coverageStatus: "none",
        matchedIngredientCount: 0,
        totalTrackedIngredients: 1,
        message: "Ready.",
        fetchedAt: "2026-05-20T12:00:00.000Z",
      },
    );

    expect(snapshotId).toBe(5);
    expect(query).toHaveBeenCalledTimes(1);
  });

  it("reads back a cached pricing preview snapshot", async () => {
    const capturedAt = new Date(Date.now() - 8 * 60000);
    const fetchedAt = new Date(Date.now() - 9 * 60000);
    const query = vi.fn().mockResolvedValue({
      rows: [
        {
          id: 11,
          provider: "kroger",
          provider_store_id: "01100479",
          store_name: "Kroger Mechanicsville",
          status: "available",
          provenance: "official-api",
          configured: true,
          fallback_used: false,
          tracked_ingredient_count: 5,
          matched_ingredient_count: 2,
          message: "Original preview.",
          fetched_at: fetchedAt,
          captured_at: capturedAt,
          items_json: [
            {
              provider: "kroger",
              ingredientId: "chicken-thighs",
              ingredientName: "Chicken thighs",
              providerProductId: "0001111000001",
              description: "Fresh Chicken Thighs Family Pack",
              regularPrice: 6.49,
              inStock: true,
              matchConfidence: 0.88,
              matchReason:
                "description contains the full ingredient name; item is marked in stock",
            },
          ],
        },
      ],
    });
    getDbPool.mockReturnValue({ query });

    const snapshot = await getLatestProviderPricingPreviewSnapshot({
      provider: "kroger",
      providerStoreId: "01100479",
      maxAgeMinutes: 30,
    });

    expect(snapshot).toEqual(
      expect.objectContaining({
        retrievalMode: "cached",
        persistedSnapshotId: 11,
        coverageStatus: "limited",
        matchedIngredientCount: 2,
      }),
    );
  });
});
