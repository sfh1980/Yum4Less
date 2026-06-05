import { afterEach, describe, expect, it } from "vitest";
import {
  assertTestDbWipeAllowed,
  isTestDbWipeAllowed,
} from "@/lib/test-db-wipe-policy";

const originalNodeEnv = process.env.NODE_ENV;

describe("test db wipe policy", () => {
  afterEach(() => {
    if (originalNodeEnv === undefined) {
      delete process.env.NODE_ENV;
    } else {
      process.env.NODE_ENV = originalNodeEnv;
    }
  });

  it("allows wipes only when NODE_ENV is test", () => {
    process.env.NODE_ENV = "test";
    expect(isTestDbWipeAllowed()).toBe(true);
    expect(() => assertTestDbWipeAllowed("deleteAllPriceObservations")).not.toThrow();
  });

  it("blocks wipes in development", () => {
    process.env.NODE_ENV = "development";
    expect(isTestDbWipeAllowed()).toBe(false);
    expect(() => assertTestDbWipeAllowed("deleteAllPriceObservations")).toThrow(
      /restricted to test environments/i,
    );
  });

  it("blocks wipes in production", () => {
    process.env.NODE_ENV = "production";
    expect(isTestDbWipeAllowed()).toBe(false);
    expect(() => assertTestDbWipeAllowed("deleteAllPriceObservations")).toThrow(
      /restricted to test environments/i,
    );
  });
});
