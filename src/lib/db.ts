import { Pool } from "pg";

let pool: Pool | undefined;

export function getDbPool() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not configured.");
  }

  pool ??= new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  return pool;
}

export async function resetDbPoolForTests() {
  if (!pool) {
    return;
  }

  await pool.end();
  pool = undefined;
}
