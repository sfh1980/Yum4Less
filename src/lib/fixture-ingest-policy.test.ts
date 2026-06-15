import { describe, expect, it } from "vitest";
import {
  enforceFixtureIngestDatabasePolicy,
  isFixtureIngestMode,
  validateFixtureIngestDatabasePolicy,
} from "@/lib/fixture-ingest-policy";

function baseEnv(overrides: NodeJS.ProcessEnv = {}): NodeJS.ProcessEnv {
  return {
    DATABASE_URL: "postgresql://postgres:postgres@localhost:5433/yum4less_dev",
    ...overrides,
  };
}

describe("fixture-ingest-policy", () => {
  it("detects weekly-ad and map-catalog fixture flags", () => {
    expect(isFixtureIngestMode(baseEnv())).toBe(false);
    expect(
      isFixtureIngestMode(baseEnv({ YUM4LESS_WEEKLY_AD_FIXTURE: "1" })),
    ).toBe(true);
    expect(
      isFixtureIngestMode(baseEnv({ YUM4LESS_MAP_CATALOG_FIXTURE: "1" })),
    ).toBe(true);
  });

  it("allows fixture ingest under CI without DATABASE_URL_TEST", () => {
    const env = baseEnv({
      YUM4LESS_WEEKLY_AD_FIXTURE: "1",
      CI: "1",
    });

    expect(validateFixtureIngestDatabasePolicy(env)).toEqual({
      ok: true,
      databaseUrl: env.DATABASE_URL!,
    });
  });

  it("allows fixture ingest under Vitest without DATABASE_URL_TEST", () => {
    const env = baseEnv({
      YUM4LESS_MAP_CATALOG_FIXTURE: "1",
      NODE_ENV: "test",
    });

    expect(validateFixtureIngestDatabasePolicy(env).ok).toBe(true);
  });

  it("refuses fixture ingest against dev DB without DATABASE_URL_TEST", () => {
    const validation = validateFixtureIngestDatabasePolicy(
      baseEnv({
        YUM4LESS_WEEKLY_AD_FIXTURE: "1",
        NODE_ENV: "development",
      }),
    );

    expect(validation.ok).toBe(false);
    if (!validation.ok) {
      expect(validation.error).toContain("Fixture ingest refused");
      expect(validation.error).toContain("DATABASE_URL_TEST");
    }
  });

  it("requires DATABASE_URL to match DATABASE_URL_TEST for local fixture ingest", () => {
    const validation = validateFixtureIngestDatabasePolicy(
      baseEnv({
        YUM4LESS_WEEKLY_AD_FIXTURE: "1",
        NODE_ENV: "development",
        DATABASE_URL_TEST:
          "postgresql://postgres:postgres@localhost:5433/yum4less_test",
      }),
    );

    expect(validation.ok).toBe(false);
    if (!validation.ok) {
      expect(validation.error).toContain("must match DATABASE_URL_TEST");
    }
  });

  it("accepts aligned DATABASE_URL and DATABASE_URL_TEST for local fixture ingest", () => {
    const testUrl = "postgresql://postgres:postgres@localhost:5433/yum4less_test";
    const env = baseEnv({
      YUM4LESS_WEEKLY_AD_FIXTURE: "1",
      NODE_ENV: "development",
      DATABASE_URL: testUrl,
      DATABASE_URL_TEST: testUrl,
    });

    expect(validateFixtureIngestDatabasePolicy(env)).toEqual({
      ok: true,
      databaseUrl: testUrl,
    });
    expect(() => enforceFixtureIngestDatabasePolicy(env)).not.toThrow();
  });
});
