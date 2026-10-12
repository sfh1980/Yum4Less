import { afterEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/owner/morning-report/external/route";
import { resetRateLimitsForTests } from "@/lib/rate-limit";

const originalFeedbackAdminKey = process.env.YUM4LESS_FEEDBACK_ADMIN_KEY;
const originalDatabaseUrl = process.env.DATABASE_URL;

const saveExternalCheck = vi.fn();

vi.mock("@/lib/owner/morning-report-repository", () => ({
  saveExternalCheck: (...args: unknown[]) => saveExternalCheck(...args),
  isMissingMorningReportSchema: () => false,
}));

function restoreEnv(name: string, value: string | undefined) {
  if (value === undefined) {
    delete process.env[name];
  } else {
    process.env[name] = value;
  }
}

describe("/api/owner/morning-report/external", () => {
  afterEach(() => {
    resetRateLimitsForTests();
    saveExternalCheck.mockReset();
    restoreEnv("YUM4LESS_FEEDBACK_ADMIN_KEY", originalFeedbackAdminKey);
    restoreEnv("DATABASE_URL", originalDatabaseUrl);
  });

  it("rejects a result without the admin key", async () => {
    process.env.YUM4LESS_FEEDBACK_ADMIN_KEY = "secret";
    process.env.DATABASE_URL = "postgresql://localhost/yum4less_dev";
    const response = await POST(
      new Request("http://localhost/api/owner/morning-report/external", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ codeTests: "passed", siteCheck: "passed" }),
      }),
    );
    expect(response.status).toBe(401);
    expect(saveExternalCheck).not.toHaveBeenCalled();
  });

  it("stores a passed outside result", async () => {
    process.env.YUM4LESS_FEEDBACK_ADMIN_KEY = "secret";
    process.env.DATABASE_URL = "postgresql://localhost/yum4less_dev";
    saveExternalCheck.mockResolvedValue(undefined);
    const response = await POST(
      new Request("http://localhost/api/owner/morning-report/external", {
        method: "POST",
        headers: {
          Authorization: "Bearer secret",
          "content-type": "application/json",
        },
        body: JSON.stringify({ codeTests: "passed", siteCheck: "failed" }),
      }),
    );
    expect(response.status).toBe(200);
    expect(saveExternalCheck).toHaveBeenCalledWith(
      expect.objectContaining({
        codeTests: "passed",
        siteCheck: "failed",
      }),
    );
  });
});
