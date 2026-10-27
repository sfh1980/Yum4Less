import { describe, expect, it } from "vitest";
import {
  assembleMorningChainPriceFacts,
  priceSourceFreshnessKind,
} from "@/lib/owner/morning-chain-prices";

describe("morning chain price facts", () => {
  it("counts official rows and flyer rows on the same chain", () => {
    expect(priceSourceFreshnessKind("kroger-official-api")).toEqual({
      chainId: "kroger",
      kind: "official",
    });
    expect(priceSourceFreshnessKind("walmart-online-api")).toEqual({
      chainId: "walmart",
      kind: "official",
    });
    expect(priceSourceFreshnessKind("aldi-weekly-ad-scrape")).toEqual({
      chainId: "aldi",
      kind: "flyer",
    });
    expect(priceSourceFreshnessKind("mock-market-data")).toBeNull();

    const facts = assembleMorningChainPriceFacts({
      registry: [
        {
          chainId: "kroger",
          displayName: "Kroger",
          saleSource: true,
          sortOrder: 10,
        },
        {
          chainId: "aldi",
          displayName: "Aldi",
          saleSource: true,
          sortOrder: 20,
        },
      ],
      admittedChainIds: new Set(["kroger", "aldi"]),
      freshBySource: [
        { sourceName: "kroger-official-api", freshCount: 9 },
        { sourceName: "kroger-weekly-ad-scrape", freshCount: 0 },
        { sourceName: "aldi-weekly-ad-scrape", freshCount: 2 },
      ],
    });

    expect(facts).toEqual([
      {
        displayName: "Kroger",
        admittedStore: true,
        saleSource: true,
        freshOfficialCount: 9,
        freshFlyerCount: 0,
      },
      {
        displayName: "Aldi",
        admittedStore: true,
        saleSource: true,
        freshOfficialCount: 0,
        freshFlyerCount: 2,
      },
    ]);
  });
});
