import { afterEach, describe, expect, it, vi } from "vitest";
import { GET } from "@/app/api/owner/markets/reach/route";
import { resetRateLimitsForTests } from "@/lib/rate-limit";

const buildOwnerMarketReach = vi.fn();

vi.mock("@/lib/owner/market-reach-repository", () => ({
  buildOwnerMarketReach: (...args: unknown[]) => buildOwnerMarketReach(...args),
}));

describe("/api/owner/markets/reach", () => {
  afterEach(() => {
    resetRateLimitsForTests();
    buildOwnerMarketReach.mockReset();
    delete process.env.YUM4LESS_FEEDBACK_ADMIN_KEY;
    delete process.env.DATABASE_URL;
  });

  it("returns 401 without an admin key", async () => {
    process.env.YUM4LESS_FEEDBACK_ADMIN_KEY = "test-admin-key";
    process.env.DATABASE_URL = "postgres://yum4less/test";
    const response = await GET(new Request("http://localhost/api/owner/markets/reach?zip=23220"));
    expect(response.status).toBe(401);
    expect(buildOwnerMarketReach).not.toHaveBeenCalled();
  });

  it("returns the nearby-store sentence for an authorized ZIP", async () => {
    process.env.YUM4LESS_FEEDBACK_ADMIN_KEY = "test-admin-key";
    process.env.DATABASE_URL = "postgres://yum4less/test";
    buildOwnerMarketReach.mockResolvedValue({
      ok: true,
      reach: {
        zipCode: "23220",
        sentence: "1 of 3 nearby stores can be priced. 2 sit in ZIPs that are still off.",
        circle: { latitude: 37.55, longitude: -77.45, radiusMiles: 8 },
        shades: [],
        labelZipCodes: ["23225"],
        offZips: [
          {
            zipCode: "23225",
            storeCount: 2,
            stores: [{ name: "Forest Hill", chainLabel: "Aldi", reason: "Turn this ZIP on." }],
          },
        ],
      },
    });

    const response = await GET(
      new Request("http://localhost/api/owner/markets/reach?zip=23220", {
        headers: { Authorization: "Bearer test-admin-key" },
      }),
    );
    expect(response.status).toBe(200);
    const json = (await response.json()) as { sentence: string };
    expect(json.sentence).toMatch(/2 sit in ZIPs that are still off/);
  });
});
