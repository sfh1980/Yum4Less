import { describe, expect, it } from "vitest";
import {
  buildLedgerInsertSql,
  computeMigrationChecksum,
  listInitMigrationFiles,
  migrationEffectPresent,
  parseMigrationVersion,
} from "./apply-migrations.mjs";

describe("parseMigrationVersion", () => {
  it("reads the numeric prefix from init filenames", () => {
    expect(parseMigrationVersion("015_retire_publix_atlee_bootstrap.sql")).toBe("015");
    expect(parseMigrationVersion("000_schema_migrations.sql")).toBe("000");
  });
});

describe("buildLedgerInsertSql", () => {
  it("escapes single quotes in filenames", () => {
    const sql = buildLedgerInsertSql("015", "015_owner's.sql", "abc123");
    expect(sql).toContain("'015_owner''s.sql'");
    expect(sql).toContain("on conflict (version) do nothing");
  });
});

describe("listInitMigrationFiles", () => {
  it("includes the ledger bootstrap and sorted init migrations", () => {
    const files = listInitMigrationFiles();
    expect(files[0]).toBe("000_schema_migrations.sql");
    expect(files).toContain("015_retire_publix_atlee_bootstrap.sql");
    expect(files).toContain("021_store_identities.sql");
    expect(files).toContain("022_seed_kroger_mechanicsville_identity.sql");
    expect(files).toContain("023_seed_aldi_mechanicsville_identity.sql");
    expect(files.length).toBeGreaterThanOrEqual(21);
  });
});

describe("migrationEffectPresent", () => {
  it("detects schema objects from mocked probes", () => {
    const db = {
      tableExists: (name) => name === "recipes" || name === "stores",
      columnExists: () => false,
      queryScalar: (sql) => {
        if (sql.includes("publix-atlee")) {
          return "1";
        }
        if (sql.includes("provider = 'kroger'")) {
          return "50";
        }
        if (sql.includes("store_identities where id = 'kroger-02900529'")) {
          return "0";
        }
        if (sql.includes("store_identities where id = 'aldi-mechanicsville'")) {
          return "0";
        }
        if (
          sql.includes("kroger-02900529") &&
          sql.includes("kroger-mechanicsville")
        ) {
          return "1";
        }
        if (
          sql.includes("aldi-mechanicsville") &&
          sql.includes("osm-node-6531578976")
        ) {
          return "1";
        }
        return "0";
      },
    };

    expect(migrationEffectPresent("001", db)).toBe(true);
    expect(migrationEffectPresent("015", db)).toBe(false);
    expect(migrationEffectPresent("013", db)).toBe(false);
    expect(migrationEffectPresent("021", {
      ...db,
      tableExists: (name) =>
        name === "store_identities" || name === "store_identity_aliases",
    })).toBe(true);
    // Vacuous done when fewer than both Kroger members exist
    expect(migrationEffectPresent("022", db)).toBe(true);
    // Vacuous done when fewer than both Aldi+OSM members exist
    expect(migrationEffectPresent("023", db)).toBe(true);
  });
});

describe("computeMigrationChecksum", () => {
  it("is stable for the same content", () => {
    const first = computeMigrationChecksum("select 1;", { isPath: false });
    const second = computeMigrationChecksum("select 1;", { isPath: false });
    expect(first).toBe(second);
    expect(first).toMatch(/^[a-f0-9]{64}$/);
  });
});
