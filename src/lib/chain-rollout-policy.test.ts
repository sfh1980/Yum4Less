import { describe, expect, it } from "vitest";
import {
  buildDirectionalRolloutNote,
  COORDINATE_SANITY_EXCEPTIONS,
  getCoordinateSanityPromotionRequirement,
  inferStoreChainFromCatalog,
  inferStoreChainFromName,
  inferShopperBannerDisplayName,
  listProviderCatalogRolloutChains,
  SETTINGS_SELECTABLE_CHAINS,
  SHOPPER_RANKED_V1_CHAINS,
  WEEKLY_AD_RANKED_PRICING_CHAINS,
} from "@/lib/chain-rollout-policy";

describe("chain rollout policy", () => {
  it("derives settings, weekly-ad, and catalog lists from the v1 base", () => {
    expect([...SETTINGS_SELECTABLE_CHAINS]).toEqual([...SHOPPER_RANKED_V1_CHAINS]);
    expect(listProviderCatalogRolloutChains()).toEqual([
      "kroger",
      "aldi",
      "publix",
      "food-lion",
      "lidl",
      "walmart",
      "dollar-general",
      "bjs",
    ]);
    expect([...WEEKLY_AD_RANKED_PRICING_CHAINS]).toEqual([
      "kroger",
      "aldi",
      "publix",
      "food-lion",
      "lidl",
      "walmart",
      "dollar-general",
    ]);
  });

  it("templates directional rollout notes from chain label only", () => {
    expect(buildDirectionalRolloutNote("Kroger")).toBe(
      "Kroger dinner estimates use saved sale prices when available near you. Totals are estimates — verify in store.",
    );
    expect(buildDirectionalRolloutNote("Food Lion")).toContain("Food Lion");
    expect(buildDirectionalRolloutNote("Food Lion")).not.toContain("BETA");
  });

  it("shares one store-name chain inference helper", () => {
    expect(inferStoreChainFromName("Harris Teeter")).toBe("kroger");
    expect(inferStoreChainFromName("Food Lion")).toBe("food-lion");
    expect(inferStoreChainFromName("Trader Joe's")).toBe("trader-joes");
  });

  it("shows Kroger-family storefronts as their banner, not the family", () => {
    expect(inferShopperBannerDisplayName("Harris Teeter")).toBe("Harris Teeter");
    expect(inferShopperBannerDisplayName("Ralphs")).toBe("Ralphs");
    expect(inferShopperBannerDisplayName("Kroger Mechanicsville")).toBe("Kroger");
    expect(inferShopperBannerDisplayName("Walmart Supercenter")).toBe("Walmart");
  });

  it("resolves locator-backed catalog stores from sourceName and id before display name", () => {
    expect(
      inferStoreChainFromCatalog({
        id: "publix-1626",
        name: "Brandy Creek Commons",
        sourceName: "publix-store-locator",
      }),
    ).toBe("publix");
    expect(
      inferStoreChainFromCatalog({
        id: "publix-1626",
        name: "Brandy Creek Commons",
        sourceName: "publix-weekly-ad-scrape",
      }),
    ).toBe("publix");
    expect(
      inferStoreChainFromCatalog({
        id: "publix-1566",
        name: "Nuckols Place",
      }),
    ).toBe("publix");
  });

  it("requires coordinate sanity audits only where rollout policy can enforce them safely today", () => {
    expect(getCoordinateSanityPromotionRequirement("food-lion")).toEqual(
      expect.objectContaining({ required: true }),
    );
    expect(getCoordinateSanityPromotionRequirement("lidl")).toEqual(
      expect.objectContaining({ required: false }),
    );
    expect(getCoordinateSanityPromotionRequirement("kroger")).toEqual(
      expect.objectContaining({ required: false }),
    );
    expect(getCoordinateSanityPromotionRequirement("aldi")).toEqual(
      expect.objectContaining({ required: false }),
    );
    expect(getCoordinateSanityPromotionRequirement("publix")).toEqual(
      expect.objectContaining({ required: false }),
    );
    expect(getCoordinateSanityPromotionRequirement("walmart").note).toContain(
      "same weekly-ad coverage floors",
    );
    expect(getCoordinateSanityPromotionRequirement("dollar-general").note).toContain(
      "no other ranked grocer",
    );
  });

  it("persists the two reviewed Food Lion withheld rows as coordinate audit exceptions", () => {
    expect(COORDINATE_SANITY_EXCEPTIONS["osm-node-3103220732"]).toContain(
      "stored storefront pin was correct",
    );
    expect(COORDINATE_SANITY_EXCEPTIONS["osm-node-6527816794"]).toContain(
      "stored storefront pin was correct",
    );
  });
});
