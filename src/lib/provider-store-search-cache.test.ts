import { beforeEach, describe, expect, it, vi } from "vitest";

const { getDbPool } = vi.hoisted(() => ({
  getDbPool: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  getDbPool,
}));

import {
  getLatestProviderStoreSearchSnapshot,
  persistProviderStoreSearchResult,
} from "@/lib/provider-store-search-cache";

describe("persistProviderStoreSearchResult", () => {
  beforeEach(() => {
    getDbPool.mockReset();
  });

  it("persists provider discovery snapshots when the database is available", async () => {
    const query = vi.fn().mockResolvedValue({
      rows: [{ id: "12" }],
    });
    getDbPool.mockReturnValue({ query });

    const snapshotId = await persistProviderStoreSearchResult(
      {
        location: {
          zipCode: "23111",
          city: "Mechanicsville",
          state: "VA",
          latitude: 37.6085,
          longitude: -77.3321,
          source: "seed",
        },
        radiusMiles: 5,
      },
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
      },
    );

    expect(query).toHaveBeenCalledTimes(1);
    expect(snapshotId).toBe(12);
    expect(query.mock.calls[0]?.[1]?.[6]).toBe(37.608);
    expect(query.mock.calls[0]?.[1]?.[7]).toBe(-77.332);
  });

  it("fails softly when the database is unavailable", async () => {
    getDbPool.mockImplementation(() => {
      throw new Error("DATABASE_URL is not configured.");
    });

    const snapshotId = await persistProviderStoreSearchResult(
      {
        location: {
          zipCode: "23111",
          city: "Mechanicsville",
          state: "VA",
          latitude: 37.6085,
          longitude: -77.3321,
          source: "seed",
        },
        radiusMiles: 5,
      },
      {
        provider: "kroger",
        label: "Kroger official store discovery",
        status: "fallback",
        provenance: "fallback-local",
        retrievalMode: "none",
        configured: true,
        fallbackUsed: true,
        stores: [],
        message: "Fallback.",
        fetchedAt: "2026-05-20T12:00:00.000Z",
      },
    );

    expect(snapshotId).toBeUndefined();
  });

  it("reads back a recent cached provider snapshot with freshness metadata", async () => {
    const capturedAt = new Date(Date.now() - 10 * 60000);
    const fetchedAt = new Date(Date.now() - 11 * 60000);
    const query = vi.fn().mockResolvedValue({
      rows: [
        {
          id: 7,
          provider: "kroger",
          status: "available",
          provenance: "official-api",
          configured: true,
          fallback_used: false,
          store_count: 1,
          message: "Original live message.",
          fetched_at: fetchedAt,
          captured_at: capturedAt,
          stores_json: [
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
        },
      ],
    });
    getDbPool.mockReturnValue({ query });

    const snapshot = await getLatestProviderStoreSearchSnapshot({
      provider: "kroger",
      search: {
        location: {
          zipCode: "23111",
          city: "Mechanicsville",
          state: "VA",
          latitude: 37.6085,
          longitude: -77.3321,
          source: "seed",
        },
        radiusMiles: 5,
      },
      maxAgeMinutes: 30,
    });

    expect(snapshot).toEqual(
      expect.objectContaining({
        provider: "kroger",
        retrievalMode: "cached",
        provenance: "official-api",
        fallbackUsed: true,
        persistedSnapshotId: 7,
        stores: [
          expect.objectContaining({
            providerStoreId: "01100479",
          }),
        ],
      }),
    );
    expect(snapshot?.snapshotAgeMinutes).toBeGreaterThanOrEqual(0);
  });
});
