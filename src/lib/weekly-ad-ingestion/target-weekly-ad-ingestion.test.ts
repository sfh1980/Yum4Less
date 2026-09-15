import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createTargetWeeklyAdIngestionClient } from "@/lib/weekly-ad-ingestion/target-weekly-ad-ingestion";
import { resolveTargetStoreForZip } from "@/lib/weekly-ad-ingestion/target-weekly-ad-store";

const originalFixtureFlag = process.env.YUM4LESS_WEEKLY_AD_FIXTURE;
const originalStoreOverride = process.env.TARGET_STORE_NUMBER;

describe("target weekly ad store locator", () => {
  afterEach(() => {
    if (originalStoreOverride === undefined) {
      delete process.env.TARGET_STORE_NUMBER;
    } else {
      process.env.TARGET_STORE_NUMBER = originalStoreOverride;
    }
  });

  it("uses TARGET_STORE_NUMBER override for probes without hardcoding in adapters", async () => {
    process.env.TARGET_STORE_NUMBER = "4242";
    process.env.TARGET_STORE_NAME = "Probe Target";
    process.env.TARGET_STORE_CITY = "Mechanicsville";
    process.env.TARGET_STORE_STATE = "VA";

    const store = await resolveTargetStoreForZip("23111", {
      fetchJson: async () => {
        throw new Error("locator should not be called when override is set");
      },
    });

    expect(store).toEqual(
      expect.objectContaining({
        storeId: "4242",
        locationName: "Probe Target",
        city: "Mechanicsville",
        state: "VA",
      }),
    );
  });

  it("reads the nearest store from nearby_stores_v1 JSON", async () => {
    delete process.env.TARGET_STORE_NUMBER;

    const store = await resolveTargetStoreForZip("23111", {
      fetchJson: async () => ({
        status: 200,
        json: {
          data: {
            nearby_stores: {
              stores: [
                {
                  store_id: "1968",
                  location_name: "Mechanicsville",
                  distance: 5.74,
                  mailing_address: {
                    address_line1: "7235 Bell Creek Rd",
                    city: "Mechanicsville",
                    region: "VA",
                  },
                  geographic_specifications: {
                    latitude: 37.61,
                    longitude: -77.33,
                  },
                },
              ],
            },
          },
        },
      }),
    });

    expect(store?.storeId).toBe("1968");
    expect(store?.city).toBe("Mechanicsville");
    expect(store?.latitude).toBe(37.61);
    expect(store?.longitude).toBe(-77.33);
  });
});

describe("target weekly ad ingestion", () => {
  beforeEach(() => {
    delete process.env.YUM4LESS_WEEKLY_AD_FIXTURE;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    if (originalFixtureFlag === undefined) {
      delete process.env.YUM4LESS_WEEKLY_AD_FIXTURE;
    } else {
      process.env.YUM4LESS_WEEKLY_AD_FIXTURE = originalFixtureFlag;
    }
  });

  it("uses fixture offers when YUM4LESS_WEEKLY_AD_FIXTURE is set", async () => {
    process.env.YUM4LESS_WEEKLY_AD_FIXTURE = "1";
    const client = createTargetWeeklyAdIngestionClient({
      resolveStoreForZip: async () => {
        throw new Error("locator should not run in fixture mode");
      },
    });

    const result = await client.ingestWeeklyAd({
      chain: "target",
      storeId: "target-1968",
      storeName: "Target Mechanicsville",
      zipCode: "23111",
      trackedIngredientIds: [
        "cottage-cheese",
        "eggs",
        "spaghetti",
        "black-beans",
        "butter",
      ],
    });

    expect(result.status).toBe("cached");
    expect(result.offers.length).toBeGreaterThan(0);
    expect(
      result.offers.some((offer) => /cottage cheese/i.test(offer.productName)),
    ).toBe(true);
  });

  it("loads live promotions JSON for a ZIP-resolved store id", async () => {
    const persistBinding = vi.fn().mockResolvedValue({
      updatedPin: true,
      upsertedCatalog: true,
    });

    const client = createTargetWeeklyAdIngestionClient({
      resolveStoreForZip: async () => ({
        storeId: "1968",
        locationName: "Mechanicsville",
        city: "Mechanicsville",
        state: "VA",
        latitude: 37.61,
        longitude: -77.33,
      }),
      persistBinding,
      fetchPromotionPayloads: async () => ({
        promotions: [
          {
            promotionId: "1968-20260913",
            storeId: "1968",
            title: "Weekly Ad",
            saleEndDate: "09/19/2026 11:59:00 PM",
            promotionType: "weeklyad",
          },
        ],
        details: [
          {
            store_id: "1968",
            pages: [
              {
                hotspots: [
                  {
                    title: "Good & Gather cottage cheese",
                    price: "2.99",
                  },
                  {
                    title: "Barilla spaghetti",
                    price: "1.29",
                  },
                ],
              },
            ],
          },
        ],
      }),
    });

    const result = await client.ingestWeeklyAd({
      chain: "target",
      storeId: "osm-node-target-1",
      storeName: "Target",
      zipCode: "23111",
      trackedIngredientIds: ["cottage-cheese", "spaghetti"],
    });

    expect(persistBinding).toHaveBeenCalledWith(
      expect.objectContaining({
        catalogStoreId: "osm-node-target-1",
        locatorStore: expect.objectContaining({ storeId: "1968" }),
      }),
    );
    expect(result.status).toBe("live");
    expect(result.message).toContain("1968");
    expect(result.message).toContain("Dinners stay off");
    expect(result.offers.some((offer) => offer.price === 2.99)).toBe(true);
  });

  it("returns an error when the locator cannot resolve a store", async () => {
    const client = createTargetWeeklyAdIngestionClient({
      resolveStoreForZip: async () => undefined,
    });

    const result = await client.ingestWeeklyAd({
      chain: "target",
      storeId: "osm-node-target-1",
      storeName: "Target",
      zipCode: "23111",
      trackedIngredientIds: ["spaghetti"],
    });

    expect(result.status).toBe("error");
    expect(result.message).toMatch(/could not resolve a nearby Target store/i);
  });
});
