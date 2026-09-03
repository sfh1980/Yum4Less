import {
  isShopperRankedChain,
  type ChainMembershipSnapshot,
} from "@/lib/chain-membership";

/**
 * Dollar General dinners are for food-desert / only-stop markets.
 * If another shopper-ranked grocer is nearby, keep DG on the map and in
 * sale collection, but do not use it for meal totals.
 */
export function isDollarGeneralDinnerEligible(input: {
  nearbyChains: readonly string[];
  membership: ChainMembershipSnapshot;
}): boolean {
  return !input.nearbyChains.some(
    (chain) =>
      chain !== "dollar-general" &&
      isShopperRankedChain(input.membership, chain),
  );
}

export function isDinnerEligibleForNearbyMarket(input: {
  chain: string;
  nearbyChains: readonly string[];
  membership: ChainMembershipSnapshot;
}): boolean {
  if (input.chain !== "dollar-general") {
    return true;
  }

  return isDollarGeneralDinnerEligible(input);
}
