import { describe, expect, it } from "vitest";
import { FIXTURE_CHAIN_MEMBERSHIP } from "@/lib/chain-membership";
import {
  isDinnerEligibleForNearbyMarket,
  isDollarGeneralDinnerEligible,
} from "@/lib/dollar-general-dinner-eligibility";

describe("dollar general dinner eligibility", () => {
  it("allows Dollar General dinners when no other ranked grocer is nearby", () => {
    expect(
      isDollarGeneralDinnerEligible({
        nearbyChains: ["dollar-general", "lidl", "target"],
        membership: FIXTURE_CHAIN_MEMBERSHIP,
      }),
    ).toBe(true);
  });

  it("blocks Dollar General dinners when a supermarket banner is nearby", () => {
    expect(
      isDollarGeneralDinnerEligible({
        nearbyChains: ["kroger", "dollar-general"],
        membership: FIXTURE_CHAIN_MEMBERSHIP,
      }),
    ).toBe(false);
    expect(
      isDinnerEligibleForNearbyMarket({
        chain: "dollar-general",
        nearbyChains: ["walmart", "dollar-general"],
        membership: FIXTURE_CHAIN_MEMBERSHIP,
      }),
    ).toBe(false);
  });

  it("does not change dinner eligibility for other chains", () => {
    expect(
      isDinnerEligibleForNearbyMarket({
        chain: "food-lion",
        nearbyChains: ["food-lion", "dollar-general"],
        membership: FIXTURE_CHAIN_MEMBERSHIP,
      }),
    ).toBe(true);
  });
});
