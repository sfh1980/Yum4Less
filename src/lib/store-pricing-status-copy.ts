import type { ProviderRolloutStatus, StoreChain } from "@/lib/provider-rollout";

export type StorePricingStatusInput = {
  recommendationEnabled: boolean;
  rolloutStatus: ProviderRolloutStatus;
  chain: StoreChain;
};

/** Short pill label for store list cards. */
export function buildStoreListStatusPill(input: StorePricingStatusInput): string {
  if (!input.recommendationEnabled) {
    if (input.rolloutStatus === "limited-coverage") {
      return "Limited coverage — estimate only";
    }
    return "Context only";
  }

  if (input.rolloutStatus === "weekly-ad-preview") {
    return "Est. sale prices";
  }

  if (input.rolloutStatus === "official-api-preview") {
    return "Est. store prices";
  }

  if (input.rolloutStatus === "limited-coverage") {
    return "Limited coverage — estimate only";
  }

  return "Context only";
}

/** Map tooltip / popup pricing line (scannable without opening popup). */
export function buildStoreMapPricingLabel(input: StorePricingStatusInput): string {
  if (input.recommendationEnabled) {
    if (input.rolloutStatus === "weekly-ad-preview") {
      return "Est. sale prices — verify in store";
    }
    if (input.rolloutStatus === "official-api-preview") {
      return "Est. store prices — verify in store";
    }
    return "Limited sale coverage — estimate only";
  }

  if (input.rolloutStatus === "limited-coverage") {
    return "Limited sale coverage";
  }

  if (input.chain === "unknown") {
    return "Available in a future release";
  }

  return "Coming soon — map context only";
}
