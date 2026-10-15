import { afterEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/owner/morning-report/external/route";
import { resetRateLimitsForTests } from "@/lib/rate-limit";

const originalFeedbackAdminKey = process.env.YUM4LESS_FEEDBACK_ADMIN_KEY;
const originalDatabaseUrl = process.env.DATABASE_URL;

const saveExternalCheck = vi.fn();
const readMorningReport = vi.fn();
const saveMorningReport = vi.fn();

vi.mock("@/lib/owner/morning-report-repository", () => ({
  saveExternalCheck: (...args: unknown[]) => saveExternalCheck(...args),
  readMorningReport: (...args: unknown[]) => readMorningReport(...args),
  saveMorningReport: (...args: unknown[]) => saveMorningReport(...args),
  isMissingMorningReportSchema: () => false,
}));

vi.mock("@/lib/owner/morning-discord", () => ({
  postMorningDiscord: (...args: unknown[]) => postMorningDiscord(...args),
}));

const postMorningDiscord = vi.fn();

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
    readMorningReport.mockReset();
    saveMorningReport.mockReset();
    postMorningDiscord.mockReset();
    delete process.env.YUM4LESS_MORNING_DISCORD_WEBHOOK_URL;
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
    expect(saveMorningReport).not.toHaveBeenCalled();
  });

  it("rewrites today's note and sends it when the result arrives late", async () => {
    process.env.YUM4LESS_FEEDBACK_ADMIN_KEY = "secret";
    process.env.DATABASE_URL = "postgresql://localhost/yum4less_dev";
    process.env.YUM4LESS_MORNING_DISCORD_WEBHOOK_URL =
      "https://discord.com/api/webhooks/123/abc";
    saveExternalCheck.mockResolvedValue(undefined);
    saveMorningReport.mockResolvedValue(undefined);
    postMorningDiscord.mockResolvedValue({ ok: true });
    readMorningReport.mockResolvedValue({
      reportDate: "2026-10-15",
      kind: "morning",
      needsAttention: true,
      body: [
        "Thursday morning",
        "Code tests were not reported.",
        "The outside site check was not reported.",
        "Last night finished.",
        "Prices are from the last day.",
        "No new areas today.",
        "Discord was not sent. The morning webhook is not set.",
        "Needs you.",
      ].join("\n"),
    });
    const response = await POST(
      new Request("http://localhost/api/owner/morning-report/external", {
        method: "POST",
        headers: {
          Authorization: "Bearer secret",
          "content-type": "application/json",
        },
        body: JSON.stringify({ codeTests: "passed", siteCheck: "passed" }),
      }),
    );
    expect(response.status).toBe(200);
    expect(postMorningDiscord).toHaveBeenCalledWith(
      expect.stringContaining("Code tests passed."),
    );
    expect(saveMorningReport).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: "morning",
        needsAttention: false,
        body: expect.stringContaining("Nothing needs you."),
      }),
    );
  });
});
