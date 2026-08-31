import { inferStoreChainFromName } from "@/lib/chain-rollout-policy";
import {
  FIXTURE_CHAIN_MEMBERSHIP,
  isShopperRankedChain,
  type ChainMembershipSnapshot,
} from "@/lib/chain-membership";
import {
  type OwnerMarketStorePreview,
} from "@/lib/owner/ingest-markets-copy";
import { isMissingStoreLocalityPart } from "@/lib/store-display-labels";

export function formatOwnerMarketPreviewLine(
  store: OwnerMarketStorePreview,
): string {
  const locality = formatOwnerMarketPreviewLocality(store);
  return locality ? `${store.name} · ${locality}` : store.name;
}

export function formatOwnerMarketPreviewLocality(
  store: Pick<OwnerMarketStorePreview, "city" | "state" | "localityIsApproximate">,
): string {
  const city = store.city.trim();
  const state = store.state.trim();
  if (!city && !state) {
    return "";
  }
  if (store.localityIsApproximate && city && state) {
    return `near ${city}, ${state}`;
  }
  if (city && state) {
    return `${city}, ${state}`;
  }
  return city || state;
}

export function applyZipLocalityFallback(
  store: { city: string; state: string },
  market: { city: string; state: string },
): Pick<OwnerMarketStorePreview, "city" | "state" | "localityIsApproximate"> {
  const cityMissing = isMissingStoreLocalityPart(store.city);
  const stateMissing = isMissingStoreLocalityPart(store.state);
  return {
    city: cityMissing ? market.city.trim() : store.city.trim(),
    state: stateMissing ? market.state.trim() : store.state.trim(),
    localityIsApproximate: cityMissing,
  };
}

export function compareOwnerMarketPreviewStores(
  left: OwnerMarketStorePreview,
  right: OwnerMarketStorePreview,
  membership: ChainMembershipSnapshot = FIXTURE_CHAIN_MEMBERSHIP,
): number {
  const rankDelta =
    previewPriority(left, membership) - previewPriority(right, membership);
  if (rankDelta !== 0) {
    return rankDelta;
  }
  return left.name.localeCompare(right.name);
}

function previewPriority(
  store: OwnerMarketStorePreview,
  membership: ChainMembershipSnapshot,
): number {
  const chain = inferStoreChainFromName(store.name);
  if (isShopperRankedChain(membership, chain)) {
    return 0;
  }
  if (store.kind === "grocery") {
    return 1;
  }
  if (store.kind === "big-box") {
    return 2;
  }
  return 3;
}
