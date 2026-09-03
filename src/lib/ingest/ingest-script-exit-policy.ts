import {
  FIXTURE_CHAIN_MEMBERSHIP,
  isShopperRankedChain,
  type ChainMembershipSnapshot,
} from "@/lib/chain-membership";

export function shouldFailProviderPriceSyncExit(
  summaries: ReadonlyArray<{ failedCount: number }>,
): boolean {
  return summaries.some((summary) => summary.failedCount > 0);
}

/**
 * Weekly-ad flyer errors on unranked chains (Lidl map-context) must not fail
 * scheduled ingest. Shopper-ranked banners stay fail-loud.
 * Missing `chain` on an error or persist failure stays fail-loud.
 */
export function isWeeklyAdFailLoudChain(
  chain: string | undefined,
  membership: ChainMembershipSnapshot = FIXTURE_CHAIN_MEMBERSHIP,
): boolean {
  if (!chain) {
    return true;
  }

  return isShopperRankedChain(membership, chain);
}

export function shouldFailWeeklyAdIngestExit(input: {
  results: ReadonlyArray<{ status: string; chain?: string }>;
  syncSummaries: ReadonlyArray<{ failedCount: number; chain?: string }>;
  membership?: ChainMembershipSnapshot;
}): boolean {
  const membership = input.membership ?? FIXTURE_CHAIN_MEMBERSHIP;
  if (
    input.syncSummaries.some(
      (summary) =>
        summary.failedCount > 0 &&
        isWeeklyAdFailLoudChain(summary.chain, membership),
    )
  ) {
    return true;
  }

  return input.results.some(
    (result) =>
      result.status === "error" && isWeeklyAdFailLoudChain(result.chain, membership),
  );
}
