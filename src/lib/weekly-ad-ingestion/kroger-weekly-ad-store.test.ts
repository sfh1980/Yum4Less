import { afterEach, describe, expect, it, vi } from "vitest";
import { resolveKrogerStoreForWeeklyAd } from "@/lib/weekly-ad-ingestion/kroger-weekly-ad-store";

const { query } = vi.hoisted(() => ({
  query: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  getDbPool: () => ({ query }),
}));

const originalLocationId = process.env.KROGER_LOCATION_ID;
const originalClientId = process.env.KROGER_CLIENT_ID;
const originalClientSecret = process.env.KROGER_CLIENT_SECRET;

describe("resolveKrogerStoreForWeeklyAd", () => {
  afterEach(() => {
    if (originalLocationId === undefined) {
      delete process.env.KROGER_LOCATION_ID;
    } else {
      process.env.KROGER_LOCATION_ID = originalLocationId;
    }

    if (originalClientId === undefined) {
      delete process.env.KROGER_CLIENT_ID;
    } else {
      process.env.KROGER_CLIENT_ID = originalClientId;
    }

    if (originalClientSecret === undefined) {
      delete process.env.KROGER_CLIENT_SECRET;
    } else {
      process.env.KROGER_CLIENT_SECRET = originalClientSecret;
    }

    query.mockReset();
    vi.restoreAllMocks();
  });

  it("prefers KROGER_LOCATION_ID override", async () => {
    process.env.KROGER_LOCATION_ID = "02900529";
    delete process.env.KROGER_CLIENT_ID;
    delete process.env.KROGER_CLIENT_SECRET;

    await expect(
      resolveKrogerStoreForWeeklyAd({
        zipCode: "23111",
        storeId: "kroger-mechanicsville",
      }),
    ).resolves.toEqual({ locationId: "02900529" });
    expect(query).not.toHaveBeenCalled();
  });

  it("uses numeric source_store_id from the catalog row before ZIP API lookup", async () => {
    delete process.env.KROGER_LOCATION_ID;
    delete process.env.KROGER_CLIENT_ID;
    delete process.env.KROGER_CLIENT_SECRET;
    query.mockResolvedValue({
      rows: [{ source_store_id: "02900529", name: "Kroger" }],
    });

    await expect(
      resolveKrogerStoreForWeeklyAd({
        zipCode: "23111",
        storeId: "kroger-mechanicsville",
      }),
    ).resolves.toEqual({
      locationId: "02900529",
      storeName: "Kroger",
    });
  });
});
