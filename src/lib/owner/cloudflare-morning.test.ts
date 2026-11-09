import { describe, expect, it } from "vitest";
import {
  cloudflareYesterdayUtc,
  describeCloudflareMorning,
  parseTunnelState,
  parseZoneErrorCount,
  readCloudflareErrorNeedsYou,
  readCloudflareMorningConfig,
} from "@/lib/owner/cloudflare-morning";

const ACCOUNT = "a".repeat(32);
const ZONE = "b".repeat(32);

describe("cloudflare morning", () => {
  it("uses the previous UTC day", () => {
    expect(cloudflareYesterdayUtc(new Date("2026-10-17T12:15:00Z"))).toBe(
      "2026-10-16",
    );
  });

  it("reads the three ingest settings and ignores a partial set", () => {
    expect(
      readCloudflareMorningConfig({
        YUM4LESS_CLOUDFLARE_ACCOUNT_ID: ACCOUNT,
        YUM4LESS_CLOUDFLARE_ZONE_ID: ZONE,
        YUM4LESS_CLOUDFLARE_API_TOKEN: "token",
      }),
    ).toMatchObject({ accountId: ACCOUNT, zoneId: ZONE, tunnelName: "truenas-homelab" });
    expect(
      readCloudflareMorningConfig({
        YUM4LESS_CLOUDFLARE_ACCOUNT_ID: ACCOUNT,
        YUM4LESS_CLOUDFLARE_API_TOKEN: "token",
      }),
    ).toBeNull();
  });

  it("treats a healthy named tunnel as connected", () => {
    expect(
      parseTunnelState(
        {
          success: true,
          result: [
            { name: "other", status: "healthy" },
            { name: "truenas-homelab", status: "healthy" },
          ],
        },
        "truenas-homelab",
      ),
    ).toBe("connected");
    expect(
      parseTunnelState(
        { success: true, result: [{ name: "truenas-homelab", status: "degraded" }] },
        "truenas-homelab",
      ),
    ).toBe("degraded");
    expect(
      parseTunnelState({ success: true, result: [] }, "truenas-homelab"),
    ).toBe("down");
    expect(parseTunnelState({ success: false, result: [] }, "truenas-homelab")).toBe(
      null,
    );
  });

  it("counts only 500-level responses", () => {
    expect(
      parseZoneErrorCount({
        data: {
          viewer: {
            zones: [
              {
                httpRequests1dGroups: [
                  {
                    sum: {
                      responseStatusMap: [
                        { edgeResponseStatus: 200, requests: 40 },
                        { edgeResponseStatus: 404, requests: 3 },
                        { edgeResponseStatus: 500, requests: 2 },
                        { edgeResponseStatus: 503, requests: 1 },
                      ],
                    },
                  },
                ],
              },
            ],
          },
        },
      }),
    ).toBe(3);
    expect(
      parseZoneErrorCount({
        data: { viewer: { zones: [{ httpRequests1dGroups: [] }] } },
      }),
    ).toBe(0);
    expect(parseZoneErrorCount({ errors: [{ message: "no" }] })).toBeNull();
  });

  it("says the site is up, or names the problem", () => {
    expect(
      describeCloudflareMorning({
        checked: true,
        tunnel: "connected",
        errorCount: 0,
      }),
    ).toEqual({
      lines: ["Cloudflare saw the site up. The tunnel is connected."],
      needsAttention: false,
    });
    const one = describeCloudflareMorning({
      checked: true,
      tunnel: "connected",
      errorCount: 1,
    });
    expect(one.lines).toEqual(["Cloudflare saw 1 error."]);
    expect(one.needsAttention).toBe(false);
    expect(one.lines.join(" ")).not.toContain("That is more than usual.");
    const handful = describeCloudflareMorning({
      checked: true,
      tunnel: "connected",
      errorCount: 12,
    });
    expect(handful).toEqual({
      lines: ["Cloudflare saw 12 errors."],
      needsAttention: false,
    });
    expect(
      describeCloudflareMorning({
        checked: true,
        tunnel: "connected",
        errorCount: 25,
      }),
    ).toEqual({
      lines: ["Cloudflare saw 25 errors.", "That is more than usual."],
      needsAttention: true,
    });
    expect(
      describeCloudflareMorning(
        { checked: true, tunnel: "connected", errorCount: 12 },
        10,
      ).needsAttention,
    ).toBe(true);
    expect(
      describeCloudflareMorning({
        checked: true,
        tunnel: "down",
        errorCount: 4,
      }),
    ).toEqual({
      lines: ["The tunnel was not connected.", "Cloudflare saw 4 errors."],
      needsAttention: true,
    });
    expect(
      describeCloudflareMorning({
        checked: true,
        tunnel: "degraded",
        errorCount: 0,
      }).needsAttention,
    ).toBe(true);
    const missed = describeCloudflareMorning({ checked: false });
    expect(missed.lines).toEqual(["Cloudflare was not checked."]);
    expect(missed.needsAttention).toBe(true);
  });

  it("defaults the error threshold to 25 and ignores a value that is not a whole number", () => {
    expect(readCloudflareErrorNeedsYou({})).toBe(25);
    expect(
      readCloudflareErrorNeedsYou({ YUM4LESS_CLOUDFLARE_ERROR_NEEDS_YOU: "40" }),
    ).toBe(40);
    expect(
      readCloudflareErrorNeedsYou({ YUM4LESS_CLOUDFLARE_ERROR_NEEDS_YOU: "0" }),
    ).toBe(0);
    expect(
      readCloudflareErrorNeedsYou({ YUM4LESS_CLOUDFLARE_ERROR_NEEDS_YOU: "1.5" }),
    ).toBe(25);
    expect(
      readCloudflareErrorNeedsYou({ YUM4LESS_CLOUDFLARE_ERROR_NEEDS_YOU: "no" }),
    ).toBe(25);
  });
});
