import type { NearbyStoreSummary } from "@/lib/recommendation-service";
import {
  insertPriceObservationIfChanged,
  parseObservationTimestamp,
  touchStoreVerification,
} from "@/lib/price-observation-writes";
import { KROGER_OFFICIAL_PRICE_SOURCE as OFFICIAL_API_SOURCE } from "@/lib/price-source-policy";
import type {
  ProviderPricingPreviewItem,
  ProviderPricingPreviewResult,
} from "@/lib/providers/provider-types";

const KROGER_OFFICIAL_PRICE_SOURCE = OFFICIAL_API_SOURCE;
const MIN_SYNC_MATCH_CONFIDENCE = 0.45;

export type ProviderPriceObservationSyncSummary = {
  provider: "kroger";
  internalStoreId?: string;
  syncedCount: number;
  skippedCount: number;
  retrievalMode: ProviderPricingPreviewResult["retrievalMode"];
  message: string;
};

export async function syncKrogerPreviewToPriceObservations(input: {
  preview: ProviderPricingPreviewResult;
  nearbyStores: NearbyStoreSummary[];
}): Promise<ProviderPriceObservationSyncSummary> {
  const baseSummary = {
    provider: "kroger" as const,
    syncedCount: 0,
    skippedCount: 0,
    retrievalMode: input.preview.retrievalMode,
  };

  if (input.preview.provider !== "kroger") {
    return {
      ...baseSummary,
      message: "Only Kroger previews can be synced in this MVP slice.",
    };
  }

  if (input.preview.provenance !== "official-api" || input.preview.items.length === 0) {
    return {
      ...baseSummary,
      skippedCount: input.preview.items.length,
      message:
        "No official Kroger preview items were available to sync into local price observations.",
    };
  }

  const internalStoreId = resolveInternalKrogerStoreId({
    previewStoreName: input.preview.storeName,
    providerStoreId: input.preview.providerStoreId,
    nearbyStores: input.nearbyStores,
  });

  if (!internalStoreId) {
    return {
      ...baseSummary,
      skippedCount: input.preview.items.length,
      message:
        "Kroger preview prices could not be mapped to a trusted local store record, so Yum4Less kept the existing ingested cache observations.",
    };
  }

  let syncedCount = 0;
  let skippedCount = 0;

  for (const item of input.preview.items) {
    const synced = await persistPreviewItemAsPriceObservation({
      internalStoreId,
      providerStoreId: input.preview.providerStoreId,
      item,
      observedAt: input.preview.fetchedAt,
      retrievalMode: input.preview.retrievalMode,
    });

    if (synced) {
      syncedCount += 1;
    } else {
      skippedCount += 1;
    }
  }

  await touchStoreProviderLink({
    internalStoreId,
    providerStoreId: input.preview.providerStoreId,
  });

  if (syncedCount === 0) {
    return {
      ...baseSummary,
      internalStoreId,
      skippedCount,
      message:
        "Kroger preview items were evaluated, but none met the minimum match-confidence threshold for local price observation sync.",
    };
  }

  const freshnessNote =
    input.preview.retrievalMode === "live"
      ? "Recently checked Kroger online prices"
      : "Saved Kroger preview snapshot prices";

  return {
    ...baseSummary,
    internalStoreId,
    syncedCount,
    skippedCount,
    message: `${freshnessNote} synced ${syncedCount} ingredient price observation(s) into PostgreSQL for ${internalStoreId}. Ranked meal pricing can use these rows on the next read while the MVP promotion lock still applies to provider-preview promotion gates.`,
  };
}

export async function syncProviderPreviewsToPriceObservations(input: {
  previews: ProviderPricingPreviewResult[];
  nearbyStores: NearbyStoreSummary[];
}): Promise<ProviderPriceObservationSyncSummary[]> {
  const summaries: ProviderPriceObservationSyncSummary[] = [];

  for (const preview of input.previews) {
    if (preview.provider !== "kroger") {
      continue;
    }

    summaries.push(
      await syncKrogerPreviewToPriceObservations({
        preview,
        nearbyStores: input.nearbyStores,
      }),
    );
  }

  return summaries;
}

export function resolveInternalKrogerStoreId(input: {
  previewStoreName: string;
  providerStoreId: string;
  nearbyStores: NearbyStoreSummary[];
}): string | undefined {
  const krogerStores = input.nearbyStores.filter((store) => store.chain === "kroger");
  if (krogerStores.length === 0) {
    return undefined;
  }

  const normalizedProviderStoreId = normalizeStoreEvidence(input.providerStoreId);
  const byProviderStoreId = krogerStores.filter((store) =>
    normalizeStoreEvidence(store.id).includes(normalizedProviderStoreId),
  );
  if (byProviderStoreId.length === 1) {
    return byProviderStoreId[0]?.id;
  }

  const normalizedPreviewName = normalizeStoreEvidence(input.previewStoreName);
  const byStrongName = krogerStores.filter((store) => {
    const normalizedStoreName = normalizeStoreEvidence(store.name);
    return (
      normalizedPreviewName.length > "kroger".length &&
      normalizedStoreName.length > "kroger".length &&
      (normalizedPreviewName.includes(normalizedStoreName) ||
        normalizedStoreName.includes(normalizedPreviewName))
    );
  });

  return byStrongName.length === 1 ? byStrongName[0]?.id : undefined;
}

function normalizeStoreEvidence(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

async function persistPreviewItemAsPriceObservation(input: {
  internalStoreId: string;
  providerStoreId: string;
  item: ProviderPricingPreviewItem;
  observedAt: string;
  retrievalMode: ProviderPricingPreviewResult["retrievalMode"];
}) {
  if (input.item.matchConfidence < MIN_SYNC_MATCH_CONFIDENCE) {
    return false;
  }

  const unitPrice = getPreviewUnitPrice(input.item);
  if (unitPrice === undefined) {
    return false;
  }

  const saleLabel = getPreviewSaleLabel(input.item);
  const observedAt = parseObservationTimestamp(input.observedAt);

  try {
    const outcome = await insertPriceObservationIfChanged({
      storeId: input.internalStoreId,
      ingredientId: input.item.ingredientId,
      price: unitPrice,
      currencyCode: input.item.currencyCode ?? "USD",
      saleLabel,
      inStock: input.item.inStock,
      observedAt,
      sourceName: KROGER_OFFICIAL_PRICE_SOURCE,
      sourceRecordId: input.item.providerProductId,
      confidenceScore: input.item.matchConfidence,
      notes: buildObservationNotes(input.item, input.retrievalMode),
    });

    return outcome === "inserted";
  } catch {
    return false;
  }
}

async function touchStoreProviderLink(input: {
  internalStoreId: string;
  providerStoreId: string;
}) {
  try {
    await touchStoreVerification({
      storeId: input.internalStoreId,
      sourceName: KROGER_OFFICIAL_PRICE_SOURCE,
      sourceStoreId: input.providerStoreId,
    });
  } catch {
    // Store linkage is helpful but non-blocking for price sync.
  }
}

function getPreviewUnitPrice(item: ProviderPricingPreviewItem) {
  if (typeof item.promoPrice === "number") {
    return item.promoPrice;
  }

  if (typeof item.regularPrice === "number") {
    return item.regularPrice;
  }

  return undefined;
}

function getPreviewSaleLabel(item: ProviderPricingPreviewItem) {
  if (
    typeof item.promoPrice === "number" &&
    typeof item.regularPrice === "number" &&
    item.promoPrice < item.regularPrice
  ) {
    return "Kroger promo price";
  }

  if (typeof item.promoPrice === "number") {
    return "Kroger promotional price";
  }

  return undefined;
}

function buildObservationNotes(
  item: ProviderPricingPreviewItem,
  retrievalMode: ProviderPricingPreviewResult["retrievalMode"],
) {
  const modeLabel =
    retrievalMode === "live"
      ? "recent official Kroger API preview"
      : "saved Kroger preview snapshot";
  return `${modeLabel}; matched ${item.description}; ${item.matchReason}`;
}

export { KROGER_OFFICIAL_PRICE_SOURCE, MIN_SYNC_MATCH_CONFIDENCE };
