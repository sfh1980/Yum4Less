import { afterEach, describe, expect, it, vi } from "vitest";
import { GET } from "@/app/api/owner/after-update/route";
import { resetRateLimitsForTests } from "@/lib/rate-limit";

const originalFeedbackAdminKey = process.env.YUM4LESS_FEEDBACK_ADMIN_KEY;
const originalDatabaseUrl = process.env.DATABASE_URL;

const runAfterUpdateChecks = vi.fn();

vi.mock("@/lib/owner/after-update-repository", () => ({
  runAfterUpdateChecks: (...args: unknown[]) => runAfterUpdateChecks(...args),
}));

function restoreEnv(name: string, value: string | undefined) {
  if (value === undefined) {
    delete process.env[name];
  } else {
    process.env[name] = value;
  }
}

describe("/api/owner/after-update", () => {
  afterEach(() => {
    resetRateLimitsForTests();
    runAfterUpdateChecks.mockReset();
    restoreEnv("YUM4LESS_FEEDBACK_ADMIN_KEY", originalFeedbackAdminKey);
    restoreEnv("DATABASE_URL", originalDatabaseUrl);
  });

  it("returns 401 without an admin key", async () => {
    process.env.YUM4LESS_FEEDBACK_ADMIN_KEY = "test-admin-key";
    process.env.DATABASE_URL = "postgres://yum4less/test";

    const response = await GET(new Request("http://localhost/api/owner/after-update"));

    expect(response.status).toBe(401);
    expect(runAfterUpdateChecks).not.toHaveBeenCalled();
  });

  it("returns the six check rows and does not activate or ingest", async () => {
    process.env.YUM4LESS_FEEDBACK_ADMIN_KEY = "test-admin-key";
    process.env.DATABASE_URL = "postgres://yum4less/test";
    runAfterUpdateChecks.mockResolvedValue([
      { id: "migrations", title: "Database updates", ok: true, detail: "Applied." },
      { id: "markets", title: "ZIP list", ok: false, detail: "No ZIPs." },
    ]);

    const response = await GET(
      new Request("http://localhost/api/owner/after-update", {
        headers: { Authorization: "Bearer test-admin-key" },
      }),
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.ok).toBe(true);
    expect(body.checks).toHaveLength(2);
    expect(body.checks[1].ok).toBe(false);
    expect(runAfterUpdateChecks).toHaveBeenCalledWith(undefined);
  });

  it("rejects an unknown check id", async () => {
    process.env.YUM4LESS_FEEDBACK_ADMIN_KEY = "test-admin-key";
    process.env.DATABASE_URL = "postgres://yum4less/test";

    const response = await GET(
      new Request("http://localhost/api/owner/after-update?check=activate", {
        headers: { Authorization: "Bearer test-admin-key" },
      }),
    );

    expect(response.status).toBe(400);
    expect(runAfterUpdateChecks).not.toHaveBeenCalled();
  });
});
