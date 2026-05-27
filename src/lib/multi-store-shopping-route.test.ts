import { afterEach, describe, expect, it, vi } from "vitest";
import { buildMultiStoreShoppingRoute } from "@/lib/multi-store-shopping-route";

describe("buildMultiStoreShoppingRoute", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("builds a fallback round trip when road routing is unavailable", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));

    const plan = await buildMultiStoreShoppingRoute({
      home: {
        latitude: 37.6085,
        longitude: -77.3321,
        label: "Home",
      },
      stores: [
        {
          storeName: "Kroger Mechanicsville",
          latitude: 37.6153,
          longitude: -77.3491,
        },
        {
          storeName: "Walmart Supercenter",
          latitude: 37.6201,
          longitude: -77.3124,
        },
      ],
    });

    expect(plan.source).toBe("fallback-distance");
    expect(plan.orderedStops[0]?.kind).toBe("home");
    expect(plan.orderedStops.at(-1)?.kind).toBe("home");
    expect(plan.orderedStops.filter((stop) => stop.kind === "store")).toHaveLength(2);
    expect(plan.totalDistanceMiles).toBeGreaterThan(0);
  });
});
