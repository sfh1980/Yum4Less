import { afterEach, describe, expect, it } from "vitest";
import { deleteProcessEnvKey } from "@/lib/test-only/process-env-test-helpers";
import { restoreTestNodeEnv, stubTestNodeEnv } from "@/lib/test-env";
import {
  assertTestDbWipeAllowed,
  isTestDbWipeAllowed,
} from "@/lib/test-db-wipe-policy";

const originalNodeEnv = process.env.NODE_ENV;

describe("test db wipe policy", () => {
  afterEach(() => {
    if (originalNodeEnv === undefined) {
      deleteProcessEnvKey("NODE_ENV");
    } else {
      stubTestNodeEnv(originalNodeEnv);
    }
  });

  it("allows wipes only when NODE_ENV is test", () => {
    stubTestNodeEnv("test");
    expect(isTestDbWipeAllowed()).toBe(true);
    expect(() => assertTestDbWipeAllowed("deleteAllPriceObservations")).not.toThrow();
  });

  it("blocks wipes in development", () => {
    stubTestNodeEnv("development");
    expect(isTestDbWipeAllowed()).toBe(false);
    expect(() => assertTestDbWipeAllowed("deleteAllPriceObservations")).toThrow(
      /restricted to test environments/i,
    );
  });

  it("blocks wipes in production", () => {
    stubTestNodeEnv("production");
    expect(isTestDbWipeAllowed()).toBe(false);
    expect(() => assertTestDbWipeAllowed("deleteAllPriceObservations")).toThrow(
      /restricted to test environments/i,
    );
  });
});
