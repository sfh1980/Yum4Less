// @vitest-environment jsdom

import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useMealPlanner } from "@/components/meal-planner/use-meal-planner";

vi.mock("@/lib/analytics/track-client-event", () => ({
  trackClientEvent: vi.fn(),
}));

function marketPayload(locationLabel: string, zipCode: string) {
  return {
    ok: true,
    market: {
      searchedZipCode: zipCode,
      locationLabel,
      searchLatitude: 37.6085,
      searchLongitude: -77.3321,
      radiusMiles: 5,
      nearbyStores: [
        {
          id: "kroger-1",
          name: "Kroger Test",
          kind: "grocery",
          latitude: 37.6153,
          longitude: -77.3491,
          distanceMiles: 2.4,
          chain: "kroger",
          chainLabel: "Kroger",
          rolloutStatus: "weekly-ad-preview",
          recommendationEnabled: true,
          rolloutNote: "Fixture rollout note.",
        },
      ],
      recommendationReadyStoreCount: 1,
      providerRollout: [],
      providerStoreSearches: [],
      providerPricingPreviews: [],
      providerCoverageRollup: {
        overallCoverageStatus: "limited",
        trustGate: "monitoring",
        rankedPricingSource: "weekly-ad-cache",
        totalTrackedIngredients: 1,
        matchedIngredientCount: 1,
        unmatchedIngredientCount: 0,
        averageMatchConfidence: 0.8,
        usesCachedPreview: false,
        ingredientSummaries: [],
        message: "Fixture.",
      },
      providerPromotionReadiness: [],
      providerPriceObservationSync: [],
      weeklyAdIngestionStatus: [],
      weeklyAdPromotionReadiness: [],
      lookupSource: "seed-zip",
      lookupProviderConfigured: false,
      dataSource: "database",
      saleIngredientChoices: [
        {
          ingredientId: "chicken-thighs",
          ingredientName: "Chicken thighs",
          lowestEstimatedPrice: 6.49,
          storeOfferCount: 1,
          saleLabel: "Weekly special",
          trustLabel: "directional",
          freshnessHoursAgo: 24,
          offers: [],
        },
      ],
      message: locationLabel,
    },
  };
}

function recommendationPayload(title: string) {
  return {
    ok: true,
    experience: {
      market: marketPayload("Rank market", "23111").market,
      recommendations: [
        {
          title,
          summary: "Fixture meal",
          estimatedTotal: 12,
          storeCount: 1,
          matchedIngredients: 1,
          cookTimeMinutes: 30,
          difficulty: "easy",
          primaryStore: "Kroger Test",
          ingredientHighlights: ["chicken"],
          instructions: ["Cook."],
          shoppingPlan: [],
          storePlan: [],
          score: { total: 70, price: 30, convenience: 20, freshness: 10, fit: 10 },
          confidenceLabel: "Single-store estimate",
          tags: [],
          freshnessLabel: "Recent weekly-ad prices",
          explanation: "Fixture.",
          providerPreviewComparisons: [],
        },
      ],
    },
  };
}

describe("useMealPlanner request generation (C2, H4)", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("ignores stale market search responses when a newer search starts", async () => {
    let resolveFirst!: (response: Response) => void;
    const firstFetch = new Promise<Response>((resolve) => {
      resolveFirst = resolve;
    });

    const fetchMock = vi
      .fn()
      .mockReturnValueOnce(firstFetch)
      .mockResolvedValueOnce(
        new Response(JSON.stringify(marketPayload("Second search wins", "90210")), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useMealPlanner());

    await act(async () => {
      result.current.setForm((current) => ({ ...current, zipCode: "11111" }));
      result.current.handleZipSearch();
    });

    await act(async () => {
      result.current.setForm((current) => ({ ...current, zipCode: "90210" }));
      result.current.handleZipSearch();
    });

    await waitFor(() => {
      expect(result.current.market?.locationLabel).toBe("Second search wins");
    });

    await act(async () => {
      resolveFirst(
        new Response(JSON.stringify(marketPayload("Stale first search", "11111")), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );
      await firstFetch;
    });

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(result.current.market?.locationLabel).toBe("Second search wins");
  });

  it("ignores stale rank responses after a newer market search starts", async () => {
    let resolveRank!: (response: Response) => void;
    const rankFetch = new Promise<Response>((resolve) => {
      resolveRank = resolve;
    });

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify(marketPayload("Initial market", "23111")), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      )
      .mockReturnValueOnce(rankFetch)
      .mockResolvedValueOnce(
        new Response(JSON.stringify(marketPayload("Replacement market", "90210")), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useMealPlanner());

    await act(async () => {
      result.current.handleZipSearch();
    });

    await waitFor(() => {
      expect(result.current.market?.locationLabel).toBe("Initial market");
    });

    await act(async () => {
      result.current.handleToggleIngredient("chicken-thighs", true);
      result.current.handleRankMeals();
    });

    expect(result.current.recommendationState.status).toBe("loading");

    await act(async () => {
      result.current.setForm((current) => ({ ...current, zipCode: "90210" }));
      result.current.handleZipSearch();
    });

    await waitFor(() => {
      expect(result.current.market?.locationLabel).toBe("Replacement market");
    });

    await act(async () => {
      resolveRank(
        new Response(JSON.stringify(recommendationPayload("Stale ranked meal")), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );
      await rankFetch;
    });

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(result.current.recommendationState.status).not.toBe("ready");
    expect(result.current.recommendations.some((meal) => meal.title === "Stale ranked meal")).toBe(
      false,
    );
  });
});
