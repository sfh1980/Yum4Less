import type { NearbyStoreSummary } from "@/lib/recommendation-service";
import {
  insertPriceObservationIfChanged,
  parseObservationTimestamp,
  touchStoreVerification,
} from "@/lib/price-observation-writes";
import { KROGER_OFFICIAL_PRICE_SOURCE as OFFICIAL_API_SOURCE } from "@/lib/price-source-policy";
import { isKrogerOfficialOnlinePricingEligible } from "@/lib/providers/kroger/kroger-api-types";
import type {
  ProviderPricingPreviewItem,
  ProviderPricingPreviewResult,
} from "@/lib/providers/provider-types";
import { isApiDerivedKrogerCatalogStoreId } from "@/lib/store-catalog-sync";
import { logServerError } from "@/lib/server-log";

const KROGER_OFFICIAL_PRICE_SOURCE = OFFICIAL_API_SOURCE;
const MIN_SYNC_MATCH_CONFIDENCE = 0.45;

export type ProviderPriceObservationSkipReason =
  | "wrong-provider"
  | "not-production"
  | "no-preview-items"
  | "store-mapping-failed"
  | "low-confidence";

export type ProviderPriceObservationSyncSummary = {
  provider: "kroger";
  internalStoreId?: string;
  syncedCount: number;
  unchangedCount: number;
  skippedCount: number;
  failedCount: number;
  retrievalMode: ProviderPricingPreviewResult["retrievalMode"];
  skipReason?: ProviderPriceObservationSkipReason;
  message: string;
};

export async function syncKrogerPreviewToPriceObservations(input: {
  preview: ProviderPricingPreviewResult;
  nearbyStores: NearbyStoreSummary[];
}): Promise<ProviderPriceObservationSyncSummary> {
  const baseSummary = {
    provider: "kroger" as const,
    syncedCount: 0,
    unchangedCount: 0,
    skippedCount: 0,
    failedCount: 0,
    retrievalMode: input.preview.retrievalMode,
  };

  if (input.preview.provider !== "kroger") {
    return {
      ...baseSummary,
      skipReason: "wrong-provider",
      message: "Only Kroger previews can be synced in this MVP slice.",
    };
  }

  if (!isKrogerOfficialOnlinePricingEligible()) {
    return {
      ...baseSummary,
      skippedCount: input.preview.items.length,
      skipReason: "not-production",
      message:
        "Kroger official-online price sync requires KROGER_API_ENV=production. Certification returns catalog data only, so Yum4Less kept existing ingested cache observations.",
    };
  }

  if (input.preview.provenance !== "official-api" || input.preview.items.length === 0) {
    return {
      ...baseSummary,
      skippedCount: input.preview.items.length,
      skipReason: "no-preview-items",
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
      skipReason: "store-mapping-failed",
      message:
        `Kroger preview for locationId ${input.preview.providerStoreId} could not be mapped to a trusted local store record (expected bootstrap id kroger-mechanicsville or source_store_id match). Yum4Less kept existing ingested cache observations.`,
    };
  }

  let syncedCount = 0;
  let unchangedCount = 0;
  let skippedCount = 0;
  let failedCount = 0;

  for (const item of input.preview.items) {
    const outcome = await persistPreviewItemAsPriceObservation({
      internalStoreId,
      providerStoreId: input.preview.providerStoreId,
      item,
      observedAt: input.preview.fetchedAt,
      retrievalMode: input.preview.retrievalMode,
    });

    if (outcome === "inserted") {
      syncedCount += 1;
    } else if (outcome === "unchanged") {
      unchangedCount += 1;
    } else if (outcome === "failed") {
      failedCount += 1;
    } else {
      skippedCount += 1;
    }
  }

  await touchStoreProviderLink({
    internalStoreId,
    providerStoreId: input.preview.providerStoreId,
  });

  const resultSummary = {
    ...baseSummary,
    internalStoreId,
    syncedCount,
    unchangedCount,
    skippedCount,
    failedCount,
  };

  if (failedCount > 0) {
    return {
      ...resultSummary,
      message: `Kroger price sync reported ${failedCount} persist failure(s) for ${internalStoreId}. Check logs for ingredientId and providerProductId.`,
    };
  }

  if (syncedCount === 0 && unchangedCount === 0) {
    return {
      ...resultSummary,
      skipReason: "low-confidence",
      message:
        "Kroger preview items were evaluated, but none met the minimum match-confidence threshold or had a usable store price to sync.",
    };
  }

  return {
    ...resultSummary,
    message: buildKrogerSyncSuccessMessage({
      syncedCount,
      unchangedCount,
      internalStoreId,
      providerStoreId: input.preview.providerStoreId,
      retrievalMode: input.preview.retrievalMode,
    }),
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

export function isKrogerProviderLocationId(value: string | null | undefined): boolean {
  if (!value) {
    return false;
  }

  return /^\d{6,10}$/.test(value.trim());
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

  const bySourceStoreId = krogerStores.filter(
    (store) => store.sourceStoreId === input.providerStoreId,
  );
  if (bySourceStoreId.length > 0) {
    const bootstrapMatch = bySourceStoreId.find(
      (store) => !isApiDerivedKrogerCatalogStoreId(store.id),
    );
    if (bootstrapMatch) {
      return bootstrapMatch.id;
    }

    if (bySourceStoreId.length === 1) {
      return bySourceStoreId[0]!.id;
    }
  }

  const canonicalId = `kroger-${input.providerStoreId}`;
  const byCanonicalId = krogerStores.find((store) => store.id === canonicalId);
  if (byCanonicalId) {
    return byCanonicalId.id;
  }

  const normalizedProviderStoreId = normalizeStoreEvidence(input.providerStoreId);
  const byProviderStoreId = krogerStores.filter((store) =>
    normalizeStoreEvidence(store.id).includes(normalizedProviderStoreId),
  );
  if (byProviderStoreId.length === 1) {
    return byProviderStoreId[0]!.id;
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
}): Promise<"inserted" | "unchanged" | "skipped" | "failed"> {
  if (input.item.matchConfidence < MIN_SYNC_MATCH_CONFIDENCE) {
    return "skipped";
  }

  const unitPrice = getPreviewUnitPrice(input.item);
  if (unitPrice === undefined) {
    return "skipped";
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

    if (outcome === "inserted") {
      return "inserted";
    }

    if (outcome === "skipped-unchanged") {
      return "unchanged";
    }

    return "skipped";
  } catch (error) {
    logServerError("provider-price-observation-sync.persistPreviewItem", error, {
      internalStoreId: input.internalStoreId,
      providerStoreId: input.providerStoreId,
      ingredientId: input.item.ingredientId,
      providerProductId: input.item.providerProductId,
      description: input.item.description,
    });
    return "failed";
  }
}

function buildKrogerSyncSuccessMessage(input: {
  syncedCount: number;
  unchangedCount: number;
  internalStoreId: string;
  providerStoreId: string;
  retrievalMode: ProviderPricingPreviewResult["retrievalMode"];
}) {
  const freshnessNote =
    input.retrievalMode === "live"
      ? "Recently checked Kroger online prices"
      : "Saved Kroger preview snapshot prices";
  const locationNote = `for ${input.internalStoreId} (locationId ${input.providerStoreId}, source kroger-official-api)`;

  if (input.syncedCount > 0 && input.unchangedCount === 0) {
    return `${freshnessNote} synced ${input.syncedCount} new ingredient price observation(s) into PostgreSQL ${locationNote}. Ranked meal pricing can use these rows on the next read while promotion gates still apply.`;
  }

  if (input.syncedCount === 0 && input.unchangedCount > 0) {
    return `${freshnessNote} verified ${input.unchangedCount} existing ingredient price observation(s) ${locationNote}; no new rows were inserted, but last_verified_at was refreshed. Ranked meal pricing can use these rows on the next read while promotion gates still apply.`;
  }

  return `${freshnessNote} synced ${input.syncedCount} new and verified ${input.unchangedCount} existing ingredient price observation(s) in PostgreSQL ${locationNote}. Ranked meal pricing can use these rows on the next read while promotion gates still apply.`;
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
