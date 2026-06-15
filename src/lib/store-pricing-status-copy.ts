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
      return "Limited coverage — directional";
    }
    if (input.chain === "walmart") {
      return "Context only — no Walmart pricing";
    }
    return "Context only";
  }

  if (input.rolloutStatus === "weekly-ad-preview") {
    return "Est. weekly-ad prices";
  }

  if (input.rolloutStatus === "official-api-preview") {
    return input.chain === "kroger" ? "Est. Kroger API prices" : "Est. official API prices";
  }

  if (input.rolloutStatus === "limited-coverage") {
    return "Limited coverage — directional";
  }

  return "Context only";
}

/** Map tooltip / popup pricing line (scannable without opening popup). */
export function buildStoreMapPricingLabel(input: StorePricingStatusInput): string {
  if (input.recommendationEnabled) {
    if (input.rolloutStatus === "weekly-ad-preview") {
      return "Est. weekly-ad prices — verify in store";
    }
    if (input.rolloutStatus === "official-api-preview") {
      return input.chain === "kroger"
        ? "Est. Kroger API prices — verify in store"
        : "Est. official API prices — verify in store";
    }
    return "Limited weekly-ad coverage — directional";
  }

  if (input.chain === "walmart") {
    return "No live Walmart pricing yet";
  }

  if (input.rolloutStatus === "limited-coverage") {
    return "Limited weekly-ad coverage";
  }

  if (input.chain === "unknown") {
    return "Available in a future release";
  }

  return "Coming soon — map context only";
}
