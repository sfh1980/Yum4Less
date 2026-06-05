import { afterEach, describe, expect, it } from "vitest";
import { isFeedbackEnabled } from "@/lib/feedback/feedback-policy";

const originalEnabled = process.env.YUM4LESS_FEEDBACK_ENABLED;
const originalDatabaseUrl = process.env.DATABASE_URL;
const originalNodeEnv = process.env.NODE_ENV;

describe("isFeedbackEnabled", () => {
  afterEach(() => {
    restoreEnv("YUM4LESS_FEEDBACK_ENABLED", originalEnabled);
    restoreEnv("DATABASE_URL", originalDatabaseUrl);
    process.env.NODE_ENV = originalNodeEnv;
  });

  it("returns true when explicitly enabled", () => {
    process.env.YUM4LESS_FEEDBACK_ENABLED = "1";
    expect(isFeedbackEnabled()).toBe(true);
  });

  it("returns false when explicitly disabled", () => {
    process.env.YUM4LESS_FEEDBACK_ENABLED = "0";
    process.env.DATABASE_URL = "postgresql://postgres:postgres@localhost:5433/yum4less_dev";
    process.env.NODE_ENV = "development";
    expect(isFeedbackEnabled()).toBe(false);
  });

  it("auto-enables in development when DATABASE_URL is configured", () => {
    delete process.env.YUM4LESS_FEEDBACK_ENABLED;
    process.env.DATABASE_URL = "postgresql://postgres:postgres@localhost:5433/yum4less_dev";
    process.env.NODE_ENV = "development";
    expect(isFeedbackEnabled()).toBe(true);
  });

  it("stays disabled in test without an explicit flag", () => {
    delete process.env.YUM4LESS_FEEDBACK_ENABLED;
    process.env.DATABASE_URL = "postgresql://postgres:postgres@localhost:5433/yum4less_dev";
    process.env.NODE_ENV = "test";
    expect(isFeedbackEnabled()).toBe(false);
  });
});

function restoreEnv(name: string, value: string | undefined) {
  if (value === undefined) {
    delete process.env[name];
    return;
  }

  process.env[name] = value;
}
