import { describe, expect, it } from "vitest";
import {
  deriveRankedPricingSource,
  getRankedPriceSourceKind,
  getRankedPriceSourceTier,
  isLiveRankedPriceSource,
  KROGER_OFFICIAL_PRICE_SOURCE,
  PUBLIX_ONLINE_PRICE_SOURCE,
  SAMPLE_PRICE_SOURCE,
  WALMART_ONLINE_PRICE_SOURCE,
} from "@/lib/price-source-policy";

describe("price source policy", () => {
  it("classifies official online sources ahead of weekly-ad sources", () => {
    for (const source of [
      KROGER_OFFICIAL_PRICE_SOURCE,
      WALMART_ONLINE_PRICE_SOURCE,
      PUBLIX_ONLINE_PRICE_SOURCE,
    ]) {
      expect(getRankedPriceSourceKind(source)).toBe("official-online");
      expect(getRankedPriceSourceTier(source)).toBe(1);
      expect(isLiveRankedPriceSource(source)).toBe(true);
    }

    expect(getRankedPriceSourceKind("kroger-weekly-ad-scrape")).toBe("weekly-ad");
    expect(getRankedPriceSourceTier("kroger-weekly-ad-scrape")).toBe(2);
    expect(isLiveRankedPriceSource("kroger-weekly-ad-scrape")).toBe(true);
  });

  it("excludes sample and unknown sources from ranked meal pricing", () => {
    expect(getRankedPriceSourceKind(SAMPLE_PRICE_SOURCE)).toBe("sample");
    expect(getRankedPriceSourceTier(SAMPLE_PRICE_SOURCE)).toBe(Number.POSITIVE_INFINITY);
    expect(isLiveRankedPriceSource(SAMPLE_PRICE_SOURCE)).toBe(false);

    expect(getRankedPriceSourceKind("vendor-experiment")).toBe("unknown");
    expect(isLiveRankedPriceSource("vendor-experiment")).toBe(false);
  });

  it("derives shopper-facing rollups from ranked source families", () => {
    expect(
      deriveRankedPricingSource({
        priceSources: [KROGER_OFFICIAL_PRICE_SOURCE],
        recommendationEnabledStoreCount: 1,
      }),
    ).toBe("online-cache");

    expect(
      deriveRankedPricingSource({
        priceSources: [KROGER_OFFICIAL_PRICE_SOURCE, "publix-weekly-ad-scrape"],
        recommendationEnabledStoreCount: 1,
      }),
    ).toBe("mixed-online-weekly-ad-cache");

    expect(
      deriveRankedPricingSource({
        priceSources: [SAMPLE_PRICE_SOURCE, "vendor-experiment"],
        recommendationEnabledStoreCount: 1,
      }),
    ).toBe("none");
  });
});
