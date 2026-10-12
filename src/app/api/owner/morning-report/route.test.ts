import { afterEach, describe, expect, it, vi } from "vitest";
import { GET } from "@/app/api/owner/morning-report/route";
import { resetRateLimitsForTests } from "@/lib/rate-limit";

const originalFeedbackAdminKey = process.env.YUM4LESS_FEEDBACK_ADMIN_KEY;
const originalDatabaseUrl = process.env.DATABASE_URL;

const readLatestMorningReport = vi.fn();

vi.mock("@/lib/owner/morning-report-repository", () => ({
  readLatestMorningReport: () => readLatestMorningReport(),
  isMissingMorningReportSchema: () => false,
}));

function restoreEnv(name: string, value: string | undefined) {
  if (value === undefined) {
    delete process.env[name];
  } else {
    process.env[name] = value;
  }
}

describe("/api/owner/morning-report", () => {
  afterEach(() => {
    resetRateLimitsForTests();
    readLatestMorningReport.mockReset();
    restoreEnv("YUM4LESS_FEEDBACK_ADMIN_KEY", originalFeedbackAdminKey);
    restoreEnv("DATABASE_URL", originalDatabaseUrl);
  });

  it("returns 401 without an admin key", async () => {
    process.env.YUM4LESS_FEEDBACK_ADMIN_KEY = "secret";
    process.env.DATABASE_URL = "postgresql://localhost/yum4less_dev";
    const response = await GET(new Request("http://localhost/api/owner/morning-report"));
    expect(response.status).toBe(401);
  });

  it("returns the stored note", async () => {
    process.env.YUM4LESS_FEEDBACK_ADMIN_KEY = "secret";
    process.env.DATABASE_URL = "postgresql://localhost/yum4less_dev";
    readLatestMorningReport.mockResolvedValue({
      reportDate: "2026-10-12",
      kind: "morning",
      body: "Monday morning\nNothing needs you.",
      needsAttention: false,
    });
    const response = await GET(
      new Request("http://localhost/api/owner/morning-report", {
        headers: { Authorization: "Bearer secret" },
      }),
    );
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      report: { body: "Monday morning\nNothing needs you." },
    });
  });
});
