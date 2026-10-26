import type { Pool, PoolClient } from "pg";
import { getDbPool } from "@/lib/db";
import { logServerError } from "@/lib/server-log";

type Queryable = Pick<Pool | PoolClient, "query">;

/**
 * Point the deleted id at the kept id. Redirects that already landed on the
 * deleted id move forward with it.
 */
export async function recordStoreIdRedirect(
  fromId: string,
  toId: string,
  pool: Queryable = getDbPool(),
): Promise<void> {
  if (!fromId || !toId || fromId === toId) {
    return;
  }

  await pool.query(
    `
      update store_id_redirects
      set to_id = $2
      where to_id = $1
        and from_id <> $2
    `,
    [fromId, toId],
  );
  await pool.query(`delete from store_id_redirects where from_id = $1`, [toId]);
  await pool.query(
    `
      insert into store_id_redirects (from_id, to_id)
      values ($1, $2)
      on conflict (from_id) do update set to_id = excluded.to_id
    `,
    [fromId, toId],
  );
}

/** Settings reads this map so a saved id still selects the kept building. */
export async function loadStoreIdRedirects(): Promise<Record<string, string>> {
  try {
    const result = await getDbPool().query<{ from_id: string; to_id: string }>(
      `select from_id, to_id from store_id_redirects`,
    );
    const redirects: Record<string, string> = {};
    for (const row of result.rows) {
      redirects[row.from_id] = row.to_id;
    }
    return redirects;
  } catch (error) {
    logServerError("store-id-redirects.load", error);
    return {};
  }
}
