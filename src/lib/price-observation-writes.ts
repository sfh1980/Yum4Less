import { getDbPool } from "@/lib/db";

export type PriceObservationInsert = {
  storeId: string;
  ingredientId: string;
  price: number;
  currencyCode?: string;
  saleLabel?: string;
  inStock?: boolean;
  observedAt: Date;
  sourceName: string;
  sourceRecordId: string;
  confidenceScore: number;
  notes: string;
};

export async function insertPriceObservation(input: PriceObservationInsert) {
  const pool = getDbPool();
  await pool.query(
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
        notes
      )
      values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
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
    ],
  );
}

export async function touchStoreVerification(input: {
  storeId: string;
  sourceName: string;
  sourceStoreId?: string;
}) {
  const pool = getDbPool();

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
  storeId: string;
  ingredientId: string;
  price: number;
  saleLabel: string | null;
  inStock: boolean;
  sourceName: string;
  sourceRecordId: string;
};

export type PriceObservationSyncOutcome = "inserted" | "skipped-unchanged";

export async function getLatestPriceObservation(input: {
  storeId: string;
  ingredientId: string;
}): Promise<LatestPriceObservation | null> {
  const pool = getDbPool();
  const result = await pool.query<{
    store_id: string;
    ingredient_id: string;
    price: string;
    sale_label: string | null;
    in_stock: boolean;
    source_name: string;
    source_record_id: string;
  }>(
    `
      select
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
      order by observed_at desc
      limit 1
    `,
    [input.storeId, input.ingredientId],
  );

  const row = result.rows[0];
  if (!row) {
    return null;
  }

  return {
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
  const latest = await getLatestPriceObservation({
    storeId: input.storeId,
    ingredientId: input.ingredientId,
  });

  if (latest && priceObservationsMateriallyMatch(latest, input)) {
    return "skipped-unchanged";
  }

  await insertPriceObservation(input);
  return "inserted";
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

export async function deleteAllPriceObservations() {
  const pool = getDbPool();
  await pool.query(`delete from price_observations`);
}
