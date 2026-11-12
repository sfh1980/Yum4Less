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
        chainId: "kroger",
        admittedStore: true,
        saleSource: true,
        freshOfficialCount: 9,
        freshFlyerCount: 0,
      },
      {
        displayName: "Aldi",
        chainId: "aldi",
        admittedStore: true,
        saleSource: true,
        freshOfficialCount: 0,
        freshFlyerCount: 2,
      },
    ]);
  });

  it("rounds fresh rows per admitted store", () => {
    const facts = assembleMorningChainPriceFacts({
      registry: [
        {
          chainId: "publix",
          displayName: "Publix",
          saleSource: true,
          sortOrder: 30,
        },
      ],
      admittedChainIds: new Set(["publix"]),
      admittedStoreCounts: new Map([["publix", 11]]),
      freshBySource: [{ sourceName: "publix-weekly-ad-scrape", freshCount: 264 }],
    });
    expect(facts[0]?.rowsPerStore).toBe(24);
  });

  it("counts only shopper-visible rows and names rows that start later", () => {
    const facts = assembleMorningChainPriceFacts({
      registry: [
        {
          chainId: "lidl",
          displayName: "Lidl",
          saleSource: true,
          sortOrder: 40,
          shopperRanked: true,
        },
      ],
      admittedChainIds: new Set(["lidl"]),
      admittedStoreCounts: new Map([["lidl", 2]]),
      catalogStoreCounts: new Map([["lidl", 2]]),
      freshBySource: [{ sourceName: "lidl-weekly-ad-scrape", freshCount: 50 }],
      visibleBySource: [{ sourceName: "lidl-weekly-ad-scrape", freshCount: 44 }],
      startingLaterBySource: [{ sourceName: "lidl-weekly-ad-scrape", freshCount: 10 }],
    });
    expect(facts[0]?.rowsPerStore).toBe(22);
    expect(facts[0]?.startingLaterPerStore).toBe(5);
    expect(facts[0]?.freshFlyerCount).toBe(50);
  });
});
