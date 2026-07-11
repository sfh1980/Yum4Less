import { afterEach, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { getDbPool, resetDbPoolForTests } from "@/lib/db";

const SEED_SQL = readFileSync(
  join(process.cwd(), "db/init/022_seed_kroger_mechanicsville_identity.sql"),
  "utf8",
);

/**
 * T4: migration 022 seeds Kroger Mechanicsville identity idempotently
 * when both member store rows already exist.
 */
describe("store identity Kroger seed migration 022 (integration)", () => {
  afterEach(async () => {
    const pool = getDbPool();
    await pool.query(
      `delete from store_identity_aliases
       where identity_id = 'kroger-02900529'
          or store_id in ('kroger-02900529', 'kroger-mechanicsville')`,
    );
    await pool.query(
      `delete from store_identities where id = 'kroger-02900529'`,
    );
    await pool.query(`delete from stores where id = 'kroger-02900529'`);
    await resetDbPoolForTests();
  });

  it("T4: re-applying 022 yields one identity and two aliases (idempotent)", async () => {
    const pool = getDbPool();

    await pool.query(
      `insert into stores (
         id, name, kind, city, state, latitude, longitude, source_name, source_store_id
       ) values
         ('kroger-02900529', 'Kroger Marketplace - Kroger Marketplace', 'grocery',
          'Mechanicsville', 'VA', 37.61546, -77.32939, 'kroger-official-api', '02900529'),
         ('kroger-mechanicsville', 'Kroger', 'grocery',
          'Mechanicsville', 'VA', 37.6154615, -77.32939, 'kroger-weekly-ad-scrape',
          'kroger-mechanicsville')
       on conflict (id) do update set
         source_name = excluded.source_name,
         source_store_id = excluded.source_store_id,
         latitude = excluded.latitude,
         longitude = excluded.longitude`,
    );

    await pool.query(SEED_SQL);
    await pool.query(SEED_SQL);

    const identities = await pool.query<{ id: string; canonical_store_id: string }>(
      `select id, canonical_store_id from store_identities where id = 'kroger-02900529'`,
    );
    expect(identities.rows).toHaveLength(1);
    expect(identities.rows[0]?.canonical_store_id).toBe("kroger-02900529");

    const aliases = await pool.query<{
      store_id: string;
      member_role: string;
      link_status: string;
      match_method: string;
    }>(
      `select store_id, member_role, link_status, match_method
       from store_identity_aliases
       where identity_id = 'kroger-02900529'
       order by member_role desc, store_id`,
    );
    expect(aliases.rows).toHaveLength(2);
    expect(aliases.rows.map((row) => row.store_id).sort()).toEqual([
      "kroger-02900529",
      "kroger-mechanicsville",
    ]);
    expect(aliases.rows.every((row) => row.link_status === "confirmed")).toBe(
      true,
    );
    expect(aliases.rows.every((row) => row.match_method === "seeded")).toBe(
      true,
    );
    expect(
      aliases.rows.find((row) => row.member_role === "canonical")?.store_id,
    ).toBe("kroger-02900529");
    expect(
      aliases.rows.find((row) => row.member_role === "alias")?.store_id,
    ).toBe("kroger-mechanicsville");
  });
});
