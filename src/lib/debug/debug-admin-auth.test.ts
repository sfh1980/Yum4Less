import { afterEach, describe, expect, it } from "vitest";
import { isDebugPipelineAuthorized } from "@/lib/debug/debug-admin-auth";

const originalAdminKey = process.env.YUM4LESS_DEBUG_ADMIN_KEY;

describe("isDebugPipelineAuthorized", () => {
  afterEach(() => {
    if (originalAdminKey === undefined) {
      delete process.env.YUM4LESS_DEBUG_ADMIN_KEY;
    } else {
      process.env.YUM4LESS_DEBUG_ADMIN_KEY = originalAdminKey;
    }
  });

  it("rejects requests when the admin key is not configured", () => {
    delete process.env.YUM4LESS_DEBUG_ADMIN_KEY;

    expect(
      isDebugPipelineAuthorized(
        new Request("http://localhost/api/debug/pipeline", {
          headers: { Authorization: "Bearer secret" },
        }),
      ),
    ).toBe(false);
  });

  it("accepts Authorization: Bearer when the key matches", () => {
    process.env.YUM4LESS_DEBUG_ADMIN_KEY = "secret";

    expect(
      isDebugPipelineAuthorized(
        new Request("http://localhost/api/debug/pipeline", {
          headers: { Authorization: "Bearer secret" },
        }),
      ),
    ).toBe(true);
  });

  it("accepts X-Yum4Less-Admin-Key when the key matches", () => {
    process.env.YUM4LESS_DEBUG_ADMIN_KEY = "secret";

    expect(
      isDebugPipelineAuthorized(
        new Request("http://localhost/api/debug/pipeline", {
          headers: { "X-Yum4Less-Admin-Key": "secret" },
        }),
      ),
    ).toBe(true);
  });

  it("rejects mismatched keys", () => {
    process.env.YUM4LESS_DEBUG_ADMIN_KEY = "secret";

    expect(
      isDebugPipelineAuthorized(
        new Request("http://localhost/api/debug/pipeline", {
          headers: { Authorization: "Bearer wrong" },
        }),
      ),
    ).toBe(false);
  });
});
