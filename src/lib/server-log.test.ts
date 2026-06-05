import { afterEach, describe, expect, it, vi } from "vitest";
import { logServerError } from "@/lib/server-log";

describe("logServerError", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("writes structured JSON without stack or secrets", () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

    logServerError("test.scope", new Error("connection refused"), {
      route: "market-search",
    });

    expect(consoleError).toHaveBeenCalledOnce();
    const line = String(consoleError.mock.calls[0]?.[0]);
    const parsed = JSON.parse(line) as Record<string, unknown>;

    expect(parsed).toMatchObject({
      level: "error",
      scope: "test.scope",
      message: "connection refused",
      name: "Error",
      route: "market-search",
    });
    expect(parsed.at).toEqual(expect.any(String));
    expect(line).not.toContain("stack");
  });
});
