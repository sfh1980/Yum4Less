import { afterEach, describe, expect, it, vi } from "vitest";
import { createWholeFoodsWeeklyAdIngestionClient } from "@/lib/weekly-ad-ingestion/whole-foods-weekly-ad-ingestion";
import {
  readWholeFoodsStoreIdFromPayload,
  resolveWholeFoodsStoreForZip,
} from "@/lib/weekly-ad-ingestion/whole-foods-weekly-ad-store";

const originalFixtureFlag = process.env.YUM4LESS_WEEKLY_AD_FIXTURE;
const originalStoreOverride = process.env.WHOLE_FOODS_STORE_NUMBER;

describe("whole foods weekly ad store locator", () => {
  afterEach(() => {
    if (originalStoreOverride === undefined) {
      delete process.env.WHOLE_FOODS_STORE_NUMBER;
    } else {
      process.env.WHOLE_FOODS_STORE_NUMBER = originalStoreOverride;
    }
  });

  it("reads storeCode from the closest-store JSON without hardcoding a ZIP", () => {
    expect(
      readWholeFoodsStoreIdFromPayload({
        storeCode: "10598",
        pickupStoreCode: "10598",
      }),
    ).toBe("10598");
    expect(
      readWholeFoodsStoreIdFromPayload({
        storeCode: "10257",
        deliveryStoreCode: "10257",
      }),
    ).toBe("10257");
  });

  it("uses WHOLE_FOODS_STORE_NUMBER override for probes without hardcoding in adapters", async () => {
    process.env.WHOLE_FOODS_STORE_NUMBER = "4242";
    process.env.WHOLE_FOODS_STORE_NAME = "Probe Whole Foods";
    process.env.WHOLE_FOODS_STORE_CITY = "Richmond";
    process.env.WHOLE_FOODS_STORE_STATE = "VA";

    const store = await resolveWholeFoodsStoreForZip("10001", {
      fetchClosest: async () => {
        throw new Error("locator should not be called when override is set");
      },
      fetchSummary: async () => undefined,
    });

    expect(store).toEqual(
      expect.objectContaining({
        storeId: "4242",
        locationName: "Probe Whole Foods",
        city: "Richmond",
        state: "VA",
      }),
    );
  });

  it("resolves different store ids for different ZIPs", async () => {
    delete process.env.WHOLE_FOODS_STORE_NUMBER;
    const seenZips: string[] = [];

    const resolve = (zipCode: string) =>
      resolveWholeFoodsStoreForZip(zipCode, {
        fetchClosest: async (zip) => {
          seenZips.push(zip);
          if (zip === "23220") return { storeId: "10598" };
          if (zip === "10001") return { storeId: "10103" };
          return undefined;
        },
        fetchSummary: async (storeId) => ({
          storeId,
          locationName: storeId === "10598" ? "West Broad Street" : "Union Square",
          city: storeId === "10598" ? "Richmond" : "New York",
          state: storeId === "10598" ? "VA" : "NY",
        }),
      });

    const richmond = await resolve("23220");
    const nyc = await resolve("10001");

    expect(seenZips).toEqual(["23220", "10001"]);
    expect(richmond?.storeId).toBe("10598");
    expect(nyc?.storeId).toBe("10103");
    expect(richmond?.city).toBe("Richmond");
    expect(nyc?.city).toBe("New York");
  });
});

describe("whole foods weekly ad ingestion", () => {
  afterEach(() => {
    if (originalFixtureFlag === undefined) {
      delete process.env.YUM4LESS_WEEKLY_AD_FIXTURE;
    } else {
      process.env.YUM4LESS_WEEKLY_AD_FIXTURE = originalFixtureFlag;
    }
  });

  it("uses fixture offers when YUM4LESS_WEEKLY_AD_FIXTURE is set", async () => {
    process.env.YUM4LESS_WEEKLY_AD_FIXTURE = "1";
    const client = createWholeFoodsWeeklyAdIngestionClient({
      resolveStoreForZip: async () => {
        throw new Error("locator should not run in fixture mode");
      },
    });

    const result = await client.ingestWeeklyAd({
      chain: "whole-foods",
      storeId: "whole-foods-10598",
      storeName: "Whole Foods West Broad Street",
      zipCode: "23220",
      trackedIngredientIds: ["chicken-breast", "avocado", "grapes", "eggs"],
    });

    expect(result.status).toBe("cached");
    expect(result.offers.length).toBeGreaterThan(0);
    expect(
      result.offers.some((offer) => /chicken/i.test(offer.productName)),
    ).toBe(true);
  });

  it("loads live sales-flyer HTML for a ZIP-resolved store id", async () => {
    delete process.env.YUM4LESS_WEEKLY_AD_FIXTURE;
    const persistBinding = async () => ({
      updatedPin: true,
      upsertedCatalog: true,
    });

    const client = createWholeFoodsWeeklyAdIngestionClient({
      resolveStoreForZip: async () => ({
        storeId: "10103",
        locationName: "Union Square",
        city: "New York",
        state: "NY",
        latitude: 40.74,
        longitude: -73.99,
      }),
      persistBinding,
      now: () => new Date("2026-09-01T12:00:00.000Z"),
      fetchSalesFlyerHtml: async ({ storeId }) => ({
        url: `https://www.wholefoodsmarket.com/sales-flyer?store-id=${storeId}`,
        html: `<script id="__NEXT_DATA__" type="application/json">${JSON.stringify({
          props: {
            pageProps: {
              promotions: [
                {
                  productName: "Organic Hass Avocados",
                  originBrandName: "Whole Foods Market",
                  regularPrice: "$1.25 ea",
                  salePrice: "4 for $5",
                  primePrice: "4 for $5 with Prime",
                  endDate: "2026-09-22T05:00:00Z",
                },
                {
                  productName: "Select Household Cleaners",
                  salePrice: "22% off",
                  primePrice: "30% off",
                  regularPrice: "$3.79 to $22.99",
                },
              ],
            },
          },
        })}</script>`,
      }),
    });

    const result = await client.ingestWeeklyAd({
      chain: "whole-foods",
      storeId: "osm-way-1",
      storeName: "Whole Foods Market",
      zipCode: "10001",
      trackedIngredientIds: ["avocado"],
    });

    expect(result.status).toBe("live");
    expect(result.message).toContain("10103");
    expect(result.message).toContain("10001");
    expect(result.offers.some((offer) => /avocado/i.test(offer.productName))).toBe(
      true,
    );
    expect(result.offers.find((offer) => /avocado/i.test(offer.productName))?.validThrough).toBe(
      "2026-09-22T05:00:00Z",
    );
    expect(
      result.offers.some((offer) => /household cleaner/i.test(offer.productName)),
    ).toBe(false);
  });

  it("extends a shared whole-hour end and ignores the store pin", async () => {
    delete process.env.YUM4LESS_WEEKLY_AD_FIXTURE;
    const client = createWholeFoodsWeeklyAdIngestionClient({
      resolveStoreForZip: async () => ({
        storeId: "10631",
        locationName: "Lincoln Park",
        city: "Chicago",
        state: "IL",
        latitude: 41.8781,
        longitude: -87.6298,
      }),
      persistBinding: async () => ({
        updatedPin: true,
        upsertedCatalog: true,
      }),
      now: () => new Date("2026-09-01T12:00:00.000Z"),
      fetchSalesFlyerHtml: async ({ storeId }) => ({
        url: `https://www.wholefoodsmarket.com/sales-flyer?store-id=${storeId}`,
        html: `<script id="__NEXT_DATA__" type="application/json">${JSON.stringify({
          props: {
            pageProps: {
              promotions: [
                {
                  productName: "Organic Hass Avocados",
                  salePrice: "4 for $5",
                  startDate: "2026-09-16T05:00:00Z",
                  endDate: "2026-09-22T05:00:00Z",
                },
              ],
            },
          },
        })}</script>`,
      }),
    });

    const result = await client.ingestWeeklyAd({
      chain: "whole-foods",
      storeId: "osm-way-2",
      storeName: "Whole Foods Market",
      zipCode: "60614",
      trackedIngredientIds: ["avocado"],
    });

    expect(result.offers.find((offer) => /avocado/i.test(offer.productName))?.validThrough).toBe(
      "2026-09-23T05:00:00Z",
    );
  });

  it("logs a missing store without a parsed-dates line", async () => {
    delete process.env.YUM4LESS_WEEKLY_AD_FIXTURE;
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);
    const client = createWholeFoodsWeeklyAdIngestionClient({
      resolveStoreForZip: async () => undefined,
    });

    const result = await client.ingestWeeklyAd({
      chain: "whole-foods",
      storeId: "whole-foods-1",
      storeName: "Whole Foods Market",
      zipCode: "23005",
      trackedIngredientIds: ["avocado"],
    });

    const lines = info.mock.calls.map((call) => String(call[0]));
    expect(result.offers).toEqual([]);
    expect(result.status).toBe("error");
    expect(lines.join("\n")).toContain("no rows: no closest store for ZIP 23005");
    expect(lines.join("\n")).not.toContain("parsed flyer dates");
    info.mockRestore();
  });

  it("logs a fetch failure without a parsed-dates line", async () => {
    delete process.env.YUM4LESS_WEEKLY_AD_FIXTURE;
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);
    const client = createWholeFoodsWeeklyAdIngestionClient({
      resolveStoreForZip: async () => ({
        storeId: "10257",
        locationName: "Short Pump",
        city: "Richmond",
        state: "VA",
      }),
      persistBinding: async () => ({ updatedPin: false, upsertedCatalog: false }),
      fetchSalesFlyerHtml: async () => {
        throw new Error("browser closed");
      },
    });

    const result = await client.ingestWeeklyAd({
      chain: "whole-foods",
      storeId: "whole-foods-10257",
      storeName: "Whole Foods Market",
      zipCode: "23005",
      trackedIngredientIds: ["avocado"],
    });

    const lines = info.mock.calls.map((call) => String(call[0]));
    expect(result.offers).toEqual([]);
    expect(lines.join("\n")).toContain("no rows: fetch failed: browser closed");
    expect(lines.join("\n")).not.toContain("parsed flyer dates");
    info.mockRestore();
  });

  it("logs no unit prices after the parsed-dates line when the flyer has none", async () => {
    delete process.env.YUM4LESS_WEEKLY_AD_FIXTURE;
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);
    const client = createWholeFoodsWeeklyAdIngestionClient({
      resolveStoreForZip: async () => ({
        storeId: "10257",
        locationName: "Short Pump",
        city: "Richmond",
        state: "VA",
      }),
      persistBinding: async () => ({ updatedPin: false, upsertedCatalog: false }),
      fetchSalesFlyerHtml: async () => ({
        url: "https://www.wholefoodsmarket.com/sales-flyer?store-id=10257",
        html: "<html>no flyer</html>",
      }),
    });

    const result = await client.ingestWeeklyAd({
      chain: "whole-foods",
      storeId: "whole-foods-10257",
      storeName: "Whole Foods Market",
      zipCode: "23005",
      trackedIngredientIds: ["avocado"],
    });

    const lines = info.mock.calls.map((call) => String(call[0]));
    expect(result.offers).toEqual([]);
    expect(lines.some((line) => line.includes("parsed flyer dates"))).toBe(true);
    expect(lines.join("\n")).toContain("no rows: no unit prices for store 10257");
    info.mockRestore();
  });

  it("does not write a flyer whose extended end is already past", async () => {
    delete process.env.YUM4LESS_WEEKLY_AD_FIXTURE;
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);
    const client = createWholeFoodsWeeklyAdIngestionClient({
      resolveStoreForZip: async () => ({
        storeId: "10257",
        locationName: "Short Pump",
        city: "Richmond",
        state: "VA",
      }),
      persistBinding: async () => ({ updatedPin: false, upsertedCatalog: false }),
      now: () => new Date("2026-11-04T08:00:00.000Z"),
      fetchSalesFlyerHtml: async ({ storeId }) => ({
        url: `https://www.wholefoodsmarket.com/sales-flyer?store-id=${storeId}`,
        html: `<script id="__NEXT_DATA__" type="application/json">${JSON.stringify({
          props: {
            pageProps: {
              promotions: [
                {
                  productName: "Organic Hass Avocados",
                  salePrice: "4 for $5",
                  startDate: "2026-10-28T05:00:00Z",
                  endDate: "2026-11-03T05:00:00Z",
                },
              ],
            },
          },
        })}</script>`,
      }),
    });

    const result = await client.ingestWeeklyAd({
      chain: "whole-foods",
      storeId: "whole-foods-10257",
      storeName: "Whole Foods Market",
      zipCode: "23005",
      trackedIngredientIds: ["avocado"],
    });

    const lines = info.mock.calls.map((call) => String(call[0]));
    expect(result.offers).toEqual([]);
    expect(result.status).toBe("live");
    expect(lines.join("\n")).toContain(
      "[whole-foods] flyer ended 2026-11-04T05:00:00Z; waiting for the new flyer (store 10257, start=2026-10-28T05:00:00Z, end=2026-11-03T05:00:00Z)",
    );
    expect(lines.join("\n")).toContain("parsed flyer dates");
    expect(lines.join("\n")).not.toContain("no rows: no unit prices");
    info.mockRestore();
  });

  it("keeps a current offer and drops one that already ended", async () => {
    delete process.env.YUM4LESS_WEEKLY_AD_FIXTURE;
    const client = createWholeFoodsWeeklyAdIngestionClient({
      resolveStoreForZip: async () => ({
        storeId: "10257",
        locationName: "Short Pump",
        city: "Richmond",
        state: "VA",
      }),
      persistBinding: async () => ({ updatedPin: false, upsertedCatalog: false }),
      now: () => new Date("2026-11-04T08:00:00.000Z"),
      fetchSalesFlyerHtml: async () => ({
        url: "https://www.wholefoodsmarket.com/sales-flyer?store-id=10257",
        html: `<script id="__NEXT_DATA__" type="application/json">${JSON.stringify({
          props: {
            pageProps: {
              promotions: [
                {
                  productName: "Organic Hass Avocados",
                  salePrice: "$1.50",
                  startDate: "2026-10-28T05:00:00Z",
                  endDate: "2026-11-03T05:00:00Z",
                },
                {
                  productName: "Organic Chicken Breast",
                  salePrice: "4 for $5",
                  endDate: "2026-11-10T15:00:00Z",
                },
              ],
            },
          },
        })}</script>`,
      }),
    });

    const result = await client.ingestWeeklyAd({
      chain: "whole-foods",
      storeId: "whole-foods-10257",
      storeName: "Whole Foods Market",
      zipCode: "23005",
      trackedIngredientIds: ["avocado", "chicken-breast"],
    });

    expect(result.offers.some((offer) => /avocado/i.test(offer.productName))).toBe(false);
    expect(result.offers.some((offer) => /chicken/i.test(offer.productName))).toBe(true);
  });
});
