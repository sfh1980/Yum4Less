import { describe, expect, it } from "vitest";
import {
  EMPTY_CHAIN_MEMBERSHIP,
  FIXTURE_CHAIN_MEMBERSHIP,
  KNOWN_DINNER_ADAPTER_CHAIN_IDS,
  isShopperRankedChain,
  membershipFromRegistryRows,
  membershipFromShopperRankedIds,
  rankedChainIdsHaveKnownAdapters,
} from "@/lib/chain-membership";

describe("chain membership snapshot", () => {
  it("builds ranked ids from registry flags, not from a parallel TypeScript list", () => {
    const membership = membershipFromRegistryRows([
      {
        chainId: "kroger",
        shopperRanked: true,
        settingsSelectable: true,
        weeklyAdEligible: true,
      },
      {
        chainId: "dollar-general",
        shopperRanked: false,
        settingsSelectable: false,
        weeklyAdEligible: true,
      },
      {
        chainId: "target",
        shopperRanked: false,
        settingsSelectable: false,
        weeklyAdEligible: false,
      },
    ]);

    expect(membership.shopperRankedChainIds).toEqual(["kroger"]);
    expect(membership.weeklyAdEligibleChainIds).toEqual([
      "kroger",
      "dollar-general",
    ]);
    expect(isShopperRankedChain(membership, "kroger")).toBe(true);
    expect(isShopperRankedChain(membership, "dollar-general")).toBe(false);
  });

  it("fails closed when the market payload omits ranked ids", () => {
    expect(membershipFromShopperRankedIds(undefined)).toEqual(
      EMPTY_CHAIN_MEMBERSHIP,
    );
    expect(membershipFromShopperRankedIds([])).toEqual(EMPTY_CHAIN_MEMBERSHIP);
  });

  it("treats fixture ranked ids as known dinner adapters", () => {
    expect(
      rankedChainIdsHaveKnownAdapters(FIXTURE_CHAIN_MEMBERSHIP.shopperRankedChainIds),
    ).toBe(true);
    expect(rankedChainIdsHaveKnownAdapters(["kroger", "target"])).toBe(false);
    expect(KNOWN_DINNER_ADAPTER_CHAIN_IDS).toContain("walmart");
  });

  it("does not treat an empty roster as shopper-ranked", () => {
    expect(isShopperRankedChain(EMPTY_CHAIN_MEMBERSHIP, "kroger")).toBe(false);
  });
});
