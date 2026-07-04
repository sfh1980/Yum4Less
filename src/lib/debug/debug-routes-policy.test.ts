import { afterEach, describe, expect, it, vi } from "vitest";
import { restoreTestNodeEnv, stubTestNodeEnv } from "@/lib/test-env";
import { isDebugRoutesEnabled } from "@/lib/debug/debug-routes-policy";

const originalNodeEnv = process.env.NODE_ENV;
const originalDebugRoutesEnabled = process.env.YUM4LESS_DEBUG_ROUTES_ENABLED;

describe("isDebugRoutesEnabled", () => {
  afterEach(() => {
    restoreEnv("NODE_ENV", originalNodeEnv);
    restoreEnv("YUM4LESS_DEBUG_ROUTES_ENABLED", originalDebugRoutesEnabled);
  });

  it("is false in production even when the debug flag is set", () => {
    stubTestNodeEnv("production");
    process.env.YUM4LESS_DEBUG_ROUTES_ENABLED = "1";

    expect(isDebugRoutesEnabled()).toBe(false);
  });

  it("is false in non-production without the explicit debug flag", () => {
    stubTestNodeEnv("development");
    delete process.env.YUM4LESS_DEBUG_ROUTES_ENABLED;

    expect(isDebugRoutesEnabled()).toBe(false);
  });

  it("is true in non-production when the explicit debug flag is set", () => {
    stubTestNodeEnv("development");
    process.env.YUM4LESS_DEBUG_ROUTES_ENABLED = "1";

    expect(isDebugRoutesEnabled()).toBe(true);
  });
});

function restoreEnv(name: string, value: string | undefined) {
  if (value === undefined) {
    delete process.env[name];
    return;
  }

  process.env[name] = value;
}
