import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getSaleConfidence } from "@/lib/sale-confidence";
import {
  isKrogerProviderLocationId,
  resolveInternalKrogerStoreId,
  syncKrogerPreviewToPriceObservations,
} from "@/lib/provider-price-observation-sync";
import type { NearbyStoreSummary } from "@/lib/recommendation-service";
import type { ProviderPricingPreviewItem } from "@/lib/providers/provider-types";
import {
  buildStoreMapLocationBadge,
  buildStoreMapLocationNote,
  resolveStoreMapLocationProvenance,
} from "@/lib/store-map-location-copy";

const { insertPriceObservationIfChanged, touchStoreVerification } = vi.hoisted(() => ({
  insertPriceObservationIfChanged: vi.fn(),
  touchStoreVerification: vi.fn(),
}));

vi.mock("@/lib/price-observation-writes", () => ({
  insertPriceObservationIfChanged,
  touchStoreVerification,
  parseObservationTimestamp: (value: string) => new Date(value),
}));

function withLocationFields(
  store: Omit<
    NearbyStoreSummary,
    "locationProvenance" | "locationBadge" | "locationNote"
  >,
): NearbyStoreSummary {
  const locationInput = {
    storeId: store.id,
    sourceName: store.sourceName,
    lastVerifiedAt: store.lastVerifiedAt,
  };

  return {
    ...store,
    locationProvenance: resolveStoreMapLocationProvenance(locationInput),
    locationBadge: buildStoreMapLocationBadge(locationInput),
    locationNote: buildStoreMapLocationNote(locationInput),
  };
}

const nearbyStores: NearbyStoreSummary[] = [
  withLocationFields({
    id: "kroger-mechanicsville",
    name: "Kroger Mechanicsville",
    kind: "grocery",
    latitude: 37.6153,
    longitude: -77.3491,
    distanceMiles: 2.4,
    chain: "kroger",
    chainLabel: "Kroger",
    rolloutStatus: "weekly-ad-preview",
    recommendationEnabled: true,
    rolloutNote: "Seed preview coverage.",
  }),
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

describe("isKrogerProviderLocationId", () => {
  it("accepts Kroger Location API ids and rejects bootstrap slugs", () => {
    expect(isKrogerProviderLocationId("02900529")).toBe(true);
    expect(isKrogerProviderLocationId("kroger-mechanicsville")).toBe(false);
  });
});

describe("resolveInternalKrogerStoreId", () => {
  it("maps a Kroger preview store to the local Kroger market store via name overlap", () => {
    expect(
      resolveInternalKrogerStoreId({
        previewStoreName: "Kroger Mechanicsville",
        providerStoreId: "01100479",
        nearbyStores,
      }),
    ).toBe("kroger-mechanicsville");
  });

  it("maps Mechanicsville locationId 02900529 to kroger-mechanicsville via source_store_id", () => {
    expect(
      resolveInternalKrogerStoreId({
        previewStoreName: "Kroger",
        providerStoreId: "02900529",
        nearbyStores: [
          withLocationFields({
            ...nearbyStores[0]!,
            name: "Kroger",
            sourceStoreId: "02900529",
          }),
        ],
      }),
    ).toBe("kroger-mechanicsville");
  });

  it("prefers bootstrap slug ids over API-derived ids when source_store_id matches", () => {
    expect(
      resolveInternalKrogerStoreId({
        previewStoreName: "Kroger",
        providerStoreId: "02900529",
        nearbyStores: [
          withLocationFields({
            ...nearbyStores[0]!,
            id: "kroger-mechanicsville",
            name: "Kroger",
            sourceStoreId: "02900529",
          }),
          withLocationFields({
            ...nearbyStores[0]!,
            id: "kroger-02900529",
            name: "Kroger",
            sourceStoreId: "02900529",
          }),
        ],
      }),
    ).toBe("kroger-mechanicsville");
  });

  it("maps a single bootstrap Kroger row when provider preview uses locationId 02900529", () => {
    expect(
      resolveInternalKrogerStoreId({
        previewStoreName: "Kroger",
        providerStoreId: "02900529",
        nearbyStores: [
          withLocationFields({
            ...nearbyStores[0]!,
            name: "Kroger",
          }),
        ],
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
          withLocationFields({
            id: "kroger-atlee",
            name: "Kroger Atlee",
            kind: "grocery",
            latitude: 37.665,
            longitude: -77.44,
            distanceMiles: 4.9,
            chain: "kroger",
            chainLabel: "Kroger",
            rolloutStatus: "weekly-ad-preview",
            recommendationEnabled: true,
            rolloutNote: "Seed preview coverage.",
          }),
        ],
      }),
    ).toBeUndefined();
  });
});

const originalApiEnv = process.env.KROGER_API_ENV;

describe("syncKrogerPreviewToPriceObservations", () => {
  beforeEach(() => {
    insertPriceObservationIfChanged.mockReset();
    touchStoreVerification.mockReset();
    insertPriceObservationIfChanged.mockResolvedValue("inserted");
    touchStoreVerification.mockResolvedValue(undefined);
  });

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
    expect(summary.skipReason).toBe("not-production");
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
    expect(summary.skipReason).toBe("no-preview-items");
    expect(summary.message).toContain("No official Kroger preview items");
  });

  it("writes kroger-official-api price observations in production when preview items match", async () => {
    process.env.KROGER_API_ENV = "production";

    const summary = await syncKrogerPreviewToPriceObservations({
      nearbyStores: [
        withLocationFields({
          ...nearbyStores[0]!,
          name: "Kroger",
          sourceStoreId: "02900529",
        }),
      ],
      preview: {
        provider: "kroger",
        label: "Kroger official pricing preview",
        status: "available",
        provenance: "official-api",
        retrievalMode: "live",
        configured: true,
        fallbackUsed: false,
        storeName: "Kroger",
        providerStoreId: "02900529",
        items: [
          {
            provider: "kroger",
            ingredientId: "chicken-thighs",
            ingredientName: "Chicken thighs",
            providerProductId: "0001111000001",
            description: "Fresh Chicken Thighs Family Pack",
            regularPrice: 6.49,
            promoPrice: 5.99,
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

    expect(summary.internalStoreId).toBe("kroger-mechanicsville");
    expect(summary.syncedCount).toBe(1);
    expect(summary.skipReason).toBeUndefined();
    expect(insertPriceObservationIfChanged).toHaveBeenCalledWith(
      expect.objectContaining({
        storeId: "kroger-mechanicsville",
        ingredientId: "chicken-thighs",
        sourceName: "kroger-official-api",
      }),
    );
    expect(touchStoreVerification).toHaveBeenCalledWith({
      storeId: "kroger-mechanicsville",
      sourceName: "kroger-official-api",
      sourceStoreId: "02900529",
    });
  });

  it("counts unchanged rows separately from skipped low-confidence items", async () => {
    process.env.KROGER_API_ENV = "production";
    insertPriceObservationIfChanged
      .mockResolvedValueOnce("skipped-unchanged")
      .mockResolvedValueOnce("skipped-unchanged")
      .mockResolvedValueOnce("inserted")
      .mockResolvedValueOnce("skipped-unchanged");

    const summary = await syncKrogerPreviewToPriceObservations({
      nearbyStores: [
        withLocationFields({
          ...nearbyStores[0]!,
          name: "Kroger",
          sourceStoreId: "02900529",
        }),
      ],
      preview: buildProductionKrogerPreview({
        items: [
          buildPreviewItem({ ingredientId: "chicken-thighs", matchConfidence: 0.9 }),
          buildPreviewItem({ ingredientId: "ground-beef", matchConfidence: 0.88 }),
          buildPreviewItem({ ingredientId: "baby-potatoes", matchConfidence: 0.6 }),
          buildPreviewItem({ ingredientId: "onions", matchConfidence: 0.75 }),
          buildPreviewItem({
            ingredientId: "garlic",
            matchConfidence: 0.3,
            providerProductId: "0001111000005",
          }),
        ],
      }),
    });

    expect(summary.syncedCount).toBe(1);
    expect(summary.unchangedCount).toBe(3);
    expect(summary.skippedCount).toBe(1);
    expect(summary.skipReason).toBeUndefined();
    expect(summary.message).toContain("synced 1 new and verified 3 existing");
  });

  it("reports verification-only runs without a low-confidence skip reason", async () => {
    process.env.KROGER_API_ENV = "production";
    insertPriceObservationIfChanged.mockResolvedValue("skipped-unchanged");

    const summary = await syncKrogerPreviewToPriceObservations({
      nearbyStores: [
        withLocationFields({
          ...nearbyStores[0]!,
          name: "Kroger",
          sourceStoreId: "02900529",
        }),
      ],
      preview: buildProductionKrogerPreview({
        items: [
          buildPreviewItem({ ingredientId: "chicken-thighs" }),
          buildPreviewItem({
            ingredientId: "ground-beef",
            providerProductId: "0001111000002",
          }),
          buildPreviewItem({
            ingredientId: "baby-potatoes",
            providerProductId: "0001111000003",
          }),
          buildPreviewItem({
            ingredientId: "onions",
            providerProductId: "0001111000004",
          }),
        ],
      }),
    });

    expect(summary.syncedCount).toBe(0);
    expect(summary.unchangedCount).toBe(4);
    expect(summary.skippedCount).toBe(0);
    expect(summary.skipReason).toBeUndefined();
    expect(summary.message).toContain("verified 4 existing ingredient price observation(s)");
    expect(summary.message).toContain("last_verified_at was refreshed");
  });

  it("uses low-confidence skip reason when no rows insert or verify", async () => {
    process.env.KROGER_API_ENV = "production";

    const summary = await syncKrogerPreviewToPriceObservations({
      nearbyStores: [
        withLocationFields({
          ...nearbyStores[0]!,
          name: "Kroger",
          sourceStoreId: "02900529",
        }),
      ],
      preview: buildProductionKrogerPreview({
        items: [
          buildPreviewItem({ ingredientId: "garlic", matchConfidence: 0.3 }),
        ],
      }),
    });

    expect(summary.syncedCount).toBe(0);
    expect(summary.unchangedCount).toBe(0);
    expect(summary.skippedCount).toBe(1);
    expect(summary.skipReason).toBe("low-confidence");
    expect(insertPriceObservationIfChanged).not.toHaveBeenCalled();
  });
});

function buildPreviewItem(
  overrides: Partial<ProviderPricingPreviewItem> & Pick<ProviderPricingPreviewItem, "ingredientId">,
): ProviderPricingPreviewItem {
  return {
    provider: "kroger",
    ingredientName: overrides.ingredientId,
    providerProductId: "0001111000001",
    description: `${overrides.ingredientId} product`,
    regularPrice: 4.99,
    currencyCode: "USD",
    inStock: true,
    matchConfidence: 0.9,
    matchReason: "fixture match",
    ...overrides,
  };
}

function buildProductionKrogerPreview(input: {
  items: ProviderPricingPreviewItem[];
}): Parameters<typeof syncKrogerPreviewToPriceObservations>[0]["preview"] {
  return {
    provider: "kroger",
    label: "Kroger official pricing preview",
    status: "available",
    provenance: "official-api",
    retrievalMode: "live",
    configured: true,
    fallbackUsed: false,
    storeName: "Kroger",
    providerStoreId: "02900529",
    items: input.items,
    coverageStatus: "strong",
    matchedIngredientCount: input.items.length,
    totalTrackedIngredients: 5,
    message: "Preview available.",
    fetchedAt: "2026-05-20T12:00:00.000Z",
  };
}
