import { getDbPool } from "@/lib/db";

export type ActiveMarketStatus = "active" | "paused" | "retired";
export type ActiveMarketSource = "ops" | "organic_usage" | "bootstrap";

export type ActiveMarketRow = {
  zipCode: string;
  status: ActiveMarketStatus;
  priority: number;
  source: ActiveMarketSource;
  latitude: number | null;
  longitude: number | null;
  notes: string | null;
  updatedAt: string | null;
};

const ZIP5 = /^\d{5}$/;

type ActiveMarketSqlRow = {
  zip_code: string;
  status: ActiveMarketStatus;
  priority: number;
  source: ActiveMarketSource;
  latitude: string | number | null;
  longitude: string | number | null;
  notes: string | null;
  updated_at: Date | string | null;
};

function normalizeZipCode(zipCode: string): string {
  return zipCode.trim();
}

function parseOptionalCoordinate(value: string | number | null): number | null {
  if (value === null) {
    return null;
  }
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function mapActiveMarketRow(row: ActiveMarketSqlRow): ActiveMarketRow {
  return {
    zipCode: row.zip_code.trim(),
    status: row.status,
    priority: row.priority,
    source: row.source,
    latitude: parseOptionalCoordinate(row.latitude),
    longitude: parseOptionalCoordinate(row.longitude),
    notes: row.notes,
    updatedAt:
      row.updated_at instanceof Date
        ? row.updated_at.toISOString()
        : row.updated_at,
  };
}

export function isMissingActiveMarketsSchema(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /does not exist/i.test(message) && /active_markets/i.test(message);
}

export async function listActiveMarketZipCodes(): Promise<string[]> {
  if (!process.env.DATABASE_URL) {
    return [];
  }

  const result = await getDbPool().query<{ zip_code: string }>(
    `
      select zip_code
      from active_markets
      where status = 'active'
      order by priority asc, zip_code asc
    `,
  );

  return result.rows
    .map((row) => row.zip_code.trim())
    .filter((zip) => ZIP5.test(zip));
}

export async function listIngestMarkets(): Promise<ActiveMarketRow[]> {
  const result = await getDbPool().query<ActiveMarketSqlRow>(
    `
      select
        zip_code,
        status,
        priority,
        source,
        latitude,
        longitude,
        notes,
        updated_at
      from active_markets
      order by
        case status
          when 'active' then 0
          when 'paused' then 1
          else 2
        end,
        zip_code asc
    `,
  );

  return result.rows.map(mapActiveMarketRow);
}

export async function readIngestMarket(
  zipCode: string,
): Promise<ActiveMarketRow | null> {
  const normalized = normalizeZipCode(zipCode);
  if (!ZIP5.test(normalized)) {
    return null;
  }

  const result = await getDbPool().query<ActiveMarketSqlRow>(
    `
      select
        zip_code,
        status,
        priority,
        source,
        latitude,
        longitude,
        notes,
        updated_at
      from active_markets
      where zip_code = $1
    `,
    [normalized],
  );

  const row = result.rows[0];
  return row ? mapActiveMarketRow(row) : null;
}

export async function upsertActiveMarket(input: {
  zipCode: string;
  source?: ActiveMarketSource;
  latitude?: number | null;
  longitude?: number | null;
  notes?: string | null;
}): Promise<void> {
  const zipCode = normalizeZipCode(input.zipCode);
  if (!ZIP5.test(zipCode)) {
    throw new Error(`active_markets requires a 5-digit ZIP, got "${input.zipCode}".`);
  }

  await getDbPool().query(
    `
      insert into active_markets (
        zip_code,
        status,
        source,
        latitude,
        longitude,
        notes
      )
      values ($1, 'active', $2, $3, $4, $5)
      on conflict (zip_code) do update set
        status = 'active',
        source = excluded.source,
        latitude = coalesce(excluded.latitude, active_markets.latitude),
        longitude = coalesce(excluded.longitude, active_markets.longitude),
        notes = coalesce(excluded.notes, active_markets.notes),
        updated_at = now()
    `,
    [
      zipCode,
      input.source ?? "ops",
      input.latitude ?? null,
      input.longitude ?? null,
      input.notes ?? null,
    ],
  );
}
