import { afterEach, describe, expect, it, vi } from "vitest";
import { GET } from "@/app/api/owner/markets/route";
import { POST as previewPost } from "@/app/api/owner/markets/preview/route";
import { POST as activatePost } from "@/app/api/owner/markets/activate/route";
import { resetRateLimitsForTests } from "@/lib/rate-limit";

const originalFeedbackAdminKey = process.env.YUM4LESS_FEEDBACK_ADMIN_KEY;
const originalDatabaseUrl = process.env.DATABASE_URL;

const listIngestMarkets = vi.fn();
const inspectOwnerIngestMarket = vi.fn();
const activateOwnerIngestMarket = vi.fn();

vi.mock("@/lib/active-markets", async () => {
  const actual = await vi.importActual<typeof import("@/lib/active-markets")>(
    "@/lib/active-markets",
  );
  return {
    ...actual,
    listIngestMarkets: (...args: unknown[]) => listIngestMarkets(...args),
  };
});

vi.mock("@/lib/owner/ingest-markets", async () => {
  const actual = await vi.importActual<typeof import("@/lib/owner/ingest-markets")>(
    "@/lib/owner/ingest-markets",
  );
  return {
    ...actual,
    inspectOwnerIngestMarket: (...args: unknown[]) => inspectOwnerIngestMarket(...args),
    activateOwnerIngestMarket: (...args: unknown[]) => activateOwnerIngestMarket(...args),
  };
});

function restoreEnv(name: string, value: string | undefined) {
  if (value === undefined) {
    delete process.env[name];
  } else {
    process.env[name] = value;
  }
}

function authRequest(url: string, init?: RequestInit) {
  return new Request(url, {
    ...init,
    headers: {
      Authorization: "Bearer test-admin-key",
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
}

describe("/api/owner/markets", () => {
  afterEach(() => {
    resetRateLimitsForTests();
    listIngestMarkets.mockReset();
    inspectOwnerIngestMarket.mockReset();
    activateOwnerIngestMarket.mockReset();
    restoreEnv("YUM4LESS_FEEDBACK_ADMIN_KEY", originalFeedbackAdminKey);
    restoreEnv("DATABASE_URL", originalDatabaseUrl);
  });

  it("returns 401 for GET without an admin key", async () => {
    process.env.YUM4LESS_FEEDBACK_ADMIN_KEY = "test-admin-key";
    process.env.DATABASE_URL = "postgres://yum4less/test";

    const response = await GET(new Request("http://localhost/api/owner/markets"));

    expect(response.status).toBe(401);
    expect(listIngestMarkets).not.toHaveBeenCalled();
  });

  it("returns 503 when DATABASE_URL is missing", async () => {
    process.env.YUM4LESS_FEEDBACK_ADMIN_KEY = "test-admin-key";
    delete process.env.DATABASE_URL;

    const response = await GET(
      authRequest("http://localhost/api/owner/markets"),
    );

    expect(response.status).toBe(503);
    expect(listIngestMarkets).not.toHaveBeenCalled();
  });

  it("lists markets when authorized", async () => {
    process.env.YUM4LESS_FEEDBACK_ADMIN_KEY = "test-admin-key";
    process.env.DATABASE_URL = "postgres://yum4less/test";
    listIngestMarkets.mockResolvedValue([
      {
        zipCode: "23220",
        status: "active",
        source: "ops",
      },
    ]);

    const response = await GET(authRequest("http://localhost/api/owner/markets"));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      markets: [{ zipCode: "23220", status: "active" }],
    });
  });

  it("returns 503 when active_markets is missing", async () => {
    process.env.YUM4LESS_FEEDBACK_ADMIN_KEY = "test-admin-key";
    process.env.DATABASE_URL = "postgres://yum4less/test";
    listIngestMarkets.mockRejectedValue(
      new Error('relation "active_markets" does not exist'),
    );

    const response = await GET(authRequest("http://localhost/api/owner/markets"));

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({
      ok: false,
      error: expect.stringMatching(/025/i),
    });
  });

  it("rejects preview without a 5-digit ZIP", async () => {
    process.env.YUM4LESS_FEEDBACK_ADMIN_KEY = "test-admin-key";
    process.env.DATABASE_URL = "postgres://yum4less/test";

    const response = await previewPost(
      authRequest("http://localhost/api/owner/markets/preview", {
        method: "POST",
        body: JSON.stringify({ zipCode: "2311" }),
      }),
    );

    expect(response.status).toBe(400);
    expect(inspectOwnerIngestMarket).not.toHaveBeenCalled();
  });

  it("previews without activating", async () => {
    process.env.YUM4LESS_FEEDBACK_ADMIN_KEY = "test-admin-key";
    process.env.DATABASE_URL = "postgres://yum4less/test";
    inspectOwnerIngestMarket.mockResolvedValue({
      ok: true,
      result: {
        zipCode: "23220",
        alreadyActive: false,
        stores: [{ name: "Kroger", city: "Richmond", state: "VA", kind: "grocery" }],
        warnings: [],
        existing: null,
        location: {
          city: "Richmond",
          state: "VA",
          latitude: 37.54,
          longitude: -77.43,
          source: "geocodio",
        },
      },
    });

    const response = await previewPost(
      authRequest("http://localhost/api/owner/markets/preview", {
        method: "POST",
        body: JSON.stringify({ zipCode: "23220" }),
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      alreadyActive: false,
      stores: [{ name: "Kroger" }],
    });
    expect(activateOwnerIngestMarket).not.toHaveBeenCalled();
  });

  it("returns 400 when preview geocode fails", async () => {
    process.env.YUM4LESS_FEEDBACK_ADMIN_KEY = "test-admin-key";
    process.env.DATABASE_URL = "postgres://yum4less/test";
    inspectOwnerIngestMarket.mockResolvedValue({
      ok: false,
      error: "GEOCODIO_API_KEY is required in production. Seed ZIP coordinates are disabled.",
    });

    const response = await previewPost(
      authRequest("http://localhost/api/owner/markets/preview", {
        method: "POST",
        body: JSON.stringify({ zipCode: "99999" }),
      }),
    );

    expect(response.status).toBe(400);
  });

  it("activates a ZIP after checks pass", async () => {
    process.env.YUM4LESS_FEEDBACK_ADMIN_KEY = "test-admin-key";
    process.env.DATABASE_URL = "postgres://yum4less/test";
    activateOwnerIngestMarket.mockResolvedValue({
      ok: true,
      result: {
        zipCode: "23220",
        alreadyActive: true,
        stores: [],
        warnings: [],
        existing: { zipCode: "23220", status: "active" },
        location: {
          city: "Richmond",
          state: "VA",
          latitude: 37.54,
          longitude: -77.43,
          source: "geocodio",
        },
      },
    });

    const response = await activatePost(
      authRequest("http://localhost/api/owner/markets/activate", {
        method: "POST",
        body: JSON.stringify({ zipCode: "23220" }),
      }),
    );

    expect(response.status).toBe(200);
    expect(activateOwnerIngestMarket).toHaveBeenCalledWith("23220");
  });
});
