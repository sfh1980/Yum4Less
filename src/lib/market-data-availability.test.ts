import { describe, expect, it } from "vitest";
import { RecommendationDependencyUnavailableError } from "@/contracts/recommendations";
import {
  assertMarketDataAvailable,
  dependencyUnavailableResponse,
  isDependencyUnavailableError,
} from "@/lib/market-data-availability";

describe("market-data-availability", () => {
  it("allows database-backed market snapshots", () => {
    expect(() =>
      assertMarketDataAvailable({ dataSource: "database" }),
    ).not.toThrow();
  });

  it("throws RecommendationDependencyUnavailableError when unavailable", () => {
    expect(() =>
      assertMarketDataAvailable({ dataSource: "unavailable" }),
    ).toThrow(RecommendationDependencyUnavailableError);
  });

  it("builds a 503 JSON response with the outage message", async () => {
    const response = dependencyUnavailableResponse(
      new RecommendationDependencyUnavailableError(),
    );
    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      ok: false,
      error:
        "Store and meal prices are not loading right now. Try again shortly.",
    });
  });

  it("recognizes dependency unavailable errors", () => {
    expect(
      isDependencyUnavailableError(new RecommendationDependencyUnavailableError()),
    ).toBe(true);
    expect(isDependencyUnavailableError(new Error("other"))).toBe(false);
  });
});
