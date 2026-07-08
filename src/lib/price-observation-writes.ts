import type { PoolClient } from "pg";
import { getDbPool } from "@/lib/db";
import {
  isFixtureOsmCatalogSource,
  isLiveOsmStoreId,
  isNonLiveOsmCatalogIdentity,
  isOsmStyleStoreId,
  OSM_MAP_CATALOG_SOURCE,
  OSM_MAP_FIXTURE_SOURCE,
} from "@/lib/osm-food-retail-discovery";
import {
  getRankedPriceSourceKind,
  getRankedPriceSourceTier,
  RANKED_PRICE_SOURCE_SQL_FILTER,
  RANKED_PRICE_SOURCE_TIER_SQL,
} from "@/lib/price-source-policy";
import { RANKED_PRICE_CACHE_AGE_SQL_FILTER } from "@/lib/ranked-price-cache-policy";
import { USDA_SNAP_CONTEXT_SOURCE } from "@/lib/map-context-types";

/** Keep inline to avoid circular imports with publix-catalog-sync. */
const PUBLIX_STORE_LOCATOR_SOURCE = "publix-store-locator";

/** Location-provenance rows — pricing touch must not rewrite stores.source_name. */
const LOCATION_PROVENANCE_SOURCE_NAMES = new Set<string>([
  OSM_MAP_CATALOG_SOURCE,
  OSM_MAP_FIXTURE_SOURCE,
  USDA_SNAP_CONTEXT_SOURCE,
  PUBLIX_STORE_LOCATOR_SOURCE,
]);

export function shouldPreserveStoreLocationProvenance(input: {
  storeId: string;
  currentSourceName?: string | null;
}): boolean {
  if (
    isOsmStyleStoreId(input.storeId) ||
    isNonLiveOsmCatalogIdentity({
      id: input.storeId,
      sourceName: input.currentSourceName,
    }) ||
    isLiveOsmStoreId(input.storeId)
  ) {
    return true;
  }

  if (
    input.currentSourceName &&
    LOCATION_PROVENANCE_SOURCE_NAMES.has(input.currentSourceName)
  ) {
    return true;
  }

  if (isFixtureOsmCatalogSource(input.currentSourceName)) {
    return true;
  }

  // Locator-style ids that are not weekly-ad / ranked pricing identity.
  if (
    input.storeId.startsWith("snap-") ||
    (input.storeId.startsWith("publix-") &&
      input.currentSourceName === PUBLIX_STORE_LOCATOR_SOURCE)
  ) {
    return true;
  }

  return false;
}

export type PriceObservationInsert = {
  storeId: string;
  ingredientId: string;
  price: number;
  currencyCode?: string;
  saleLabel?: string;
  inStock?: boolean;
  observedAt: Date;
  lastVerifiedAt?: Date;
  sourceName: string;
  sourceRecordId: string;
  confidenceScore: number;
  notes: string;
  validThrough?: Date;
};

type PriceObservationQueryable = Pick<PoolClient, "query">;

export async function insertPriceObservation(input: PriceObservationInsert) {
  await insertPriceObservationOnQueryable(getDbPool(), input);
}

async function insertPriceObservationOnQueryable(
  queryable: PriceObservationQueryable,
  input: PriceObservationInsert,
) {
  await queryable.query(
    `
      insert into price_observations (
        store_id,
        ingredient_id,
        price,
        currency_code,
        sale_label,
        in_stock,
        observed_at,
        source_name,
        source_record_id,
        confidence_score,
        notes,
        last_verified_at,
        source_kind,
        valid_through
      )
      values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
    `,
    [
      input.storeId,
      input.ingredientId,
      input.price,
      input.currencyCode ?? "USD",
      input.saleLabel ?? null,
      input.inStock ?? true,
      input.observedAt.toISOString(),
      input.sourceName,
      input.sourceRecordId,
      input.confidenceScore,
      input.notes,
      (input.lastVerifiedAt ?? input.observedAt).toISOString(),
      getRankedPriceSourceKind(input.sourceName),
      input.validThrough?.toISOString() ?? null,
    ],
  );
}

export async function touchStoreVerification(input: {
  storeId: string;
  sourceName: string;
  sourceStoreId?: string;
}) {
  const pool = getDbPool();
  const existing = await pool.query<{ source_name: string | null }>(
    `select source_name from stores where id = $1`,
    [input.storeId],
  );
  const currentSourceName = existing.rows[0]?.source_name ?? null;
  const preserveLocationProvenance = shouldPreserveStoreLocationProvenance({
    storeId: input.storeId,
    currentSourceName,
  });

  if (preserveLocationProvenance) {
    // Pricing / weekly-ad verification bumps last_verified_at only — never
    // overwrite OSM, fixture, SNAP, or locator location provenance.
    await pool.query(
      `
        update stores
        set last_verified_at = now()
        where id = $1
      `,
      [input.storeId],
    );
    return;
  }

  if (input.sourceStoreId) {
    await pool.query(
      `
        update stores
        set
          source_name = $1,
          source_store_id = $2,
          last_verified_at = now()
        where id = $3
      `,
      [input.sourceName, input.sourceStoreId, input.storeId],
    );
    return;
  }

  await pool.query(
    `
      update stores
      set
        source_name = $1,
        last_verified_at = now()
      where id = $2
    `,
    [input.sourceName, input.storeId],
  );
}

export function parseObservationTimestamp(value: string) {
  return Number.isNaN(Date.parse(value)) ? new Date() : new Date(value);
}

export type LatestPriceObservation = {
  id: number;
  storeId: string;
  ingredientId: string;
  price: number;
  saleLabel: string | null;
  inStock: boolean;
  sourceName: string;
  sourceRecordId: string;
};

export type PriceObservationSyncOutcome =
  | "inserted"
  | "skipped-unchanged"
  | "skipped-superseded";

const CURRENT_PRICE_OBSERVATION_SQL_FILTER =
  "(valid_through is null or valid_through >= now())";

export async function getCurrentRankedPriceObservationForStoreIngredient(input: {
  storeId: string;
  ingredientId: string;
}): Promise<LatestPriceObservation | null> {
  const pool = getDbPool();
  const result = await pool.query<{
    store_id: string;
    ingredient_id: string;
    id: number;
    price: string;
    sale_label: string | null;
    in_stock: boolean;
    source_name: string;
    source_record_id: string;
  }>(
    `
      select
        id,
        store_id,
        ingredient_id,
        price,
        sale_label,
        in_stock,
        source_name,
        source_record_id
      from price_observations
      where store_id = $1
        and ingredient_id = $2
        and (${RANKED_PRICE_SOURCE_SQL_FILTER})
        and ${CURRENT_PRICE_OBSERVATION_SQL_FILTER}
        and ${RANKED_PRICE_CACHE_AGE_SQL_FILTER}
      order by ${RANKED_PRICE_SOURCE_TIER_SQL} asc,
        coalesce(last_verified_at, observed_at) desc,
        confidence_score desc nulls last,
        observed_at desc
      limit 1
    `,
    [input.storeId, input.ingredientId],
  );

  const row = result.rows[0];
  if (!row) {
    return null;
  }

  return mapLatestPriceObservationRow(row);
}

function mapLatestPriceObservationRow(row: {
  store_id: string;
  ingredient_id: string;
  id: number;
  price: string;
  sale_label: string | null;
  in_stock: boolean;
  source_name: string;
  source_record_id: string;
}): LatestPriceObservation {
  return {
    id: row.id,
    storeId: row.store_id,
    ingredientId: row.ingredient_id,
    price: Number(row.price),
    saleLabel: row.sale_label,
    inStock: row.in_stock,
    sourceName: row.source_name,
    sourceRecordId: row.source_record_id,
  };
}

export function priceObservationsMateriallyMatch(
  latest: LatestPriceObservation,
  incoming: Pick<
    PriceObservationInsert,
    "storeId" | "ingredientId" | "price" | "saleLabel" | "inStock" | "sourceName" | "sourceRecordId"
  >,
): boolean {
  if (latest.storeId !== incoming.storeId) {
    return false;
  }

  return (
    roundCurrency(latest.price) === roundCurrency(incoming.price) &&
    normalizeSaleLabel(latest.saleLabel) ===
      normalizeSaleLabel(incoming.saleLabel ?? null) &&
    latest.inStock === (incoming.inStock ?? true) &&
    latest.sourceName === incoming.sourceName &&
    latest.sourceRecordId === incoming.sourceRecordId
  );
}

export async function insertPriceObservationIfChanged(
  input: PriceObservationInsert,
): Promise<PriceObservationSyncOutcome> {
  const incomingTier = getRankedPriceSourceTier(input.sourceName);
  const current = await getCurrentRankedPriceObservationForStoreIngredient({
    storeId: input.storeId,
    ingredientId: input.ingredientId,
  });

  if (current) {
    const currentTier = getRankedPriceSourceTier(current.sourceName);
    if (incomingTier > currentTier) {
      return "skipped-superseded";
    }

    if (
      current.sourceName === input.sourceName &&
      current.sourceRecordId === input.sourceRecordId &&
      priceObservationsMateriallyMatch(current, input)
    ) {
      await touchPriceObservationVerification({
        id: current.id,
        verifiedAt: input.lastVerifiedAt ?? input.observedAt,
        validThrough: input.validThrough,
      });
      await deleteRankedPriceObservationsForStoreIngredient({
        storeId: input.storeId,
        ingredientId: input.ingredientId,
        keepId: current.id,
      });
      return "skipped-unchanged";
    }
  }

  await replaceRankedPriceObservationTransactionally(input);
  return "inserted";
}

async function replaceRankedPriceObservationTransactionally(
  input: PriceObservationInsert,
) {
  const pool = getDbPool();
  const client = await pool.connect();

  try {
    await client.query("begin");
    await deleteRankedPriceObservationsForStoreIngredientOnQueryable(client, {
      storeId: input.storeId,
      ingredientId: input.ingredientId,
    });
    await insertPriceObservationOnQueryable(client, input);
    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

export async function deleteRankedPriceObservationsForStoreIngredient(input: {
  storeId: string;
  ingredientId: string;
  keepId?: number;
}) {
  await deleteRankedPriceObservationsForStoreIngredientOnQueryable(getDbPool(), input);
}

async function deleteRankedPriceObservationsForStoreIngredientOnQueryable(
  queryable: PriceObservationQueryable,
  input: {
    storeId: string;
    ingredientId: string;
    keepId?: number;
  },
) {
  await queryable.query(
    `
      delete from price_observations
      where store_id = $1
        and ingredient_id = $2
        and (${RANKED_PRICE_SOURCE_SQL_FILTER})
        and ($3::bigint is null or id <> $3)
    `,
    [input.storeId, input.ingredientId, input.keepId ?? null],
  );
}

function normalizeSaleLabel(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed.toLowerCase() : null;
}

function roundCurrency(value: number) {
  return Math.round(value * 100) / 100;
}

export async function deletePriceObservationsForStore(storeId: string) {
  const pool = getDbPool();
  await pool.query(`delete from price_observations where store_id = $1`, [storeId]);
}

/** Remove ranked sale rows outside the cache window or past valid_through. */
export async function purgeStaleRankedPriceObservations(): Promise<number> {
  const pool = getDbPool();
  const result = await pool.query(
    `
      delete from price_observations
      where (${RANKED_PRICE_SOURCE_SQL_FILTER})
        and (
          not (${RANKED_PRICE_CACHE_AGE_SQL_FILTER})
          or not (${CURRENT_PRICE_OBSERVATION_SQL_FILTER})
        )
    `,
  );

  return result.rowCount ?? 0;
}

async function touchPriceObservationVerification(input: {
  id: number;
  verifiedAt: Date;
  validThrough?: Date;
}) {
  const pool = getDbPool();
  await pool.query(
    `
      update price_observations
      set
        last_verified_at = greatest(coalesce(last_verified_at, observed_at), $1::timestamptz),
        valid_through = case
          when $2::timestamptz is null then valid_through
          when valid_through is null then $2::timestamptz
          else greatest(valid_through, $2::timestamptz)
        end
      where id = $3
    `,
    [input.verifiedAt.toISOString(), input.validThrough?.toISOString() ?? null, input.id],
  );
}
