import { describe, expect, it } from "vitest";
import { join } from "node:path";
import {
  applyPendingMigrations,
  assertIdentitySeedEffectAfterApply,
  buildLedgerInsertSql,
  computeMigrationChecksum,
  IDENTITY_SEED_SPECS,
  identitySeedEffectPresent,
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

function createIdentityProbeDb(state) {
  const {
    stores = {},
    identities = {},
    aliases = [],
  } = state;

  return {
    databaseName: "probe-mock",
    tableExists: (name) =>
      name === "stores" ||
      name === "store_identities" ||
      name === "store_identity_aliases" ||
      name === "schema_migrations" ||
      name === "recipes",
    columnExists: () => false,
    queryScalar: (sql) => {
      if (sql.includes("from stores where id in")) {
        const ids = Object.keys(stores);
        const matched = [...sql.matchAll(/'([^']+)'/g)]
          .map((m) => m[1])
          .filter((id) => id !== "from" && stores[id] !== undefined);
        // Prefer the IN-list ids that appear in our store map.
        const count = ids.filter((id) => sql.includes(`'${id}'`)).length;
        return String(count);
      }
      if (
        sql.includes("from store_identities") &&
        sql.includes("canonical_store_id")
      ) {
        const idMatch = sql.match(/id = '([^']+)'/);
        const canonicalMatch = sql.match(/canonical_store_id = '([^']+)'/);
        const id = idMatch?.[1];
        const canonical = canonicalMatch?.[1];
        const row = id ? identities[id] : undefined;
        return row && row.canonical_store_id === canonical ? "1" : "0";
      }
      if (
        sql.includes("from store_identity_aliases") &&
        sql.includes("member_role = 'canonical'")
      ) {
        const identityId = sql.match(/identity_id = '([^']+)'/)?.[1];
        const storeId = sql.match(/store_id = '([^']+)'/)?.[1];
        const hit = aliases.filter(
          (row) =>
            row.identity_id === identityId &&
            row.store_id === storeId &&
            row.member_role === "canonical" &&
            row.link_status === "confirmed" &&
            row.match_method === "seeded",
        );
        return String(hit.length);
      }
      if (
        sql.includes("from store_identity_aliases") &&
        sql.includes("member_role = 'alias'")
      ) {
        const identityId = sql.match(/identity_id = '([^']+)'/)?.[1];
        const storeId = sql.match(/store_id = '([^']+)'/)?.[1];
        const hit = aliases.filter(
          (row) =>
            row.identity_id === identityId &&
            row.store_id === storeId &&
            row.member_role === "alias" &&
            row.link_status === "confirmed" &&
            row.match_method === "seeded",
        );
        return String(hit.length);
      }
      if (sql.includes("from store_identity_aliases") && sql.includes("identity_id =")) {
        const identityId = sql.match(/identity_id = '([^']+)'/)?.[1];
        return String(aliases.filter((row) => row.identity_id === identityId).length);
      }
      if (sql.includes("publix-atlee")) {
        return "1";
      }
      if (sql.includes("provider = 'kroger'")) {
        return "50";
      }
      return "0";
    },
    queryRows: () => [],
    applySqlContent: () => {},
    applySqlFile: () => {},
  };
}

describe("migrationEffectPresent", () => {
  it("detects schema objects from mocked probes", () => {
    const db = createIdentityProbeDb({
      stores: { "kroger-mechanicsville": true },
    });

    expect(migrationEffectPresent("001", db)).toBe(true);
    expect(migrationEffectPresent("015", db)).toBe(false);
    expect(migrationEffectPresent("013", db)).toBe(false);
    expect(
      migrationEffectPresent("021", {
        ...db,
        tableExists: (name) =>
          name === "store_identities" || name === "store_identity_aliases",
      }),
    ).toBe(true);
  });

  it("022/023 matrix: members<2 → true (vacuous no-op)", () => {
    const krogerOneMember = createIdentityProbeDb({
      stores: { "kroger-02900529": true },
    });
    const aldiOneMember = createIdentityProbeDb({
      stores: { "aldi-mechanicsville": true },
    });
    expect(migrationEffectPresent("022", krogerOneMember)).toBe(true);
    expect(migrationEffectPresent("023", aldiOneMember)).toBe(true);
  });

  it("022/023 matrix: identity exists but no cross-alias → false", () => {
    const krogerBroken = createIdentityProbeDb({
      stores: {
        "kroger-02900529": true,
        "kroger-mechanicsville": true,
      },
      identities: {
        "kroger-02900529": { canonical_store_id: "kroger-02900529" },
      },
      aliases: [
        {
          identity_id: "kroger-02900529",
          store_id: "kroger-02900529",
          member_role: "canonical",
          link_status: "confirmed",
          match_method: "self",
        },
      ],
    });
    const aldiBroken = createIdentityProbeDb({
      stores: {
        "aldi-mechanicsville": true,
        "osm-node-6531578976": true,
      },
      identities: {
        "aldi-mechanicsville": { canonical_store_id: "aldi-mechanicsville" },
      },
      aliases: [
        {
          identity_id: "aldi-mechanicsville",
          store_id: "aldi-mechanicsville",
          member_role: "canonical",
          link_status: "confirmed",
          match_method: "self",
        },
      ],
    });

    expect(migrationEffectPresent("022", krogerBroken)).toBe(false);
    expect(migrationEffectPresent("023", aldiBroken)).toBe(false);
    expect(identitySeedEffectPresent(krogerBroken, IDENTITY_SEED_SPECS["022"])).toBe(
      false,
    );
    expect(identitySeedEffectPresent(aldiBroken, IDENTITY_SEED_SPECS["023"])).toBe(
      false,
    );
  });

  it("022/023 matrix: full seeded pair → true", () => {
    const krogerOk = createIdentityProbeDb({
      stores: {
        "kroger-02900529": true,
        "kroger-mechanicsville": true,
      },
      identities: {
        "kroger-02900529": { canonical_store_id: "kroger-02900529" },
      },
      aliases: [
        {
          identity_id: "kroger-02900529",
          store_id: "kroger-02900529",
          member_role: "canonical",
          link_status: "confirmed",
          match_method: "seeded",
        },
        {
          identity_id: "kroger-02900529",
          store_id: "kroger-mechanicsville",
          member_role: "alias",
          link_status: "confirmed",
          match_method: "seeded",
        },
      ],
    });
    const aldiOk = createIdentityProbeDb({
      stores: {
        "aldi-mechanicsville": true,
        "osm-node-6531578976": true,
      },
      identities: {
        "aldi-mechanicsville": { canonical_store_id: "aldi-mechanicsville" },
      },
      aliases: [
        {
          identity_id: "aldi-mechanicsville",
          store_id: "aldi-mechanicsville",
          member_role: "canonical",
          link_status: "confirmed",
          match_method: "seeded",
        },
        {
          identity_id: "aldi-mechanicsville",
          store_id: "osm-node-6531578976",
          member_role: "alias",
          link_status: "confirmed",
          match_method: "seeded",
        },
      ],
    });

    expect(migrationEffectPresent("022", krogerOk)).toBe(true);
    expect(migrationEffectPresent("023", aldiOk)).toBe(true);
  });
});

describe("assertIdentitySeedEffectAfterApply", () => {
  it("allows vacuous no-op when members are missing", () => {
    const db = createIdentityProbeDb({
      stores: { "kroger-02900529": true },
    });
    expect(() => assertIdentitySeedEffectAfterApply("022", db)).not.toThrow();
    expect(() => assertIdentitySeedEffectAfterApply("015", db)).not.toThrow();
  });

  it("throws when both members exist but seeded effect is incomplete", () => {
    const db = createIdentityProbeDb({
      stores: {
        "kroger-02900529": true,
        "kroger-mechanicsville": true,
      },
      identities: {
        "kroger-02900529": { canonical_store_id: "kroger-02900529" },
      },
      aliases: [
        {
          identity_id: "kroger-02900529",
          store_id: "kroger-02900529",
          member_role: "canonical",
          link_status: "confirmed",
          match_method: "self",
        },
      ],
    });
    expect(() => assertIdentitySeedEffectAfterApply("022", db)).toThrow(
      /identity seed effect is incomplete/,
    );
  });

  it("applyPendingMigrations refuses ledger record after failed post-apply assert", () => {
    const recorded = [];
    const db = createIdentityProbeDb({
      stores: {
        "kroger-02900529": true,
        "kroger-mechanicsville": true,
      },
      identities: {
        "kroger-02900529": { canonical_store_id: "kroger-02900529" },
      },
      aliases: [
        {
          identity_id: "kroger-02900529",
          store_id: "kroger-02900529",
          member_role: "canonical",
          link_status: "confirmed",
          match_method: "self",
        },
      ],
    });
    db.tableExists = (name) =>
      name === "stores" ||
      name === "store_identities" ||
      name === "store_identity_aliases" ||
      name === "schema_migrations";
    const filesThrough021 = listInitMigrationFiles().filter(
      (fileName) => parseMigrationVersion(fileName) <= "021",
    );
    db.queryRows = () =>
      filesThrough021.map((fileName) => ({
        version: parseMigrationVersion(fileName),
        filename: fileName,
        checksum: computeMigrationChecksum(
          join(process.cwd(), "db", "init", fileName),
        ),
        applied_at: "2026-01-01",
      }));
    db.applySqlContent = (sql) => {
      recorded.push(sql);
    };
    db.applySqlFile = () => {
      // Seed apply leaves self-only shape unchanged → post-assert must throw.
    };

    expect(() =>
      applyPendingMigrations(db, { stopAfterVersion: "022" }),
    ).toThrow(/identity seed effect is incomplete/);
    expect(recorded.some((sql) => sql.includes("'022'"))).toBe(false);
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
