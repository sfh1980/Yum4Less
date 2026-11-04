import { Client } from "pg";

/**
 * One weekly-ad writer at a time. The 3:00am run waits. A retry skips.
 * The lock is held on this connection until release, and Postgres drops it
 * when the process exits.
 */
export const WEEKLY_AD_INGEST_LOCK_KEY = 874411;

export type WeeklyAdIngestLock =
  | { acquired: true; release: () => Promise<void> }
  | { acquired: false };

export async function acquireWeeklyAdIngestLock(input: {
  connectionString: string;
  wait: boolean;
}): Promise<WeeklyAdIngestLock> {
  const client = new Client({ connectionString: input.connectionString });
  await client.connect();
  if (input.wait) {
    await client.query("select pg_advisory_lock($1::bigint)", [
      WEEKLY_AD_INGEST_LOCK_KEY,
    ]);
    return {
      acquired: true,
      release: () => releaseWeeklyAdIngestLock(client),
    };
  }

  const result = await client.query<{ locked: boolean }>(
    "select pg_try_advisory_lock($1::bigint) as locked",
    [WEEKLY_AD_INGEST_LOCK_KEY],
  );
  if (result.rows[0]?.locked !== true) {
    await client.end();
    return { acquired: false };
  }
  return {
    acquired: true,
    release: () => releaseWeeklyAdIngestLock(client),
  };
}

async function releaseWeeklyAdIngestLock(client: Client): Promise<void> {
  try {
    await client.query("select pg_advisory_unlock($1::bigint)", [
      WEEKLY_AD_INGEST_LOCK_KEY,
    ]);
  } finally {
    await client.end();
  }
}
