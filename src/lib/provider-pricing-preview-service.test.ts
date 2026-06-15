import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";

const { getStoreDiscoveryProviders } = vi.hoisted(() => ({
  getStoreDiscoveryProviders: vi.fn(),
}));
const { persistProviderPricingPreviewResult } = vi.hoisted(() => ({
  persistProviderPricingPreviewResult: vi.fn(),
}));
const { getLatestProviderPricingPreviewSnapshot } = vi.hoisted(() => ({
  getLatestProviderPricingPreviewSnapshot: vi.fn(),
}));

vi.mock("@/lib/providers/provider-registry", () => ({
  getStoreDiscoveryProviders,
}));
vi.mock("@/lib/provider-product-pricing-cache", () => ({
  persistProviderPricingPreviewResult,
  getLatestProviderPricingPreviewSnapshot,
}));

import {
  buildProviderPricingPreviews,
  selectProviderDiscoveredStore,
} from "@/lib/provider-pricing-preview-service";

const originalDbWriteFlag = process.env.YUM4LESS_ENABLE_API_DB_WRITES;
const originalNodeEnv = process.env.NODE_ENV;

describe("selectProviderDiscoveredStore", () => {
  it("picks the nearest store when multiple same-chain candidates include distance", () => {
    const selected = selectProviderDiscoveredStore("kroger", [
      {
        provider: "kroger",
        providerStoreId: "far",
        name: "Kroger Atlee",
        city: "Mechanicsville",
        state: "VA",
        latitude: 37.665,
        longitude: -77.44,
        distanceMiles: 4.9,
      },
      {
        provider: "kroger",
        providerStoreId: "near",
        name: "Kroger Mechanicsville",
        city: "Mechanicsville",
        state: "VA",
        latitude: 37.6085,
        longitude: -77.3321,
        distanceMiles: 2.1,
      },
    ]);

    expect(selected?.providerStoreId).toBe("near");
  });

  it("prefers an explicit providerStoreId when multiple Kroger stores lack distance", () => {
    const selected = selectProviderDiscoveredStore(
      "kroger",
      [
        {
          provider: "kroger",
          providerStoreId: "02900529",
          name: "Kroger",
          city: "Mechanicsville",
          state: "VA",
          latitude: 37.615,
          longitude: -77.329,
        },
        {
          provider: "kroger",
          providerStoreId: "01100479",
          name: "Kroger Atlee",
          city: "Mechanicsville",
          state: "VA",
          latitude: 37.665,
          longitude: -77.44,
        },
      ],
      "02900529",
    );

    expect(selected?.providerStoreId).toBe("02900529");
  });

  it("returns undefined when multiple same-chain stores lack distance evidence", () => {
    expect(
      selectProviderDiscoveredStore("kroger", [
        {
          provider: "kroger",
          providerStoreId: "a",
          name: "Kroger A",
          city: "Mechanicsville",
          state: "VA",
          latitude: 37.6,
          longitude: -77.3,
        },
        {
          provider: "kroger",
          providerStoreId: "b",
          name: "Kroger B",
          city: "Mechanicsville",
          state: "VA",
          latitude: 37.7,
          longitude: -77.4,
        },
      ]),
    ).toBeUndefined();
  });
});

describe("buildProviderPricingPreviews", () => {
  beforeEach(() => {
    getStoreDiscoveryProviders.mockReset();
    persistProviderPricingPreviewResult.mockReset();
    getLatestProviderPricingPreviewSnapshot.mockReset();
    process.env.YUM4LESS_ENABLE_API_DB_WRITES = "1";
    delete process.env.NODE_ENV;
  });

  afterEach(() => {
    if (originalDbWriteFlag === undefined) {
      delete process.env.YUM4LESS_ENABLE_API_DB_WRITES;
    } else {
      process.env.YUM4LESS_ENABLE_API_DB_WRITES = originalDbWriteFlag;
    }

    if (originalNodeEnv === undefined) {
      delete process.env.NODE_ENV;
    } else {
      process.env.NODE_ENV = originalNodeEnv;
    }
  });

  it("builds and persists a live provider pricing preview", async () => {
    const searchPricingPreview = vi.fn().mockResolvedValue({
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
    });
    getStoreDiscoveryProviders.mockReturnValue([
      {
        provider: "kroger",
        label: "Kroger official store discovery",
        configured: true,
        searchStoresByLocation: vi.fn(),
        searchPricingPreview,
      },
    ]);
    persistProviderPricingPreviewResult.mockResolvedValue(4);
    getLatestProviderPricingPreviewSnapshot.mockResolvedValue(undefined);

    const result = await buildProviderPricingPreviews({
      providerStores: [
        {
          provider: "kroger",
          providerStoreId: "01100479",
          name: "Kroger Mechanicsville",
          city: "Mechanicsville",
          state: "VA",
          latitude: 37.6652,
          longitude: -77.3651,
        },
      ],
      readMode: "live-allowed",
    });

    expect(result).toEqual([
      expect.objectContaining({
        retrievalMode: "live",
        persistedSnapshotId: 4,
      }),
    ]);
  });

  it("returns a fallback preview for providers without a matched store", async () => {
    const searchPricingPreview = vi.fn().mockResolvedValue({
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
    });
    persistProviderPricingPreviewResult.mockResolvedValue(4);
    getLatestProviderPricingPreviewSnapshot.mockResolvedValue(undefined);

    getStoreDiscoveryProviders.mockReturnValue([
      {
        provider: "kroger",
        label: "Kroger official store discovery",
        configured: true,
        searchStoresByLocation: vi.fn(),
        searchPricingPreview,
      },
      {
        provider: "publix",
        label: "Publix official store discovery",
        configured: false,
        searchStoresByLocation: vi.fn(),
        searchPricingPreview: vi.fn(),
      },
      {
        provider: "walmart",
        label: "Walmart official store discovery",
        configured: false,
        searchStoresByLocation: vi.fn(),
        searchPricingPreview: vi.fn(),
      },
    ]);

    const result = await buildProviderPricingPreviews({
      providerStores: [
        {
          provider: "kroger",
          providerStoreId: "01100479",
          name: "Kroger Mechanicsville",
          city: "Mechanicsville",
          state: "VA",
          latitude: 37.6652,
          longitude: -77.3651,
        },
      ],
      readMode: "live-allowed",
    });

    expect(result).toHaveLength(3);
    expect(result[1]).toEqual(
      expect.objectContaining({
        provider: "publix",
        label: "Publix pricing preview",
        status: "fallback",
        coverageStatus: "none",
      }),
    );
    expect(result[2]).toEqual(
      expect.objectContaining({
        provider: "walmart",
        label: "Walmart official pricing preview",
        status: "fallback",
        coverageStatus: "none",
      }),
    );
  });

  it("falls back to a cached provider pricing snapshot when live preview is unavailable", async () => {
    const searchPricingPreview = vi.fn().mockResolvedValue({
      provider: "kroger",
      label: "Kroger official pricing preview",
      status: "fallback",
      provenance: "fallback-local",
      retrievalMode: "none",
      configured: true,
      fallbackUsed: true,
      storeName: "Kroger Mechanicsville",
      providerStoreId: "01100479",
      items: [],
      coverageStatus: "none",
      matchedIngredientCount: 0,
      totalTrackedIngredients: 5,
      message: "Fallback.",
      fetchedAt: "2026-05-20T12:00:00.000Z",
    });
    getStoreDiscoveryProviders.mockReturnValue([
      {
        provider: "kroger",
        label: "Kroger official store discovery",
        configured: true,
        searchStoresByLocation: vi.fn(),
        searchPricingPreview,
      },
    ]);
    getLatestProviderPricingPreviewSnapshot.mockResolvedValue({
      provider: "kroger",
      label: "Kroger official pricing preview",
      status: "fallback",
      provenance: "official-api",
      retrievalMode: "cached",
      configured: true,
      fallbackUsed: true,
      storeName: "Kroger Mechanicsville",
      providerStoreId: "01100479",
      items: [],
      coverageStatus: "limited",
      matchedIngredientCount: 2,
      totalTrackedIngredients: 5,
      message: "Using saved preview.",
      fetchedAt: "2026-05-20T12:00:00.000Z",
      persistedSnapshotId: 8,
      snapshotCapturedAt: "2026-05-20T12:10:00.000Z",
      snapshotAgeMinutes: 20,
    });

    const result = await buildProviderPricingPreviews({
      providerStores: [
        {
          provider: "kroger",
          providerStoreId: "01100479",
          name: "Kroger Mechanicsville",
          city: "Mechanicsville",
          state: "VA",
          latitude: 37.6652,
          longitude: -77.3651,
        },
      ],
      readMode: "live-allowed",
    });

    expect(persistProviderPricingPreviewResult).not.toHaveBeenCalled();
    expect(result).toEqual([
      expect.objectContaining({
        retrievalMode: "cached",
        persistedSnapshotId: 8,
      }),
    ]);
  });

  it("skips snapshot persistence when public API DB writes are disabled", async () => {
    delete process.env.YUM4LESS_ENABLE_API_DB_WRITES;

    const searchPricingPreview = vi.fn().mockResolvedValue({
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
      coverageStatus: "partial",
      matchedIngredientCount: 2,
      totalTrackedIngredients: 5,
      message: "Ready.",
      fetchedAt: "2026-05-20T12:00:00.000Z",
    });

    getStoreDiscoveryProviders.mockReturnValue([
      {
        provider: "kroger",
        label: "Kroger official pricing preview",
        configured: true,
        searchPricingPreview,
      },
    ]);

    const result = await buildProviderPricingPreviews({
      providerStores: [
        {
          provider: "kroger",
          providerStoreId: "01100479",
          name: "Kroger Mechanicsville",
          city: "Mechanicsville",
          state: "VA",
          latitude: 37.6652,
          longitude: -77.3651,
        },
      ],
      readMode: "live-allowed",
    });

    expect(persistProviderPricingPreviewResult).not.toHaveBeenCalled();
    expect(result[0]).not.toHaveProperty("persistedSnapshotId");
  });

  it("blocks snapshot persistence in production even when the flag is set", async () => {
    process.env.NODE_ENV = "production";
    process.env.YUM4LESS_ENABLE_API_DB_WRITES = "1";

    const searchPricingPreview = vi.fn().mockResolvedValue({
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
      coverageStatus: "partial",
      matchedIngredientCount: 2,
      totalTrackedIngredients: 5,
      message: "Ready.",
      fetchedAt: "2026-05-20T12:00:00.000Z",
    });

    getStoreDiscoveryProviders.mockReturnValue([
      {
        provider: "kroger",
        label: "Kroger official pricing preview",
        configured: true,
        searchPricingPreview,
      },
    ]);

    const result = await buildProviderPricingPreviews({
      providerStores: [
        {
          provider: "kroger",
          providerStoreId: "01100479",
          name: "Kroger Mechanicsville",
          city: "Mechanicsville",
          state: "VA",
          latitude: 37.6652,
          longitude: -77.3651,
        },
      ],
      readMode: "live-allowed",
    });

    expect(persistProviderPricingPreviewResult).not.toHaveBeenCalled();
    expect(result[0]).not.toHaveProperty("persistedSnapshotId");
  });

  it("does not call live provider pricing when cache-only and a fresh snapshot exists", async () => {
    const searchPricingPreview = vi.fn();
    getStoreDiscoveryProviders.mockReturnValue([
      {
        provider: "kroger",
        label: "Kroger official store discovery",
        configured: true,
        searchPricingPreview,
      },
    ]);
    getLatestProviderPricingPreviewSnapshot.mockResolvedValue({
      provider: "kroger",
      label: "Kroger official pricing preview",
      status: "fallback",
      provenance: "official-api",
      retrievalMode: "cached",
      configured: true,
      fallbackUsed: true,
      storeName: "Kroger Mechanicsville",
      providerStoreId: "01100479",
      items: [],
      coverageStatus: "limited",
      matchedIngredientCount: 2,
      totalTrackedIngredients: 5,
      message: "Using saved preview.",
      fetchedAt: "2026-05-20T12:00:00.000Z",
      persistedSnapshotId: 8,
      snapshotCapturedAt: "2026-05-20T12:10:00.000Z",
      snapshotAgeMinutes: 120,
    });

    const result = await buildProviderPricingPreviews({
      providerStores: [
        {
          provider: "kroger",
          providerStoreId: "01100479",
          name: "Kroger Mechanicsville",
          city: "Mechanicsville",
          state: "VA",
          latitude: 37.6652,
          longitude: -77.3651,
        },
      ],
    });

    expect(searchPricingPreview).not.toHaveBeenCalled();
    expect(result[0]?.retrievalMode).toBe("cached");
  });

  it("returns a cache-miss fallback without calling live pricing when cache-only", async () => {
    const searchPricingPreview = vi.fn();
    getStoreDiscoveryProviders.mockReturnValue([
      {
        provider: "kroger",
        label: "Kroger official store discovery",
        configured: true,
        searchPricingPreview,
      },
    ]);
    getLatestProviderPricingPreviewSnapshot.mockResolvedValue(undefined);

    const result = await buildProviderPricingPreviews({
      providerStores: [
        {
          provider: "kroger",
          providerStoreId: "01100479",
          name: "Kroger Mechanicsville",
          city: "Mechanicsville",
          state: "VA",
          latitude: 37.6652,
          longitude: -77.3651,
        },
      ],
    });

    expect(searchPricingPreview).not.toHaveBeenCalled();
    expect(result[0]).toEqual(
      expect.objectContaining({
        status: "fallback",
        retrievalMode: "none",
        message: expect.stringContaining("24 hours"),
      }),
    );
  });
});
