/// <reference path="./test-only/scripts-migrations.d.ts" />
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  applyPendingMigrations,
  createPostgresMigrationDb,
  IDENTITY_SEED_SPECS,
  identitySeedEffectPresent,
  listInitMigrationFiles,
  migrationEffectPresent,
} from "@scripts-lib/apply-migrations";
import {
  columnExists,
  createDatabase,
  dropDatabaseIfExists,
  psqlApplySqlContent,
  psqlQueryRows,
  psqlQueryScalar,
  tableExists,
} from "@scripts-lib/spawn-safe";

const TEST_DB = "yum4less_migration_itest";

function migrationDb(databaseName = TEST_DB) {
  return createPostgresMigrationDb(databaseName, {
    tableExists,
    columnExists,
    psqlQueryScalar,
    psqlQueryRows,
    psqlApplySqlContent,
  });
}

function recreateTestDatabase() {
  dropDatabaseIfExists(TEST_DB);
  createDatabase(TEST_DB);
}

function readLedger(databaseName = TEST_DB) {
  if (!tableExists("schema_migrations", databaseName)) {
    return [];
  }
  return psqlQueryRows(
    databaseName,
    "select version, filename, checksum, applied_at::text from schema_migrations order by version;",
  );
}

describe("migration ledger integration", () => {
  it(
    "applies missing 015/016 on a partially migrated legacy volume",
    () => {
    recreateTestDatabase();

    // One docker-exec round-trip for legacy 001–013 (avoids 13× sequential overhead on Windows).
    const legacyBootstrapSql = listInitMigrationFiles()
      .filter((fileName) => {
        const version = fileName.slice(0, 3);
        return version >= "001" && version <= "013";
      })
      .map((fileName) =>
        readFileSync(join(process.cwd(), "db", "init", fileName), "utf8"),
      )
      .join("\n");
    psqlApplySqlContent(TEST_DB, legacyBootstrapSql);

    psqlApplySqlContent(
      TEST_DB,
      `insert into stores (id, name, kind, city, state, latitude, longitude, source_name)
       values ('publix-atlee', 'Publix', 'grocery', 'Mechanicsville', 'VA', 37.66, -77.36, 'yum4less-internal-catalog');`,
    );

    expect(readLedger()).toHaveLength(0);

    // Scope to what this case asserts — do not pay for 017–023 docker probes.
    const summary = applyPendingMigrations(migrationDb(), {
      stopAfterVersion: "016",
    });

    expect(summary.applied).toContain("015");
    expect(readLedger().map((row) => String(row.version))).toContain("015");
    expect(readLedger().map((row) => String(row.version))).toContain("016");
    expect(psqlQueryScalar(TEST_DB, "select count(*) from stores where id = 'publix-atlee';")).toBe("0");
    expect(psqlQueryScalar(TEST_DB, "select count(*) from stores where id = 'publix-1626';")).toBe("1");
    },
    90_000,
  );

  it(
    "backfills ledger rows without re-applying SQL after docker-style init",
    () => {
    recreateTestDatabase();

    for (const fileName of listInitMigrationFiles()) {
      const sql = readFileSync(join(process.cwd(), "db", "init", fileName), "utf8");
      psqlApplySqlContent(TEST_DB, sql);
    }

    const krogerBefore = psqlQueryScalar(
      TEST_DB,
      "select count(*) from provider_search_terms where provider = 'kroger';",
    );

    expect(readLedger()).toHaveLength(0);

    const summary = applyPendingMigrations(migrationDb());
    const krogerAfter = psqlQueryScalar(
      TEST_DB,
      "select count(*) from provider_search_terms where provider = 'kroger';",
    );

    expect(summary.applied).toEqual([]);
    expect(summary.backfilled.length).toBe(listInitMigrationFiles().length);
    expect(readLedger()).toHaveLength(listInitMigrationFiles().length);
    expect(krogerAfter).toBe(krogerBefore);
    },
    180_000,
  );

  it(
    "022/023 proof-of-catch: broken self-only identity fails probe and post-apply throw",
    () => {
      recreateTestDatabase();
      applyPendingMigrations(migrationDb(), { stopAfterVersion: "021" });

      psqlApplySqlContent(
        TEST_DB,
        `
        insert into stores (id, name, kind, city, state, latitude, longitude, source_name, source_store_id)
        values
          ('kroger-02900529', 'Kroger Marketplace', 'grocery', 'Mechanicsville', 'VA', 37.61546, -77.32939, 'kroger-official-api', '02900529'),
          ('kroger-mechanicsville', 'Kroger', 'grocery', 'Mechanicsville', 'VA', 37.61546, -77.32939, 'kroger-weekly-ad-scrape', 'kroger-mechanicsville'),
          ('aldi-mechanicsville', 'Aldi', 'grocery', 'Mechanicsville', 'VA', 37.611004, -77.336853, 'aldi-weekly-ad-scrape', 'aldi-mechanicsville'),
          ('osm-node-6531578976', 'ALDI', 'grocery', 'Mechanicsville', 'VA', 37.611004, -77.336853, 'openstreetmap-overpass', 'osm-node-6531578976')
        on conflict (id) do update set
          source_name = excluded.source_name,
          source_store_id = excluded.source_store_id;

        insert into store_identities (id, canonical_store_id, display_name)
        values
          ('kroger-02900529', 'kroger-02900529', 'Kroger Marketplace'),
          ('aldi-mechanicsville', 'aldi-mechanicsville', 'Aldi');

        insert into store_identity_aliases (
          identity_id, source_system, external_id, store_id,
          member_role, link_status, match_method, match_confidence
        ) values
          ('kroger-02900529', 'kroger-official-api', '02900529', 'kroger-02900529',
           'canonical', 'confirmed', 'self', 1.0),
          ('aldi-mechanicsville', 'aldi-weekly-ad-scrape', 'aldi-mechanicsville', 'aldi-mechanicsville',
           'canonical', 'confirmed', 'self', 1.0);
        `,
      );

      const db = migrationDb();
      expect(migrationEffectPresent("022", db)).toBe(false);
      expect(migrationEffectPresent("023", db)).toBe(false);

      expect(() =>
        applyPendingMigrations(db, { stopAfterVersion: "022" }),
      ).toThrow(/Migration 022 applied but identity seed effect is incomplete/);

      expect(readLedger().map((row) => String(row.version))).not.toContain("022");

      // Drop Kroger members so 022 becomes a vacuous no-op; keep Aldi broken for 023.
      psqlApplySqlContent(
        TEST_DB,
        `
        delete from store_identity_aliases
         where identity_id = 'kroger-02900529'
            or store_id in ('kroger-02900529', 'kroger-mechanicsville');
        delete from store_identities where id = 'kroger-02900529';
        delete from stores where id in ('kroger-02900529', 'kroger-mechanicsville');
        `,
      );
      expect(migrationEffectPresent("022", db)).toBe(true);
      expect(migrationEffectPresent("023", db)).toBe(false);

      expect(() =>
        applyPendingMigrations(db, { stopAfterVersion: "023" }),
      ).toThrow(/Migration 023 applied but identity seed effect is incomplete/);

      expect(readLedger().map((row) => String(row.version))).toContain("022");
      expect(readLedger().map((row) => String(row.version))).not.toContain("023");
    },
    180_000,
  );

  it(
    "022/023 proof-of-catch: clean both-members seed passes probe after apply",
    () => {
      recreateTestDatabase();
      applyPendingMigrations(migrationDb(), { stopAfterVersion: "021" });

      psqlApplySqlContent(
        TEST_DB,
        `
        insert into stores (id, name, kind, city, state, latitude, longitude, source_name, source_store_id)
        values
          ('kroger-02900529', 'Kroger Marketplace', 'grocery', 'Mechanicsville', 'VA', 37.61546, -77.32939, 'kroger-official-api', '02900529'),
          ('kroger-mechanicsville', 'Kroger', 'grocery', 'Mechanicsville', 'VA', 37.61546, -77.32939, 'kroger-weekly-ad-scrape', 'kroger-mechanicsville'),
          ('aldi-mechanicsville', 'Aldi', 'grocery', 'Mechanicsville', 'VA', 37.611004, -77.336853, 'aldi-weekly-ad-scrape', 'aldi-mechanicsville'),
          ('osm-node-6531578976', 'ALDI', 'grocery', 'Mechanicsville', 'VA', 37.611004, -77.336853, 'openstreetmap-overpass', 'osm-node-6531578976')
        on conflict (id) do update set
          source_name = excluded.source_name,
          source_store_id = excluded.source_store_id;
        `,
      );

      const db = migrationDb();
      expect(migrationEffectPresent("022", db)).toBe(false);
      expect(migrationEffectPresent("023", db)).toBe(false);

      const summary = applyPendingMigrations(db, { stopAfterVersion: "023" });
      expect(summary.applied).toEqual(expect.arrayContaining(["022", "023"]));
      expect(migrationEffectPresent("022", db)).toBe(true);
      expect(migrationEffectPresent("023", db)).toBe(true);
      expect(identitySeedEffectPresent(db, IDENTITY_SEED_SPECS["022"])).toBe(true);
      expect(identitySeedEffectPresent(db, IDENTITY_SEED_SPECS["023"])).toBe(true);
      expect(readLedger().map((row) => String(row.version))).toEqual(
        expect.arrayContaining(["022", "023"]),
      );
    },
    180_000,
  );
});
