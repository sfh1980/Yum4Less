import {
  SHOPPER_RANKED_V1_CHAINS,
  type ShopperRankedV1Chain,
} from "@/lib/chain-rollout-policy";

export function shouldFailProviderPriceSyncExit(
  summaries: ReadonlyArray<{ failedCount: number }>,
): boolean {
  return summaries.some((summary) => summary.failedCount > 0);
}

/**
 * Weekly-ad flyer errors on unranked chains (Dollar General research stub)
 * must not fail scheduled ingest. Shopper-ranked banners stay fail-loud.
 * Missing `chain` on an error or persist failure stays fail-loud.
 */
export function isWeeklyAdFailLoudChain(chain: string | undefined): boolean {
  if (!chain) {
    return true;
  }

  return SHOPPER_RANKED_V1_CHAINS.includes(chain as ShopperRankedV1Chain);
}

export function shouldFailWeeklyAdIngestExit(input: {
  results: ReadonlyArray<{ status: string; chain?: string }>;
  syncSummaries: ReadonlyArray<{ failedCount: number; chain?: string }>;
}): boolean {
  if (
    input.syncSummaries.some(
      (summary) => summary.failedCount > 0 && isWeeklyAdFailLoudChain(summary.chain),
    )
  ) {
    return true;
  }

  return input.results.some(
    (result) => result.status === "error" && isWeeklyAdFailLoudChain(result.chain),
  );
}
