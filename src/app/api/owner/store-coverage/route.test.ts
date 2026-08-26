import { afterEach, describe, expect, it, vi } from "vitest";
import { GET } from "@/app/api/owner/store-coverage/route";
import { resetRateLimitsForTests } from "@/lib/rate-limit";

const originalFeedbackAdminKey = process.env.YUM4LESS_FEEDBACK_ADMIN_KEY;
const originalDatabaseUrl = process.env.DATABASE_URL;

const listStoreCoverage = vi.fn();

vi.mock("@/lib/owner/store-coverage-repository", () => ({
  STORE_COVERAGE_LIMITS: { default: 50, max: 100 },
  listStoreCoverage: (...args: unknown[]) => listStoreCoverage(...args),
}));

function restoreEnv(name: string, value: string | undefined) {
  if (value === undefined) {
    delete process.env[name];
  } else {
    process.env[name] = value;
  }
}

describe("/api/owner/store-coverage", () => {
  afterEach(() => {
    resetRateLimitsForTests();
    listStoreCoverage.mockReset();
    restoreEnv("YUM4LESS_FEEDBACK_ADMIN_KEY", originalFeedbackAdminKey);
    restoreEnv("DATABASE_URL", originalDatabaseUrl);
  });

  it("returns 401 for GET without an admin key", async () => {
    process.env.YUM4LESS_FEEDBACK_ADMIN_KEY = "test-admin-key";
    process.env.DATABASE_URL = "postgres://yum4less/test";

    const response = await GET(new Request("http://localhost/api/owner/store-coverage"));

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      ok: false,
      error: "Unauthorized.",
    });
    expect(listStoreCoverage).not.toHaveBeenCalled();
  });

  it("returns coverage rows when authorized", async () => {
    process.env.YUM4LESS_FEEDBACK_ADMIN_KEY = "test-admin-key";
    process.env.DATABASE_URL = "postgres://yum4less/test";
    listStoreCoverage.mockResolvedValue({
      stores: [
        {
          storeId: "kroger-mechanicsville",
          name: "Kroger",
          chainLabel: "Kroger",
          usableInApp: true,
        },
      ],
      summaries: [{ chainId: "kroger", usableCount: 1 }],
      freshnessHours: 24,
      hasMore: false,
      total: 1,
    });

    const response = await GET(
      new Request(
        "http://localhost/api/owner/store-coverage?name=kroger&location=VA&usable=yes",
        { headers: { Authorization: "Bearer test-admin-key" } },
      ),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      total: 1,
      freshnessHours: 24,
    });
    expect(listStoreCoverage).toHaveBeenCalledWith({
      nameQuery: "kroger",
      locationQuery: "VA",
      usable: "yes",
      limit: 50,
      offset: 0,
    });
  });

  it("accepts q as a store-name alias", async () => {
    process.env.YUM4LESS_FEEDBACK_ADMIN_KEY = "test-admin-key";
    process.env.DATABASE_URL = "postgres://yum4less/test";
    listStoreCoverage.mockResolvedValue({
      stores: [],
      summaries: [],
      freshnessHours: 24,
      hasMore: false,
      total: 0,
    });

    const response = await GET(
      new Request("http://localhost/api/owner/store-coverage?q=aldi", {
        headers: { Authorization: "Bearer test-admin-key" },
      }),
    );

    expect(response.status).toBe(200);
    expect(listStoreCoverage).toHaveBeenCalledWith({
      nameQuery: "aldi",
      locationQuery: undefined,
      usable: "all",
      limit: 50,
      offset: 0,
    });
  });

  it("returns 503 when DATABASE_URL is missing", async () => {
    process.env.YUM4LESS_FEEDBACK_ADMIN_KEY = "test-admin-key";
    delete process.env.DATABASE_URL;

    const response = await GET(
      new Request("http://localhost/api/owner/store-coverage", {
        headers: { Authorization: "Bearer test-admin-key" },
      }),
    );

    expect(response.status).toBe(503);
    expect(listStoreCoverage).not.toHaveBeenCalled();
  });

  it("returns 503 when chain_registry is missing", async () => {
    process.env.YUM4LESS_FEEDBACK_ADMIN_KEY = "test-admin-key";
    process.env.DATABASE_URL = "postgres://yum4less/test";
    listStoreCoverage.mockRejectedValue(
      new Error('relation "chain_registry" does not exist'),
    );

    const response = await GET(
      new Request("http://localhost/api/owner/store-coverage", {
        headers: { Authorization: "Bearer test-admin-key" },
      }),
    );

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({
      ok: false,
      error: expect.stringMatching(/026/i),
    });
  });
});
