import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { restoreTestNodeEnv, stubTestNodeEnv } from "@/lib/test-env";

const { getStoreDiscoveryProviders } = vi.hoisted(() => ({
  getStoreDiscoveryProviders: vi.fn(),
}));
const { persistProviderStoreSearchResult } = vi.hoisted(() => ({
  persistProviderStoreSearchResult: vi.fn(),
}));
const { getLatestProviderStoreSearchSnapshot } = vi.hoisted(() => ({
  getLatestProviderStoreSearchSnapshot: vi.fn(),
}));

vi.mock("@/lib/providers/provider-registry", () => ({
  getStoreDiscoveryProviders,
}));
vi.mock("@/lib/provider-store-search-cache", () => ({
  persistProviderStoreSearchResult,
  getLatestProviderStoreSearchSnapshot,
}));

import { searchOfficialProviderStores } from "@/lib/provider-market-service";

const originalDbWriteFlag = process.env.YUM4LESS_ENABLE_API_DB_WRITES;
const originalNodeEnv = process.env.NODE_ENV;

describe("searchOfficialProviderStores", () => {
  beforeEach(() => {
    getStoreDiscoveryProviders.mockReset();
    persistProviderStoreSearchResult.mockReset();
    getLatestProviderStoreSearchSnapshot.mockReset();
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
      stubTestNodeEnv(originalNodeEnv);
    }
  });

  it("queries every registered store-discovery provider", async () => {
    const searchStoresByLocation = vi.fn().mockResolvedValue({
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
    });
    persistProviderStoreSearchResult.mockResolvedValue(7);
    getLatestProviderStoreSearchSnapshot.mockResolvedValue(undefined);

    getStoreDiscoveryProviders.mockReturnValue([
      {
        provider: "kroger",
        label: "Kroger official store discovery",
        configured: true,
        searchStoresByLocation,
      },
    ]);

    const result = await searchOfficialProviderStores({
      location: {
        city: "Mechanicsville",
        state: "VA",
        latitude: 37.6085,
        longitude: -77.3321,
        source: "seed",
        zipCode: "23111",
      },
      radiusMiles: 5,
      readMode: "live-allowed",
    });

    expect(searchStoresByLocation).toHaveBeenCalledWith({
      location: expect.objectContaining({
        city: "Mechanicsville",
      }),
      radiusMiles: 5,
    });
    expect(result).toEqual([
      expect.objectContaining({
        provider: "kroger",
        status: "available",
        persistedSnapshotId: 7,
      }),
    ]);
  });

  it("falls back to a cached provider snapshot when live discovery is unavailable", async () => {
    const searchStoresByLocation = vi.fn().mockResolvedValue({
      provider: "kroger",
      label: "Kroger official store discovery",
      status: "fallback",
      provenance: "fallback-local",
      retrievalMode: "none",
      configured: true,
      fallbackUsed: true,
      stores: [],
      message: "Live request failed.",
      fetchedAt: "2026-05-20T12:00:00.000Z",
    });

    getStoreDiscoveryProviders.mockReturnValue([
      {
        provider: "kroger",
        label: "Kroger official store discovery",
        configured: true,
        searchStoresByLocation,
      },
    ]);
    getLatestProviderStoreSearchSnapshot.mockResolvedValue({
      provider: "kroger",
      label: "Kroger official store discovery",
      status: "fallback",
      provenance: "official-api",
      retrievalMode: "cached",
      configured: true,
      fallbackUsed: true,
      stores: [
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
      message: "Using a saved snapshot.",
      fetchedAt: "2026-05-20T12:00:00.000Z",
      persistedSnapshotId: 9,
      snapshotCapturedAt: "2026-05-20T12:10:00.000Z",
      snapshotAgeMinutes: 20,
    });

    const result = await searchOfficialProviderStores({
      location: {
        city: "Mechanicsville",
        state: "VA",
        latitude: 37.6085,
        longitude: -77.3321,
        source: "seed",
        zipCode: "23111",
      },
      radiusMiles: 5,
      readMode: "live-allowed",
    });

    expect(getLatestProviderStoreSearchSnapshot).toHaveBeenCalledTimes(1);
    expect(persistProviderStoreSearchResult).not.toHaveBeenCalled();
    expect(result).toEqual([
      expect.objectContaining({
        retrievalMode: "cached",
        persistedSnapshotId: 9,
        snapshotAgeMinutes: 20,
      }),
    ]);
  });

  it("skips snapshot persistence when public API DB writes are disabled", async () => {
    process.env.YUM4LESS_ENABLE_API_DB_WRITES = "0";

    const searchStoresByLocation = vi.fn().mockResolvedValue({
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
    });

    getStoreDiscoveryProviders.mockReturnValue([
      {
        provider: "kroger",
        label: "Kroger official store discovery",
        configured: true,
        searchStoresByLocation,
      },
    ]);

    const result = await searchOfficialProviderStores({
      location: {
        city: "Mechanicsville",
        state: "VA",
        latitude: 37.6085,
        longitude: -77.3321,
        source: "seed",
        zipCode: "23111",
      },
      radiusMiles: 5,
      readMode: "live-allowed",
    });

    expect(persistProviderStoreSearchResult).not.toHaveBeenCalled();
    expect(result[0]).not.toHaveProperty("persistedSnapshotId");
  });

  it("blocks snapshot persistence in production even when the flag is set", async () => {
    stubTestNodeEnv("production");
    process.env.YUM4LESS_ENABLE_API_DB_WRITES = "1";

    const searchStoresByLocation = vi.fn().mockResolvedValue({
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
    });

    getStoreDiscoveryProviders.mockReturnValue([
      {
        provider: "kroger",
        label: "Kroger official store discovery",
        configured: true,
        searchStoresByLocation,
      },
    ]);

    const result = await searchOfficialProviderStores({
      location: {
        city: "Mechanicsville",
        state: "VA",
        latitude: 37.6085,
        longitude: -77.3321,
        source: "seed",
        zipCode: "23111",
      },
      radiusMiles: 5,
      readMode: "live-allowed",
    });

    expect(persistProviderStoreSearchResult).not.toHaveBeenCalled();
    expect(result[0]).not.toHaveProperty("persistedSnapshotId");
  });

  it("does not call live provider discovery when cache-only and a fresh snapshot exists", async () => {
    const searchStoresByLocation = vi.fn();
    getStoreDiscoveryProviders.mockReturnValue([
      {
        provider: "kroger",
        label: "Kroger official store discovery",
        configured: true,
        searchStoresByLocation,
      },
    ]);
    getLatestProviderStoreSearchSnapshot.mockResolvedValue({
      provider: "kroger",
      label: "Kroger official store discovery",
      status: "fallback",
      provenance: "official-api",
      retrievalMode: "cached",
      configured: true,
      fallbackUsed: true,
      stores: [],
      message: "Using saved snapshot.",
      fetchedAt: "2026-05-20T12:00:00.000Z",
      persistedSnapshotId: 9,
      snapshotCapturedAt: "2026-05-20T12:10:00.000Z",
      snapshotAgeMinutes: 120,
    });

    const result = await searchOfficialProviderStores({
      location: {
        city: "Mechanicsville",
        state: "VA",
        latitude: 37.6085,
        longitude: -77.3321,
        source: "seed",
        zipCode: "23111",
      },
      radiusMiles: 5,
    });

    expect(searchStoresByLocation).not.toHaveBeenCalled();
    expect(getLatestProviderStoreSearchSnapshot).toHaveBeenCalledTimes(1);
    expect(result[0]?.retrievalMode).toBe("cached");
  });

  it("returns a cache-miss fallback without calling live discovery when cache-only", async () => {
    const searchStoresByLocation = vi.fn();
    getStoreDiscoveryProviders.mockReturnValue([
      {
        provider: "kroger",
        label: "Kroger official store discovery",
        configured: true,
        searchStoresByLocation,
      },
    ]);
    getLatestProviderStoreSearchSnapshot.mockResolvedValue(undefined);

    const result = await searchOfficialProviderStores({
      location: {
        city: "Mechanicsville",
        state: "VA",
        latitude: 37.6085,
        longitude: -77.3321,
        source: "seed",
        zipCode: "23111",
      },
      radiusMiles: 5,
    });

    expect(searchStoresByLocation).not.toHaveBeenCalled();
    expect(result[0]).toEqual(
      expect.objectContaining({
        status: "fallback",
        retrievalMode: "none",
        stores: [],
        message: expect.stringContaining("24 hours"),
      }),
    );
  });
});
