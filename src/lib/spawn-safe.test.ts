/// <reference path="./test-only/scripts-migrations.d.ts" />
import { afterEach, describe, expect, it } from "vitest";
import {
  assertSafeSqlIdentifier,
  isExternalPostgresMode,
  resolveExternalConnectionUrl,
} from "@scripts-lib/spawn-safe";

describe("spawn-safe", () => {
  const originalExternal = process.env.YUM4LESS_EXTERNAL_POSTGRES;
  const originalDatabaseUrl = process.env.DATABASE_URL;

  afterEach(() => {
    if (originalExternal === undefined) {
      delete process.env.YUM4LESS_EXTERNAL_POSTGRES;
    } else {
      process.env.YUM4LESS_EXTERNAL_POSTGRES = originalExternal;
    }
    if (originalDatabaseUrl === undefined) {
      delete process.env.DATABASE_URL;
    } else {
      process.env.DATABASE_URL = originalDatabaseUrl;
    }
  });

  it("accepts valid postgres identifiers", () => {
    expect(assertSafeSqlIdentifier("yum4less_test")).toBe("yum4less_test");
    expect(assertSafeSqlIdentifier("provider_search_terms")).toBe(
      "provider_search_terms",
    );
  });

  it("rejects unsafe postgres identifiers", () => {
    expect(() => assertSafeSqlIdentifier("yum4less;drop")).toThrow(/Unsafe/);
    expect(() => assertSafeSqlIdentifier("")).toThrow(/Unsafe/);
  });

  it("detects external Postgres mode from YUM4LESS_EXTERNAL_POSTGRES", () => {
    delete process.env.YUM4LESS_EXTERNAL_POSTGRES;
    expect(isExternalPostgresMode()).toBe(false);
    process.env.YUM4LESS_EXTERNAL_POSTGRES = "1";
    expect(isExternalPostgresMode()).toBe(true);
    process.env.YUM4LESS_EXTERNAL_POSTGRES = "true";
    expect(isExternalPostgresMode()).toBe(true);
  });

  it("rewrites DATABASE_URL pathname for external psql connections", () => {
    process.env.DATABASE_URL =
      "postgresql://postgres:postgres@db:5432/yum4less_dev";
    expect(resolveExternalConnectionUrl("postgres")).toBe(
      "postgresql://postgres:postgres@db:5432/postgres",
    );
    expect(resolveExternalConnectionUrl("yum4less_dev")).toBe(
      "postgresql://postgres:postgres@db:5432/yum4less_dev",
    );
  });
});
