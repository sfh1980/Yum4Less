import { Client } from "pg";
import { afterEach, describe, expect, it } from "vitest";
import { WEEKLY_AD_INGEST_LOCK_KEY } from "@/lib/weekly-ad-ingestion/weekly-ad-ingest-lock";

const held: Client[] = [];

async function connect(): Promise<Client> {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not configured.");
  }
  const client = new Client({ connectionString });
  await client.connect();
  held.push(client);
  return client;
}

describe("weekly-ad ingest lock", () => {
  afterEach(async () => {
    for (const client of held) {
      await client.query("select pg_advisory_unlock_all()").catch(() => undefined);
      await client.end().catch(() => undefined);
    }
    held.length = 0;
  });

  it("lets a second session skip while the first holds the lock", async () => {
    const first = await connect();
    const second = await connect();
    await first.query("select pg_try_advisory_lock($1::bigint)", [
      WEEKLY_AD_INGEST_LOCK_KEY,
    ]);
    const blocked = await second.query<{ locked: boolean }>(
      "select pg_try_advisory_lock($1::bigint) as locked",
      [WEEKLY_AD_INGEST_LOCK_KEY],
    );
    expect(blocked.rows[0]?.locked).toBe(false);

    await first.query("select pg_advisory_unlock($1::bigint)", [
      WEEKLY_AD_INGEST_LOCK_KEY,
    ]);
    const free = await second.query<{ locked: boolean }>(
      "select pg_try_advisory_lock($1::bigint) as locked",
      [WEEKLY_AD_INGEST_LOCK_KEY],
    );
    expect(free.rows[0]?.locked).toBe(true);
  });
});
