// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import { saveAreaInterest } from "@/lib/area-interest/save-area-interest";

vi.mock("@/lib/analytics/track-client-event", () => ({
  trackClientEventOnce: vi.fn(),
}));

describe("saveAreaInterest", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    window.sessionStorage.clear();
  });

  it("posts a ZIP once per session and does not send a second time", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(saveAreaInterest("30301")).resolves.toBe("saved");
    await expect(saveAreaInterest("30301")).resolves.toBe("already");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))).toEqual({ zip: "30301" });
  });

  it("does not remember a failed save", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: false }), { status: 400 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(saveAreaInterest("30301")).resolves.toBe("failed");
    await expect(saveAreaInterest("30301")).resolves.toBe("saved");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
