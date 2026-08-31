import { createHash } from "node:crypto";
import { getDbPool } from "@/lib/db";
import { logServerError } from "@/lib/server-log";
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

export async function rememberWeeklyAdFlyerHash(input: {
  chain: string;
  contentHash: string;
  offerCount: number;
}): Promise<void> {
  if (!flyerHashDbEnabled()) {
    return;
  }
  try {
    await getDbPool().query(
      `
        insert into weekly_ad_flyer_hashes (chain, content_hash, offer_count, recorded_at)
        values ($1, $2, $3, now())
        on conflict (chain) do update set
          content_hash = excluded.content_hash,
          offer_count = excluded.offer_count,
          recorded_at = now()
      `,
      [input.chain, input.contentHash, input.offerCount],
    );
  } catch (error) {
    logServerError("weekly-ad-flyer-hash.remember", error);
  }
}

/**
 * True when this persist batch already has enough in-stock weekly-ad rows for
 * every target store. Hash-only skip is unsafe after a wipe that leaves a
 * partial leftover (e.g. 2 rows when promotion needs 3+).
 */
export async function weeklyAdObservationsExistForStores(input: {
  storeIds: readonly string[];
  sourceName: string;
  minObservationsPerStore: number;
}): Promise<boolean> {
  const storeIds = [...new Set(input.storeIds.filter(Boolean))];
  const minObservationsPerStore = Math.max(1, input.minObservationsPerStore);
  if (!flyerHashDbEnabled() || storeIds.length === 0) {
    return false;
  }

  try {
    const result = await getDbPool().query<{ store_id: string; n: string | number }>(
      `
        select store_id, count(*)::int as n
        from price_observations
        where store_id = any($1::text[])
          and in_stock
          and source_name = $2
        group by store_id
      `,
      [storeIds, input.sourceName],
    );
    const counts = new Map(
      result.rows.map((row) => [row.store_id, Number(row.n) || 0]),
    );
    return storeIds.every(
      (storeId) => (counts.get(storeId) ?? 0) >= minObservationsPerStore,
    );
  } catch {
    return false;
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
