import { getDbPool } from "@/lib/db";

export type AreaInterestRow = {
  zip: string;
  requestCount: number;
  firstRequestedAt: string;
  lastRequestedAt: string;
};

const LIST_LIMIT = 50;

export async function upsertAreaInterest(zip: string): Promise<void> {
  const pool = getDbPool();
  await pool.query(
    `
      insert into area_interest (zip, first_requested_at, last_requested_at, request_count)
      values ($1, now(), now(), 1)
      on conflict (zip) do update
        set last_requested_at = now(),
            request_count = area_interest.request_count + 1
    `,
    [zip],
  );
}

/** Owner read. Sorted by how many times the ZIP was requested. */
export async function listAreaInterest(): Promise<AreaInterestRow[]> {
  const pool = getDbPool();
  const result = await pool.query<{
    zip: string;
    request_count: number;
    first_requested_at: Date;
    last_requested_at: Date;
  }>(
    `
      select zip, request_count, first_requested_at, last_requested_at
      from area_interest
      where zip ~ '^[0-9]{5}$'
      order by request_count desc, last_requested_at desc, zip asc
      limit $1
    `,
    [LIST_LIMIT],
  );

  return result.rows.map((row) => ({
    zip: row.zip,
    requestCount: Number(row.request_count),
    firstRequestedAt: row.first_requested_at.toISOString(),
    lastRequestedAt: row.last_requested_at.toISOString(),
  }));
}
