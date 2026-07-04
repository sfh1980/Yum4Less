import { afterEach, describe, expect, it, vi } from "vitest";
import { restoreTestNodeEnv, stubTestNodeEnv } from "@/lib/test-env";

const originalNodeEnv = process.env.NODE_ENV;

describe("test env helpers", () => {
  afterEach(() => {
    restoreTestNodeEnv(originalNodeEnv);
  });

  it("stubs NODE_ENV without direct assignment", () => {
    stubTestNodeEnv("production");
    expect(process.env.NODE_ENV).toBe("production");
  });

  it("restores the prior NODE_ENV value", () => {
    stubTestNodeEnv("development");
    restoreTestNodeEnv("test");
    expect(process.env.NODE_ENV).toBe("test");
  });
});
