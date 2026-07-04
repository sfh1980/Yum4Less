import { afterEach, describe, expect, it } from "vitest";
import { restoreTestNodeEnv, stubTestNodeEnv } from "@/lib/test-env";
import { isPublicApiDbWriteEnabled } from "@/lib/public-api-db-write-policy";

const originalValue = process.env.YUM4LESS_ENABLE_API_DB_WRITES;
const originalNodeEnv = process.env.NODE_ENV;

describe("isPublicApiDbWriteEnabled", () => {
  afterEach(() => {
    if (originalValue === undefined) {
      delete process.env.YUM4LESS_ENABLE_API_DB_WRITES;
    } else {
      process.env.YUM4LESS_ENABLE_API_DB_WRITES = originalValue;
    }

    if (originalNodeEnv === undefined) {
      delete process.env.NODE_ENV;
    } else {
      stubTestNodeEnv(originalNodeEnv);
    }
  });

  it("is disabled by default", () => {
    delete process.env.YUM4LESS_ENABLE_API_DB_WRITES;
    expect(isPublicApiDbWriteEnabled()).toBe(false);
  });

  it("is enabled only when explicitly opted in with the exact value 1", () => {
    process.env.YUM4LESS_ENABLE_API_DB_WRITES = "1";
    expect(isPublicApiDbWriteEnabled()).toBe(true);
  });

  it("rejects truthy but non-1 values", () => {
    process.env.YUM4LESS_ENABLE_API_DB_WRITES = "true";
    expect(isPublicApiDbWriteEnabled()).toBe(false);
  });

  it("stays disabled in production even when the flag is set", () => {
    stubTestNodeEnv("production");
    process.env.YUM4LESS_ENABLE_API_DB_WRITES = "1";
    expect(isPublicApiDbWriteEnabled()).toBe(false);
  });
});
