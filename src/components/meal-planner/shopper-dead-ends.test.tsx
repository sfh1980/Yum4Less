// @vitest-environment jsdom

import { createElement } from "react";
import { act, render, renderHook, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ChooseLocationScreen } from "@/components/meal-planner/choose-location-screen";
import { MealResultsPanel } from "@/components/meal-planner/meal-results-panel";
import { buildTestMarket } from "@/components/meal-planner/test-fixtures";
import { useMealPlanner } from "@/components/meal-planner/use-meal-planner";
import type {
  FormState,
  MarketSearchState,
  RecommendationState,
} from "@/components/meal-planner/types";
import { UNSET_PRICED_AREA_COVERAGE_SENTENCE } from "@/lib/priced-area-coverage";
import { clearHomeSessionSnapshot } from "@/lib/home-session-snapshot";
import {
  clearSettingsPreferences,
  writeSettingsPreferences,
} from "@/lib/settings-preferences";
import {
  clearAllZipSearchCenters,
  writeZipSearchCenter,
} from "@/lib/zip-search-centers";

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...props
  }: {
    href: string;
    children: React.ReactNode;
  }) => createElement("a", { href, ...props }, children),
}));

vi.mock("@/lib/analytics/track-client-event", () => ({
  trackClientEvent: vi.fn(),
  trackClientEventOnce: vi.fn(),
}));

vi.mock("@/components/meal-planner/meal-recommendation-card", () => ({
  MealRecommendationCard: () => null,
}));

const form: FormState = {
  zipCode: "23111",
  radiusMiles: "5",
  budget: "25",
  shoppingStyle: "single-store",
  dietaryFocus: "anything",
  recipeSource: "internal-library",
  theme: "system",
  selectedStoreIds: ["kroger-1"],
};

function marketPayload(radiusMiles = 5) {
  return {
    ok: true,
    market: {
      searchedZipCode: "23111",
      locationLabel: "Fixture",
      searchLatitude: 37.6085,
      searchLongitude: -77.3739,
      radiusMiles,
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
          rolloutNote: "Fixture.",
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
      lookupSource: "seed",
      lookupProviderConfigured: false,
      dataSource: "database",
      saleIngredientChoices: [],
      message: "Fixture.",
    },
  };
}

describe("shopper dead ends", () => {
  beforeEach(() => {
    clearSettingsPreferences();
    clearHomeSessionSnapshot();
    clearAllZipSearchCenters();
    writeZipSearchCenter("23111", { latitude: 37.6085, longitude: -77.3739 });
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("gives an empty dinner list a way back to the spending limit", () => {
    const market = buildTestMarket();
    const marketSearchState: MarketSearchState = { status: "ready", market };
    const recommendationState: RecommendationState = {
      status: "ready",
      recommendations: [],
    };

    render(
      createElement(MealResultsPanel, {
        form,
        market,
        marketBlocked: false,
        marketSearchState,
        recommendationState,
        recommendations: [],
        onChangeSpendingLimit: vi.fn(),
      }),
    );

    const action = screen.getByRole("button", { name: "Change spending limit" });
    expect(action).toBeEnabled();
    expect(action).toHaveFocus();
    expect(
      screen.getByRole("heading", { name: "No recipes match the current filters" }),
    ).toBeInTheDocument();
  });

  it("keeps ZIP available while a location prompt is waiting, then ends the wait", async () => {
    const geolocationMock = vi.fn();
    vi.stubGlobal("navigator", {
      ...globalThis.navigator,
      geolocation: { getCurrentPosition: geolocationMock },
    });

    render(
      createElement(ChooseLocationScreen, {
        coverageSentence: UNSET_PRICED_AREA_COVERAGE_SENTENCE,
        gpsRequesting: true,
        onUseGps: vi.fn(),
        onEnterZip: vi.fn(),
        onFactoryReset: vi.fn(),
      }),
    );
    expect(screen.getByRole("button", { name: "Enter ZIP code" })).toBeEnabled();

    const { result } = renderHook(() =>
      useMealPlanner({ geolocationTimeoutMs: 40 }),
    );
    await act(async () => {
      result.current.handleBrowserLocationSearch();
    });
    expect(result.current.gpsRequesting).toBe(true);

    await waitFor(() => {
      expect(result.current.gpsRequesting).toBe(false);
    });
    expect(result.current.gpsNotice).toMatch(/ZIP code/i);
    expect(result.current.onboardingStep).toBe("zip-input");
  });

  it("does not leave the pantry when Suggest recipes is tapped before stores are ready", async () => {
    const { result } = renderHook(() => useMealPlanner());

    await act(async () => {
      result.current.handleContinueToPantry();
      result.current.handleSuggestRecipesFromPantry();
    });

    expect(result.current.flowStep).toBe("pantry");
    expect(result.current.suggestRecipesNotice).toMatch(/stores/i);
    expect(result.current.suggestRecipesActionLabel).toBe("Finish choosing stores");
  });

  it("blocks the next search after the miles change until stores are searched again", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(marketPayload(5)), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useMealPlanner());
    await act(async () => {
      result.current.setForm((current) => ({ ...current, zipCode: "23111" }));
    });
    await act(async () => {
      result.current.handleFindStores();
    });
    await waitFor(() => {
      expect(result.current.market?.radiusMiles).toBe(5);
    });

    await act(async () => {
      result.current.handleRadiusMilesChange("12");
    });
    await act(async () => {
      result.current.handleContinueToPantry();
      result.current.handleSuggestRecipesFromPantry();
    });

    expect(result.current.flowStep).toBe("pantry");
    expect(result.current.suggestRecipesNotice).toMatch(/miles/i);
    expect(result.current.suggestRecipesActionLabel).toBe("Search stores again");
    const marketCalls = () =>
      fetchMock.mock.calls.filter((call) =>
        String(call[0]).includes("/api/market-search"),
      );
    expect(marketCalls()).toHaveLength(1);

    await act(async () => {
      result.current.handleSuggestRecipesRecovery();
    });
    await waitFor(() => {
      expect(marketCalls()).toHaveLength(2);
    });
    const retryBody = JSON.parse(
      marketCalls()[1]![1]!.body as string,
    ) as { radiusMiles?: number };
    expect(retryBody.radiusMiles).toBe(12);
  });

  it("uses the saved ZIP when a return-visit location prompt times out", async () => {
    writeSettingsPreferences({
      zipCode: "23111",
      radiusMiles: 5,
      shoppingStyle: "single-store",
      selectedStoreIds: ["kroger-1"],
      locationMode: "geolocation",
      setupComplete: true,
    });
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(marketPayload(5)), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal("navigator", {
      ...globalThis.navigator,
      geolocation: { getCurrentPosition: vi.fn() },
    });

    const { result } = renderHook(() =>
      useMealPlanner({ geolocationTimeoutMs: 40 }),
    );

    await waitFor(() => {
      expect(result.current.marketSearchState.status).toBe("ready");
    });
    expect(result.current.marketSearchState.notice).toMatch(/taking too long/i);
    expect(result.current.activeLocationRequest?.mode).toBe("zip");
  });
});
