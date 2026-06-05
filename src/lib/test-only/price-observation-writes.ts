import { getDbPool } from "@/lib/db";
import { assertTestDbWipeAllowed } from "@/lib/test-db-wipe-policy";

/**
 * Test-only helper: wipes every row in price_observations.
 * Blocked outside NODE_ENV=test.
 */
export async function deleteAllPriceObservations() {
  assertTestDbWipeAllowed("deleteAllPriceObservations");
  const pool = getDbPool();
  await pool.query(`delete from price_observations`);
}
