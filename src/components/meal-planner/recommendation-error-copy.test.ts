import { describe, expect, it } from "vitest";
import {
  mapMarketSearchApiError,
  mapRecommendationApiError,
} from "@/components/meal-planner/recommendation-error-copy";

describe("recommendation error copy", () => {
  it("maps recommendation 400 invalid preference payload to actionable guidance", () => {
    const mapped = mapRecommendationApiError({
      httpStatus: 400,
      error: "Recommendation request payload is invalid.",
    });

    expect(mapped.title).toContain("meal preferences");
    expect(mapped.body).toMatch(/\$5.*\$40/);
    expect(mapped.hint).toMatch(/sale ingredients/i);
  });

  it("maps recommendation 400 body too large to an honest capacity message", () => {
    const mapped = mapRecommendationApiError({
      httpStatus: 400,
      error: "Request body is too large.",
    });

    expect(mapped.title).toMatch(/too much store data/i);
    expect(mapped.body).toMatch(/smaller radius/i);
    expect(mapped.title).not.toContain("meal preferences");
  });

  it("maps recommendation 400 invalid market snapshot to store-search guidance", () => {
    const mapped = mapRecommendationApiError({
      httpStatus: 400,
      error: "Market snapshot payload is invalid.",
    });

    expect(mapped.title).toMatch(/out of date/i);
    expect(mapped.hint).toMatch(/Step 1/i);
    expect(mapped.title).not.toContain("meal preferences");
  });

  it("maps recommendation 404 unsupported ZIP to service-area guidance", () => {
    const mapped = mapRecommendationApiError({
      httpStatus: 404,
      error: "Unsupported ZIP.",
      providerConfigured: true,
    });

    expect(mapped.title).toMatch(/outside the beta service area/i);
    expect(mapped.body).toContain("Unsupported ZIP");
  });

  it("maps recommendation 404 with unconfigured geocoding to dev hint", () => {
    const mapped = mapRecommendationApiError({
      httpStatus: 404,
      error: "ZIP is not in the local seed table.",
      providerConfigured: false,
    });

    expect(mapped.title).toMatch(/limited/i);
    expect(mapped.hint).toMatch(/GEOCODIO|geolocation|continental US ZIP/i);
  });

  it("maps recommendation 500 to temporary outage copy", () => {
    const mapped = mapRecommendationApiError({
      httpStatus: 500,
      error: "Recommendations are temporarily unavailable.",
    });

    expect(mapped.title).toMatch(/temporarily unavailable/i);
  });

  it("maps market-search 404 location failures near results guidance", () => {
    const mapped = mapMarketSearchApiError({
      httpStatus: 404,
      error: "Location is outside the continental United States.",
      providerConfigured: true,
    });

    expect(mapped.title).toMatch(/outside the beta service area/i);
    expect(mapped.hint).toMatch(/continental/i);
  });
});
