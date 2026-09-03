/**
 * Runtime roster of who we *attempt* for dinner estimates and fail-loud ingest.
 * Production loads this from `chain_registry`. Floors (match count, confidence)
 * stay in code.
 */
export type ChainMembershipSnapshot = {
  shopperRankedChainIds: readonly string[];
  settingsSelectableChainIds: readonly string[];
  weeklyAdEligibleChainIds: readonly string[];
};

/**
 * Adapter ids that have dinner/weekly-ad code today. CI asserts every
 * `shopper_ranked` registry row is in this set — not that the set equals the DB.
 */
export const KNOWN_DINNER_ADAPTER_CHAIN_IDS = [
  "kroger",
  "aldi",
  "publix",
  "food-lion",
  "lidl",
  "walmart",
  "dollar-general",
] as const;

export type KnownDinnerAdapterChainId =
  (typeof KNOWN_DINNER_ADAPTER_CHAIN_IDS)[number];

/** Seeded `shopper_ranked` set after Lidl map-context demotion (`030`). */
export const FIXTURE_SHOPPER_RANKED_CHAIN_IDS = [
  "kroger",
  "aldi",
  "publix",
  "food-lion",
  "walmart",
  "dollar-general",
] as const;

/** Empty roster — no chain is attempted for dinners (fail closed). */
export const EMPTY_CHAIN_MEMBERSHIP: ChainMembershipSnapshot = {
  shopperRankedChainIds: [],
  settingsSelectableChainIds: [],
  weeklyAdEligibleChainIds: [],
};

/**
 * Test/CI snapshot matching the current seeded registry ranked set.
 * Production market-search and ingest must call `loadChainMembership()`.
 */
export const FIXTURE_CHAIN_MEMBERSHIP: ChainMembershipSnapshot = {
  shopperRankedChainIds: [...FIXTURE_SHOPPER_RANKED_CHAIN_IDS],
  settingsSelectableChainIds: [...FIXTURE_SHOPPER_RANKED_CHAIN_IDS],
  weeklyAdEligibleChainIds: [...KNOWN_DINNER_ADAPTER_CHAIN_IDS],
};

export function membershipFromRegistryRows(
  rows: readonly {
    chainId: string;
    shopperRanked: boolean;
    settingsSelectable: boolean;
    weeklyAdEligible: boolean;
  }[],
): ChainMembershipSnapshot {
  return {
    shopperRankedChainIds: rows
      .filter((row) => row.shopperRanked)
      .map((row) => row.chainId),
    settingsSelectableChainIds: rows
      .filter((row) => row.settingsSelectable)
      .map((row) => row.chainId),
    weeklyAdEligibleChainIds: rows
      .filter((row) => row.weeklyAdEligible)
      .map((row) => row.chainId),
  };
}

export function membershipFromShopperRankedIds(
  chainIds: readonly string[] | undefined,
): ChainMembershipSnapshot {
  if (!chainIds || chainIds.length === 0) {
    return EMPTY_CHAIN_MEMBERSHIP;
  }

  return {
    shopperRankedChainIds: [...chainIds],
    settingsSelectableChainIds: [...chainIds],
    weeklyAdEligibleChainIds: [...chainIds],
  };
}

export function isShopperRankedChain(
  membership: ChainMembershipSnapshot,
  chain: string | undefined,
): boolean {
  if (!chain) {
    return false;
  }

  return membership.shopperRankedChainIds.includes(chain);
}

export function isSettingsSelectableChain(
  membership: ChainMembershipSnapshot,
  chain: string | undefined,
): boolean {
  if (!chain) {
    return false;
  }

  return membership.settingsSelectableChainIds.includes(chain);
}

export function shopperRankedChainSet(
  membership: ChainMembershipSnapshot,
): Set<string> {
  return new Set(membership.shopperRankedChainIds);
}

export function rankedChainIdsHaveKnownAdapters(
  rankedChainIds: readonly string[],
): boolean {
  const known = new Set<string>(KNOWN_DINNER_ADAPTER_CHAIN_IDS);
  return rankedChainIds.every((chainId) => known.has(chainId));
}
