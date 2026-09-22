import { afterEach, describe, expect, it } from "vitest";
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
    expect(
      result.offers.some((offer) => /household cleaner/i.test(offer.productName)),
    ).toBe(false);
  });
});
