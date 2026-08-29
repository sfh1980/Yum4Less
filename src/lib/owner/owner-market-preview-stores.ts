import type { CatalogStore } from "@/lib/market-catalog-types";
import { mergeCatalogStoresForMap } from "@/lib/market-store-catalog-merge";
import {
  type OwnerMarketStorePreview,
} from "@/lib/owner/ingest-markets-copy";
import {
  applyZipLocalityFallback,
  compareOwnerMarketPreviewStores,
} from "@/lib/owner/owner-market-preview-format";

export {
  applyZipLocalityFallback,
  compareOwnerMarketPreviewStores,
  formatOwnerMarketPreviewLine,
  formatOwnerMarketPreviewLocality,
} from "@/lib/owner/owner-market-preview-format";

export type OwnerMarketPreviewOsmCandidate = {
  id?: string;
  name: string;
  city: string;
  state: string;
  kind: CatalogStore["kind"] | string;
  latitude: number;
  longitude: number;
  sourceName?: string;
};

export function buildOwnerMarketPreviewList(input: {
  catalogStores: CatalogStore[];
  osmStores: OwnerMarketPreviewOsmCandidate[];
  marketCity: string;
  marketState: string;
  limit: number;
}): { stores: OwnerMarketStorePreview[]; total: number } {
  const osmAsCatalog: CatalogStore[] = input.osmStores.map((store, index) => ({
    id: store.id?.trim() || `osm-preview-${index}`,
    name: store.name,
    kind: asStoreKind(store.kind),
    city: store.city,
    state: store.state,
    latitude: store.latitude,
    longitude: store.longitude,
    sourceName: store.sourceName,
  }));

  const merged = mergeCatalogStoresForMap(input.catalogStores, osmAsCatalog);
  const previewed = merged
    .map((store) => toPreviewStore(store, input))
    .sort(compareOwnerMarketPreviewStores);

  return {
    stores: previewed.slice(0, input.limit),
    total: previewed.length,
  };
}

function toPreviewStore(
  store: CatalogStore,
  market: { marketCity: string; marketState: string },
): OwnerMarketStorePreview {
  const locality = applyZipLocalityFallback(store, {
    city: market.marketCity,
    state: market.marketState,
  });
  return {
    name: store.name,
    kind: store.kind,
    city: locality.city,
    state: locality.state,
    localityIsApproximate: locality.localityIsApproximate,
  };
}

function asStoreKind(kind: string): CatalogStore["kind"] {
  if (
    kind === "grocery" ||
    kind === "big-box" ||
    kind === "specialty" ||
    kind === "dollar-market"
  ) {
    return kind;
  }
  return "grocery";
}
