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
};

const ZIP5 = /^\d{5}$/;

function normalizeZipCode(zipCode: string): string {
  return zipCode.trim();
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
