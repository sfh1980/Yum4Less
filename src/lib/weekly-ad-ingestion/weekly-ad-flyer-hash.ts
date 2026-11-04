import { createHash } from "node:crypto";
import { getDbPool } from "@/lib/db";
import { logServerError } from "@/lib/server-log";
import { readWeeklyAdMaxUnverifiedDays } from "@/lib/weekly-ad-ingestion/weekly-ad-settings";
import type { WeeklyAdOffer } from "@/lib/weekly-ad-ingestion/weekly-ad-ingestion-types";

export function weeklyAdFlyerContentHash(
  offers: Pick<WeeklyAdOffer, "productName" | "price" | "saleLabel">[],
): string {
  const canonical = [...offers]
    .map(
      (offer) =>
        `${offer.productName.trim().toLowerCase()}|${offer.price}|${offer.saleLabel ?? ""}`,
    )
    .sort()
    .join("\n");
  return createHash("sha256").update(canonical).digest("hex");
}

function flyerHashDbEnabled(): boolean {
  if (!process.env.DATABASE_URL) {
    return false;
  }
  if (process.env.NODE_ENV === "test" && process.env.YUM4LESS_FLYER_HASH !== "1") {
    return false;
  }
  return true;
}

export async function readWeeklyAdFlyerHash(
  chain: string,
): Promise<string | null> {
  if (!flyerHashDbEnabled()) {
    return null;
  }
  try {
    const result = await getDbPool().query<{ content_hash: string }>(
      `select content_hash from weekly_ad_flyer_hashes where chain = $1`,
      [chain],
    );
    return result.rows[0]?.content_hash ?? null;
  } catch {
    return null;
  }
}

export async function readWeeklyAdFlyerRawCardCount(
  chain: string,
): Promise<number | null> {
  if (!flyerHashDbEnabled()) {
    return null;
  }
  try {
    const result = await getDbPool().query<{ raw_card_count: number | string | null }>(
      `select raw_card_count from weekly_ad_flyer_hashes where chain = $1`,
      [chain],
    );
    const raw = result.rows[0]?.raw_card_count;
    if (raw === undefined || raw === null) {
      return null;
    }
    const count = Number(raw);
    return Number.isFinite(count) ? count : null;
  } catch {
    return null;
  }
}

export async function readWeeklyAdFlyerOfferCount(
  chain: string,
): Promise<number | null> {
  if (!flyerHashDbEnabled()) {
    return null;
  }
  try {
    const result = await getDbPool().query<{ offer_count: number | string }>(
      `select offer_count from weekly_ad_flyer_hashes where chain = $1`,
      [chain],
    );
    const raw = result.rows[0]?.offer_count;
    if (raw === undefined || raw === null) {
      return null;
    }
    const count = Number(raw);
    return Number.isFinite(count) ? count : null;
  } catch {
    return null;
  }
}

/**
 * Keep the stored offer_count when the new count is under half of it.
 * An absent or zero memory takes the new count.
 */
export function offerCountToRemember(
  previous: number | null,
  incoming: number,
): number {
  if (previous !== null && previous > 0 && incoming * 2 < previous) {
    return previous;
  }
  return incoming;
}

export async function rememberWeeklyAdFlyerHash(input: {
  chain: string;
  contentHash: string;
  offerCount: number;
  rawCardCount?: number;
}): Promise<void> {
  if (!flyerHashDbEnabled()) {
    return;
  }
  try {
    const previous = await readWeeklyAdFlyerOfferCount(input.chain);
    const offerCount = offerCountToRemember(previous, input.offerCount);
    const rawCardCount =
      input.rawCardCount === undefined
        ? null
        : offerCountToRemember(
            await readWeeklyAdFlyerRawCardCount(input.chain),
            input.rawCardCount,
          );
    await getDbPool().query(
      `
        insert into weekly_ad_flyer_hashes (
          chain, content_hash, offer_count, raw_card_count, recorded_at
        )
        values ($1, $2, $3, $4, now())
        on conflict (chain) do update set
          content_hash = excluded.content_hash,
          offer_count = excluded.offer_count,
          raw_card_count = coalesce(excluded.raw_card_count, weekly_ad_flyer_hashes.raw_card_count),
          recorded_at = now()
      `,
      [input.chain, input.contentHash, offerCount, rawCardCount],
    );
  } catch (error) {
    logServerError("weekly-ad-flyer-hash.remember", error);
  }
}

/**
 * Stores that already have this flyer's in-stock rows.
 * A store counts only when distinct source_record_id matches cover that
 * store's offers. Any other rows for the chain do not. A partial leftover
 * (2 matching rows when this flyer has 3 offers) does not count.
 * Returns an empty set when the hash table is off or the read fails, so the
 * caller writes instead of skipping.
 */
export async function weeklyAdStoresCoveredByFlyer(input: {
  storeIds: readonly string[];
  sourceName: string;
  sourceRecordIds: readonly string[];
  offerCountByStore: ReadonlyMap<string, number>;
}): Promise<Set<string>> {
  const storeIds = [...new Set(input.storeIds.filter(Boolean))];
  const sourceRecordIds = [...new Set(input.sourceRecordIds.filter(Boolean))];
  if (!flyerHashDbEnabled() || storeIds.length === 0 || sourceRecordIds.length === 0) {
    return new Set();
  }

  try {
    const result = await getDbPool().query<{ store_id: string; n: string | number }>(
      `
        select store_id, count(distinct source_record_id)::int as n
        from price_observations
        where store_id = any($1::text[])
          and in_stock
          and source_name = $2
          and source_record_id = any($3::text[])
        group by store_id
      `,
      [storeIds, input.sourceName, sourceRecordIds],
    );
    const counts = new Map(
      result.rows.map((row) => [row.store_id, Number(row.n) || 0]),
    );
    const covered = new Set<string>();
    for (const storeId of storeIds) {
      const needed = Math.max(1, input.offerCountByStore.get(storeId) ?? 1);
      if ((counts.get(storeId) ?? 0) >= needed) {
        covered.add(storeId);
      }
    }
    return covered;
  } catch {
    return new Set();
  }
}

export function shouldSkipUnchangedFlyerPersist(input: {
  previousHash: string | null;
  nextHash: string;
  targetStoresHaveObservations: boolean;
}): boolean {
  return (
    Boolean(input.previousHash) &&
    input.previousHash === input.nextHash &&
    input.targetStoresHaveObservations
  );
}

/**
 * The unchanged-hash skip does not rewrite prices. Ranked reads still require
 * last_verified_at or observed_at inside 24 hours, so bump last_verified_at
 * on the rows this flyer already wrote. observed_at stays.
 *
 * A later parsed end raises valid_through (greatest). A missing or earlier
 * end does not clear or shorten it. A row already past valid_through is left
 * alone. The weekly-ad step purges those rows before this refresh, so a
 * correction has to run while the stored end is still in the future. For
 * Whole Foods rows stored as 2026-11-03T05:00:00Z, that is the Monday
 * 2026-11-02 3:00am Eastern night. Tuesday's purge deletes them first.
 *
 * A row whose observed_at is older than YUM4LESS_WEEKLY_AD_MAX_UNVERIFIED_DAYS
 * is left alone so a stuck source stops looking fresh.
 */
export async function refreshUnchangedWeeklyAdVerification(input: {
  storeIds: readonly string[];
  sourceName: string;
  sourceRecordIds: readonly string[];
  validThroughBySourceRecordId?: ReadonlyMap<string, Date | null>;
}): Promise<number> {
  const storeIds = [...new Set(input.storeIds.filter(Boolean))];
  const sourceRecordIds = [...new Set(input.sourceRecordIds.filter(Boolean))];
  if (!flyerHashDbEnabled() || storeIds.length === 0 || sourceRecordIds.length === 0) {
    return 0;
  }

  const maxUnverifiedDays = readWeeklyAdMaxUnverifiedDays();
  const validThroughValues = sourceRecordIds.map((sourceRecordId) => {
    const value = input.validThroughBySourceRecordId?.get(sourceRecordId);
    return value ? value.toISOString() : null;
  });
  const result = await getDbPool().query(
    `
      update price_observations as po
      set
        last_verified_at = now(),
        valid_through = case
          when v.valid_through is null then po.valid_through
          when po.valid_through is null then v.valid_through::timestamptz
          else greatest(po.valid_through, v.valid_through::timestamptz)
        end
      from unnest($3::text[], $5::text[]) as v(source_record_id, valid_through)
      where po.store_id = any($1::text[])
        and po.source_name = $2
        and po.source_record_id = v.source_record_id
        and po.in_stock
        and (po.valid_through is null or po.valid_through >= now())
        and po.observed_at >= now() - ($4::int * interval '1 day')
    `,
    [storeIds, input.sourceName, sourceRecordIds, maxUnverifiedDays, validThroughValues],
  );
  return result.rowCount ?? 0;
}
