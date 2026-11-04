import { getDbPool } from "@/lib/db";
import type { CatalogPriceObservation } from "@/lib/market-catalog-types";
import {
  getRankedPriceSourceKind,
  RANKED_PRICE_SOURCE_SQL_FILTER,
  RANKED_PRICE_SOURCE_TIER_SQL,
} from "@/lib/price-source-policy";
import {
  RANKED_PRICE_CACHE_AGE_SQL_FILTER,
  rankedPriceWindowSql,
} from "@/lib/ranked-price-cache-policy";

// Pricing-only reads: ranked price observations, freshness gates, and debug rows.

function rankedPriceObservationsSql(windowSql: string): string {
  return `
  select distinct on (store_id, ingredient_id)
    store_id,
    ingredient_id,
    price,
    sale_label,
    in_stock,
    source_name,
    confidence_score,
    observed_at,
    last_verified_at,
    valid_through,
    ${RANKED_PRICE_SOURCE_TIER_SQL} as source_tier,
    greatest(0, floor(extract(epoch from (now() - coalesce(last_verified_at, observed_at))) / 3600))::int as freshness_hours_ago,
    greatest(0, round(extract(epoch from (now() - observed_at)) / 86400))::int as freshness_days_ago
  from price_observations
  where (${RANKED_PRICE_SOURCE_SQL_FILTER})
    and ${windowSql}
    and ${RANKED_PRICE_CACHE_AGE_SQL_FILTER}
  order by store_id, ingredient_id, source_tier asc, coalesce(last_verified_at, observed_at) desc, confidence_score desc nulls last, observed_at desc
`;
}

export async function loadRankedPriceObservations(): Promise<CatalogPriceObservation[]> {
  const pool = getDbPool();
  const pricesResult = await pool.query<PriceObservationRow>(
    rankedPriceObservationsSql(await rankedPriceWindowSql(pool)),
  );
  return pricesResult.rows.map(mapPriceObservationRow);
}

export async function countLivePriceObservationsForStore(storeId: string): Promise<number> {
  const pool = getDbPool();
  const result = await pool.query<{ count: string }>(
    `
      select count(*)::text as count
      from price_observations
      where store_id = $1
        and (${RANKED_PRICE_SOURCE_SQL_FILTER})
        and ${await rankedPriceWindowSql(pool)}
        and ${RANKED_PRICE_CACHE_AGE_SQL_FILTER}
    `,
    [storeId],
  );

  return Number(result.rows[0]?.count ?? 0);
}

/** Dev-only pipeline debug: ranked observations with verification timestamps. */
export async function getRankedPriceObservationsWithTimestamps(): Promise<
  PipelinePriceObservationRow[]
> {
  const pool = getDbPool();
  const result = await pool.query<PipelinePriceObservationRow>(
    rankedPriceObservationsSql(await rankedPriceWindowSql(pool)),
  );
  return result.rows;
}

function mapPriceObservationRow(row: PriceObservationRow): CatalogPriceObservation {
  return {
    storeId: row.store_id,
    ingredientId: row.ingredient_id,
    price: Number(row.price),
    saleLabel: row.sale_label ?? undefined,
    freshnessDaysAgo: row.freshness_days_ago,
    freshnessHoursAgo: row.freshness_hours_ago,
    inStock: row.in_stock,
    priceSource: row.source_name ?? undefined,
    priceSourceKind: getRankedPriceSourceKind(row.source_name ?? undefined),
    priceSourceTier: row.source_tier,
    matchConfidence:
      row.confidence_score !== null && row.confidence_score !== undefined
        ? Number(row.confidence_score)
        : undefined,
  };
}

export type PipelinePriceObservationRow = {
  store_id: string;
  ingredient_id: string;
  price: string;
  sale_label: string | null;
  source_name: string | null;
  confidence_score: string | null;
  observed_at: Date;
  last_verified_at: Date | null;
  valid_through: Date | null;
  freshness_hours_ago: number;
  freshness_days_ago: number;
};

type PriceObservationRow = {
  store_id: string;
  ingredient_id: string;
  price: string;
  sale_label: string | null;
  in_stock: boolean;
  source_name: string | null;
  confidence_score: string | null;
  observed_at: Date;
  last_verified_at: Date | null;
  valid_through: Date | null;
  source_tier: number;
  freshness_hours_ago: number;
  freshness_days_ago: number;
};
