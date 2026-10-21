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
): number {
  return left.name.localeCompare(right.name);
}
