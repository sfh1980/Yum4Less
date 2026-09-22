import { afterEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/owner/store-identity/match/route";
import { resetRateLimitsForTests } from "@/lib/rate-limit";

const originalFeedbackAdminKey = process.env.YUM4LESS_FEEDBACK_ADMIN_KEY;
const originalDatabaseUrl = process.env.DATABASE_URL;

const runStoreIdentityProximityMatcherNearLocation = vi.fn();
const resolveZipLocation = vi.fn();

vi.mock("@/lib/store-identity-proximity-ingest", () => ({
  runStoreIdentityProximityMatcherNearLocation: (...args: unknown[]) =>
    runStoreIdentityProximityMatcherNearLocation(...args),
}));

vi.mock("@/lib/geocoding", () => ({
  resolveZipLocation: (...args: unknown[]) => resolveZipLocation(...args),
}));

function restoreEnv(name: string, value: string | undefined) {
  if (value === undefined) {
    delete process.env[name];
  } else {
    process.env[name] = value;
  }
}

describe("/api/owner/store-identity/match", () => {
  afterEach(() => {
    resetRateLimitsForTests();
    runStoreIdentityProximityMatcherNearLocation.mockReset();
    resolveZipLocation.mockReset();
    restoreEnv("YUM4LESS_FEEDBACK_ADMIN_KEY", originalFeedbackAdminKey);
    restoreEnv("DATABASE_URL", originalDatabaseUrl);
  });

  it("returns 401 without an admin key", async () => {
    process.env.YUM4LESS_FEEDBACK_ADMIN_KEY = "test-admin-key";
    process.env.DATABASE_URL = "postgres://yum4less/test";

    const response = await POST(
      new Request("http://localhost/api/owner/store-identity/match", {
        method: "POST",
        body: JSON.stringify({ zipCode: "23220", apply: true }),
      }),
    );

    expect(response.status).toBe(401);
    expect(runStoreIdentityProximityMatcherNearLocation).not.toHaveBeenCalled();
  });

  it("runs the matcher when authorized", async () => {
    process.env.YUM4LESS_FEEDBACK_ADMIN_KEY = "test-admin-key";
    process.env.DATABASE_URL = "postgres://yum4less/test";
    resolveZipLocation.mockResolvedValue({
      ok: true,
      location: { latitude: 37.55, longitude: -77.45 },
    });
    runStoreIdentityProximityMatcherNearLocation.mockResolvedValue({
      considered: 2,
      writeCandidates: 1,
      reviewCandidates: 0,
      aliasesEnsured: 1,
      aliasesSkipped: 0,
      aliasConflicts: 0,
      applied: true,
      write: [],
      review: [],
    });

    const response = await POST(
      new Request("http://localhost/api/owner/store-identity/match", {
        method: "POST",
        headers: { Authorization: "Bearer test-admin-key" },
        body: JSON.stringify({ zipCode: "23220", apply: true }),
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      zipCode: "23220",
      aliasesEnsured: 1,
    });
    expect(runStoreIdentityProximityMatcherNearLocation).toHaveBeenCalledWith({
      latitude: 37.55,
      longitude: -77.45,
      apply: true,
    });
  });
});
