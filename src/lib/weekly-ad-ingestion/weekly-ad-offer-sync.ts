import { getDbPool } from "@/lib/db";
import {
  insertPriceObservationIfChanged,
  parseObservationTimestamp,
  touchStoreVerification,
} from "@/lib/price-observation-writes";
import { logServerError } from "@/lib/server-log";
import {
  MIN_WEEKLY_AD_MATCH_CONFIDENCE,
} from "@/lib/weekly-ad-ingestion/weekly-ad-ingredient-matching";
import type {
  WeeklyAdIngestionResult,
  WeeklyAdOffer,
  WeeklyAdOfferSyncSummary,
} from "@/lib/weekly-ad-ingestion/weekly-ad-ingestion-types";
import { getWeeklyAdSourceName } from "@/lib/weekly-ad-ingestion/weekly-ad-ingestion-types";

export async function syncWeeklyAdOffersToPriceObservations(input: {
  result: WeeklyAdIngestionResult;
}): Promise<WeeklyAdOfferSyncSummary> {
  const baseSummary: WeeklyAdOfferSyncSummary = {
    chain: input.result.chain,
    storeId: "",
    syncedCount: 0,
    skippedCount: 0,
    failedCount: 0,
    retrievalMode: input.result.retrievalMode,
    message: input.result.message,
  };

  if (input.result.offers.length === 0) {
    return {
      ...baseSummary,
      message:
        input.result.message ||
        `No ${input.result.chain} weekly-ad offers were available to sync into PostgreSQL.`,
    };
  }

  const storeId = input.result.offers[0]?.storeId;
  if (!storeId) {
    return baseSummary;
  }

  const offersToPersist = selectBestWeeklyAdOffersPerIngredient(input.result.offers);

  let syncedCount = 0;
  let skippedCount = 0;
  let failedCount = 0;

  for (const offer of offersToPersist) {
    const outcome = await persistWeeklyAdOffer(offer, input.result);
    if (outcome === "inserted") {
      syncedCount += 1;
    } else if (outcome === "failed") {
      failedCount += 1;
    } else {
      skippedCount += 1;
    }
  }

  if (failedCount > 0) {
    return {
      ...baseSummary,
      storeId,
      syncedCount,
      skippedCount,
      failedCount,
      message: `${input.result.chain} weekly-ad sync reported ${failedCount} persist failure(s) for ${storeId}. Check logs for storeId, ingredientId, and sourceRecordId.`,
    };
  }

  if (syncedCount === 0) {
    return {
      ...baseSummary,
      storeId,
      skippedCount,
      failedCount,
      message: `${input.result.chain} weekly-ad offers were parsed, but none met the minimum ingredient match threshold for PostgreSQL sync.`,
    };
  }

  return {
    ...baseSummary,
    storeId,
    syncedCount,
    skippedCount,
    failedCount,
    message: `Synced ${syncedCount} ${input.result.chain} weekly-ad price observation(s) into PostgreSQL for ${storeId}. Ranked meal pricing can read these rows on the next DB snapshot while chain rollout gates still apply.`,
  };
}

type PersistWeeklyAdOutcome = "inserted" | "skipped" | "failed";

async function persistWeeklyAdOffer(
  offer: WeeklyAdOffer,
  result: WeeklyAdIngestionResult,
): Promise<PersistWeeklyAdOutcome> {
  // Ranked writes keep one current row per store + ingredient; higher-trust
  // official API prices supersede weekly-ad rows for the same ingredient.
  if (!offer.ingredientId) {
    return "skipped";
  }

  if (
    offer.matchConfidence !== undefined &&
    offer.matchConfidence < MIN_WEEKLY_AD_MATCH_CONFIDENCE
  ) {
    return "skipped";
  }

  const sourceName = getWeeklyAdSourceName(result.chain);
  const observedAt = parseObservationTimestamp(offer.observedAt);
  const sourceRecordId = `${offer.storeId}:${offer.ingredientId}:${offer.productName}`;

  try {
    const outcome = await insertPriceObservationIfChanged({
      storeId: offer.storeId,
      ingredientId: offer.ingredientId,
      price: offer.price,
      saleLabel: offer.saleLabel ?? `${result.chain} weekly-ad special`,
      observedAt,
      sourceName,
      sourceRecordId,
      confidenceScore: offer.matchConfidence ?? offer.confidenceScore,
      notes: buildWeeklyAdObservationNotes(offer, result),
      validThrough: parseOptionalObservationTimestamp(offer.validThrough),
    });

    if (outcome === "skipped-unchanged" || outcome === "skipped-superseded") {
      return "skipped";
    }

    await touchStoreVerification({
      storeId: offer.storeId,
      sourceName,
    });

    return "inserted";
  } catch (error) {
    logServerError("weekly-ad-offer-sync.persistWeeklyAdOffer", error, {
      chain: result.chain,
      storeId: offer.storeId,
      ingredientId: offer.ingredientId,
      sourceRecordId,
      productName: offer.productName,
    });
    return "failed";
  }
}

function selectBestWeeklyAdOffersPerIngredient(offers: WeeklyAdOffer[]): WeeklyAdOffer[] {
  const bestByIngredient = new Map<string, WeeklyAdOffer>();

  for (const offer of offers) {
    if (!offer.ingredientId) {
      continue;
    }

    const current = bestByIngredient.get(offer.ingredientId);
    if (!current) {
      bestByIngredient.set(offer.ingredientId, offer);
      continue;
    }

    const currentConfidence = current.matchConfidence ?? current.confidenceScore;
    const nextConfidence = offer.matchConfidence ?? offer.confidenceScore;
    if (
      nextConfidence > currentConfidence ||
      (nextConfidence === currentConfidence && offer.price < current.price)
    ) {
      bestByIngredient.set(offer.ingredientId, offer);
    }
  }

  return [...bestByIngredient.values()];
}

function parseOptionalObservationTimestamp(value: string | undefined) {
  if (!value || Number.isNaN(Date.parse(value))) {
    return undefined;
  }

  return new Date(value);
}

function buildWeeklyAdObservationNotes(
  offer: WeeklyAdOffer,
  result: WeeklyAdIngestionResult,
) {
  const modeLabel =
    result.retrievalMode === "live"
      ? "current weekly-ad scrape"
      : "saved weekly-ad snapshot";
  return `${modeLabel}; matched ${offer.productName}; verify package size and sale timing in store.`;
}

/** All-time weekly-ad row counts in Postgres — intentionally ignores the 24h ranked-read window. */
export async function getWeeklyAdIngestionStatusSummaries(input: {
  storeIds: string[];
}): Promise<
  import("@/lib/weekly-ad-ingestion/weekly-ad-ingestion-types").WeeklyAdIngestionStatusSummary[]
> {
  if (input.storeIds.length === 0 || !process.env.DATABASE_URL) {
    return [];
  }

  try {
    const pool = getDbPool();
    const result = await pool.query<{
      store_id: string;
      source_name: string;
      observation_count: number;
      last_captured_at: string;
    }>(
      `
        select
          store_id,
          source_name,
          count(*)::int as observation_count,
          max(captured_at) as last_captured_at
        from price_observations
        where store_id = any($1::text[])
          and source_name like '%-weekly-ad-scrape'
        group by store_id, source_name
        order by last_captured_at desc
      `,
      [input.storeIds],
    );

    return result.rows.map((row) => ({
      chain: parseWeeklyAdChainFromSource(row.source_name),
      storeId: row.store_id,
      sourceName: row.source_name,
      observationCount: row.observation_count,
      lastCapturedAt: row.last_captured_at,
      message: `${row.observation_count} all-time scraped weekly-ad row(s) in PostgreSQL for ${row.store_id} (${row.source_name}); not a freshness signal.`,
    }));
  } catch {
    return [];
  }
}

function parseWeeklyAdChainFromSource(sourceName: string) {
  return sourceName.replace(/-weekly-ad-scrape$/, "") as WeeklyAdOffer["chain"];
}
