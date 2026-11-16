// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import { trackClientEventOnce } from "@/lib/analytics/track-client-event";

describe("trackClientEventOnce", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.NEXT_PUBLIC_YUM4LESS_ANALYTICS;
    window.sessionStorage.clear();
  });

  it("posts one event per session for the same state", () => {
    process.env.NEXT_PUBLIC_YUM4LESS_ANALYTICS = "1";
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true })));
    vi.stubGlobal("fetch", fetchMock);

    trackClientEventOnce("map_only_shown", "30301", { zip: "30301" });
    trackClientEventOnce("map_only_shown", "30301", { zip: "30301" });
    trackClientEventOnce("map_only_shown", "20202", { zip: "20202" });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    const bodies = fetchMock.mock.calls.map((call) =>
      JSON.parse(String(call[1]?.body)) as { properties: { zip: string } },
    );
    expect(bodies.map((body) => body.properties.zip)).toEqual(["30301", "20202"]);
  });

  it("does not call fetch when analytics is off", () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    trackClientEventOnce("site_opened", "load", { setup_complete: false });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
