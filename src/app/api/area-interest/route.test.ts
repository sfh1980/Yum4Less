import { afterEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/area-interest/route";
import { readAreaInterestRateLimit } from "@/lib/area-interest/area-interest-rate-limit";
import { resetRateLimitsForTests } from "@/lib/rate-limit";
import { buildTestProcessEnv } from "@/lib/test-only/process-env-test-helpers";

const upsertAreaInterest = vi.fn();

vi.mock("@/lib/area-interest/area-interest-repository", () => ({
  upsertAreaInterest: (...args: unknown[]) => upsertAreaInterest(...args),
}));

const originalLimit = process.env.YUM4LESS_AREA_INTEREST_MAX_PER_MINUTE;

describe("POST /api/area-interest", () => {
  afterEach(() => {
    resetRateLimitsForTests();
    upsertAreaInterest.mockReset();
    if (originalLimit === undefined) {
      delete process.env.YUM4LESS_AREA_INTEREST_MAX_PER_MINUTE;
    } else {
      process.env.YUM4LESS_AREA_INTEREST_MAX_PER_MINUTE = originalLimit;
    }
  });

  it("saves a valid ZIP and returns no stored data", async () => {
    upsertAreaInterest.mockResolvedValue(undefined);

    const response = await POST(jsonRequest({ zip: " 30301 ", note: "email me", latitude: 37.6 }));

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual({ ok: true });
    expect(Object.keys(body)).toEqual(["ok"]);
    expect(upsertAreaInterest).toHaveBeenCalledTimes(1);
    expect(upsertAreaInterest).toHaveBeenCalledWith("30301");
  });

  it("rejects a ZIP that is not 5 digits", async () => {
    const response = await POST(jsonRequest({ zip: "3030a" }));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      ok: false,
      error: "Enter a 5-digit ZIP.",
    });
    expect(upsertAreaInterest).not.toHaveBeenCalled();
  });

  it("defaults the per-minute limit to 6", () => {
    expect(readAreaInterestRateLimit(buildTestProcessEnv()).maxRequests).toBe(6);
    expect(
      readAreaInterestRateLimit(
        buildTestProcessEnv({ YUM4LESS_AREA_INTEREST_MAX_PER_MINUTE: "0" }),
      ).maxRequests,
    ).toBe(6);
  });

  it("applies the per-minute limit", async () => {
    process.env.YUM4LESS_AREA_INTEREST_MAX_PER_MINUTE = "2";
    upsertAreaInterest.mockResolvedValue(undefined);

    const first = await POST(jsonRequest({ zip: "30301" }));
    const second = await POST(jsonRequest({ zip: "20202" }));
    const third = await POST(jsonRequest({ zip: "19104" }));

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(third.status).toBe(429);
    expect(upsertAreaInterest).toHaveBeenCalledTimes(2);
  });
});

function jsonRequest(body: unknown) {
  return new Request("http://localhost/api/area-interest", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}
