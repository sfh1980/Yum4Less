// @vitest-environment jsdom

import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useMealPlanner } from "@/components/meal-planner/use-meal-planner";
import { clearSettingsPreferences, readSettingsPreferences, writeSettingsPreferences } from "@/lib/settings-preferences";
import { clearHomeSessionSnapshot } from "@/lib/home-session-snapshot";
import {
  clearAllZipSearchCenters,
  writeZipSearchCenter,
} from "@/lib/zip-search-centers";

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
      lookupSource: "seed",
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

function marketPayloadWithStores(storeIds: string[]) {
  const nearbyStores = storeIds.map((storeId, index) => ({
    id: storeId,
    name: storeId === "kroger-1" ? "Kroger Test" : "Aldi Test",
    kind: "grocery",
    latitude: 37.6153 + index * 0.01,
    longitude: -77.3491,
    distanceMiles: 2.4 + index,
    chain: storeId.startsWith("kroger") ? "kroger" : "aldi",
    chainLabel: storeId.startsWith("kroger") ? "Kroger" : "Aldi",
    rolloutStatus: "weekly-ad-preview",
    recommendationEnabled: true,
    rolloutNote: "Fixture rollout note.",
  }));

  return {
    ok: true,
    market: {
      ...marketPayload("Multi-store market", "23111").market,
      nearbyStores,
      recommendationReadyStoreCount: nearbyStores.length,
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

function pantryCoveragePayload() {
  return {
    ok: true,
    suggestedChecklist: [],
    fullyCoveredRecipeCount: 0,
    eligibleRecipeCount: 3,
    ingredientCatalog: [{ id: "olive-oil", name: "Olive oil", category: "pantry" as const }],
  };
}

function isPantryCoverageCall(call: unknown[]) {
  return String(call[0]).includes("/api/pantry-coverage");
}

async function setTestZip(
  result: { current: ReturnType<typeof useMealPlanner> },
  zipCode = "23111",
) {
  await act(async () => {
    result.current.setForm((current) => ({ ...current, zipCode }));
  });
}

async function loadMarketAndOpenPantry(
  result: { current: ReturnType<typeof useMealPlanner> },
) {
  await setTestZip(result);
  await act(async () => {
    result.current.handleFindStores();
  });

  await waitFor(() => {
    expect(result.current.market).toBeTruthy();
  });

  await act(async () => {
    result.current.handleCompleteWelcome();
    result.current.handleCompleteDietary();
    result.current.handleContinueToPantry();
  });
}

describe("useMealPlanner request generation (C2, H4)", () => {
  beforeEach(() => {
    clearSettingsPreferences();
    clearHomeSessionSnapshot();
    clearAllZipSearchCenters();
    writeZipSearchCenter("23111", { latitude: 37.6085, longitude: -77.3321 });
  });

  afterEach(() => {
    clearSettingsPreferences();
    clearHomeSessionSnapshot();
    clearAllZipSearchCenters();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("keeps first-run splash until Continue", async () => {
    const { result } = renderHook(() => useMealPlanner());

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
    });

    expect(result.current.splashVisible).toBe(true);

    await act(() => {
      result.current.handleDismissSplash();
    });

    expect(result.current.splashVisible).toBe(false);
    expect(result.current.activeTab).toBe("settings");
  });

  it("starts with an empty ZIP until GPS or a typed ZIP succeeds", async () => {
    const { result } = renderHook(() => useMealPlanner());

    expect(result.current.form.zipCode).toBe("");
  });

  it("opens the ZIP center picker when no cached pin exists", async () => {
    clearAllZipSearchCenters();
    const { result } = renderHook(() => useMealPlanner());
    await setTestZip(result);

    await act(async () => {
      result.current.handleFindStores();
    });

    expect(result.current.isZipCenterPickerOpen).toBe(true);
    expect(result.current.marketSearchState.status).toBe("idle");
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
    });
    writeZipSearchCenter("11111", { latitude: 37.6, longitude: -77.3 });
    await act(async () => {
      result.current.handleFindStores();
    });

    await act(async () => {
      result.current.setForm((current) => ({ ...current, zipCode: "90210" }));
    });
    writeZipSearchCenter("90210", { latitude: 34.09, longitude: -118.41 });
    await act(async () => {
      result.current.handleFindStores();
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
    await setTestZip(result);

    await act(async () => {
      result.current.handleFindStores();
    });

    await waitFor(() => {
      expect(result.current.market?.locationLabel).toBe("Initial market");
    });

    await act(async () => {
      result.current.handleRankMeals();
    });

    expect(result.current.recommendationState.status).toBe("loading");

    await act(async () => {
      result.current.handleZipCodeChange("90210");
    });
    writeZipSearchCenter("90210", { latitude: 34.09, longitude: -118.41 });
    await act(async () => {
      result.current.handleFindStores();
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

  it("clears stale ranked results when selected stores change in Settings", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify(marketPayloadWithStores(["kroger-1", "aldi-1"])), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify(recommendationPayload("Ranked for Kroger")), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useMealPlanner());
    await setTestZip(result);

    await act(async () => {
      result.current.handleFindStores();
    });

    await waitFor(() => {
      expect(result.current.market?.nearbyStores).toHaveLength(2);
    });

    await act(async () => {
      result.current.handleRankMeals();
    });

    await waitFor(() => {
      expect(result.current.recommendationState.status).toBe("ready");
    });

    expect(result.current.recommendations[0]?.title).toBe("Ranked for Kroger");

    await act(async () => {
      result.current.setForm((current) => ({
        ...current,
        shoppingStyle: "multi-store",
        selectedStoreIds: ["aldi-1"],
      }));
    });

    expect(result.current.recommendationState.status).toBe("idle");
    expect(result.current.recommendations).toHaveLength(0);
  });

  it("auto-loads geolocation market search by re-requesting location (no stored coords)", async () => {
    writeSettingsPreferences({
      zipCode: "23111",
      radiusMiles: 5,
      shoppingStyle: "single-store",
      selectedStoreIds: ["kroger-1"],
      locationMode: "geolocation",
      setupComplete: true,
    });

    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(marketPayload("Current location", "23111")), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const geolocationMock = vi.fn((success: PositionCallback) => {
      success({
        coords: {
          latitude: 37.61,
          longitude: -77.37,
          accuracy: 10,
          altitude: null,
          altitudeAccuracy: null,
          heading: null,
          speed: null,
        },
        timestamp: Date.now(),
      } as GeolocationPosition);
    });
    vi.stubGlobal("navigator", {
      ...globalThis.navigator,
      geolocation: { getCurrentPosition: geolocationMock },
    });

    const { result } = renderHook(() => useMealPlanner());

    await waitFor(() => {
      expect(result.current.market?.locationLabel).toBe("Current location");
    });

    expect(geolocationMock).toHaveBeenCalled();
    const requestBody = JSON.parse(fetchMock.mock.calls[0]![1]!.body as string) as {
      latitude?: number;
      longitude?: number;
      zipCode?: string;
    };
    expect(requestBody.latitude).toBeCloseTo(37.61, 2);
    expect(requestBody.longitude).toBeCloseTo(-77.37, 2);
    expect(result.current.activeLocationRequest?.mode).toBe("browser");
    expect(readSettingsPreferences()?.latitude).toBeUndefined();
    expect(readSettingsPreferences()?.longitude).toBeUndefined();
  });

  it("sends first-run GPS deny to ZIP input even when ZIP is empty", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const geolocationMock = vi.fn((_success: PositionCallback, error?: PositionErrorCallback) => {
      error?.({
        code: 1,
        message: "User denied Geolocation",
        PERMISSION_DENIED: 1,
        POSITION_UNAVAILABLE: 2,
        TIMEOUT: 3,
      } as GeolocationPositionError);
    });
    vi.stubGlobal("navigator", {
      ...globalThis.navigator,
      geolocation: { getCurrentPosition: geolocationMock },
    });

    const { result } = renderHook(() => useMealPlanner());

    await act(async () => {
      result.current.setForm((current) => ({ ...current, zipCode: "" }));
      result.current.handleBrowserLocationSearch();
    });

    await waitFor(() => {
      expect(result.current.onboardingStep).toBe("zip-input");
    });

    expect(geolocationMock).toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.current.form.zipCode).toBe("");
    expect(result.current.gpsNotice).toBe(
      "GPS isn't available. Continue with a ZIP code and place a pin on the map.",
    );
    expect(result.current.market).toBeUndefined();
  });

  it("falls back to form ZIP when Use my location is denied (Site B)", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(marketPayload("ZIP fallback market", "23111")), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const geolocationMock = vi.fn((_success: PositionCallback, error?: PositionErrorCallback) => {
      error?.({
        code: 1,
        message: "User denied Geolocation",
        PERMISSION_DENIED: 1,
        POSITION_UNAVAILABLE: 2,
        TIMEOUT: 3,
      } as GeolocationPositionError);
    });
    vi.stubGlobal("navigator", {
      ...globalThis.navigator,
      geolocation: { getCurrentPosition: geolocationMock },
    });

    const { result } = renderHook(() => useMealPlanner());

    await act(async () => {
      result.current.setForm((current) => ({ ...current, zipCode: "23111" }));
      result.current.handleBrowserLocationSearch();
    });

    await waitFor(() => {
      expect(result.current.onboardingStep).toBe("zip-input");
    });

    expect(geolocationMock).toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.current.gpsNotice).toBe(
      "GPS isn't available. Continue with a ZIP code and place a pin on the map.",
    );
    expect(result.current.market).toBeUndefined();
    expect(result.current.activeLocationRequest).toBeUndefined();
  });

  it("surfaces denial notice as error when Use my location is denied and ZIP is invalid (Site B)", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const geolocationMock = vi.fn((_success: PositionCallback, error?: PositionErrorCallback) => {
      error?.({
        code: 1,
        message: "User denied Geolocation",
        PERMISSION_DENIED: 1,
        POSITION_UNAVAILABLE: 2,
        TIMEOUT: 3,
      } as GeolocationPositionError);
    });
    vi.stubGlobal("navigator", {
      ...globalThis.navigator,
      geolocation: { getCurrentPosition: geolocationMock },
    });

    const { result } = renderHook(() => useMealPlanner());

    await act(async () => {
      result.current.setForm((current) => ({ ...current, zipCode: "12" }));
    });

    await act(async () => {
      result.current.handleBrowserLocationSearch();
    });

    await waitFor(() => {
      expect(result.current.onboardingStep).toBe("zip-input");
    });

    expect(geolocationMock).toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.current.gpsNotice).toBe(
      "GPS isn't available. Continue with a ZIP code and place a pin on the map.",
    );
    expect(result.current.market).toBeUndefined();
    expect(result.current.activeLocationRequest).toBeUndefined();
  });

  it("falls back to saved ZIP when return-visit geolocation auto-load is denied (Site A)", async () => {
    writeSettingsPreferences({
      zipCode: "23111",
      radiusMiles: 5,
      shoppingStyle: "single-store",
      selectedStoreIds: ["kroger-1"],
      locationMode: "geolocation",
      setupComplete: true,
    });

    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(marketPayload("Saved ZIP fallback", "23111")), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const geolocationMock = vi.fn((_success: PositionCallback, error?: PositionErrorCallback) => {
      error?.({
        code: 1,
        message: "User denied Geolocation",
        PERMISSION_DENIED: 1,
        POSITION_UNAVAILABLE: 2,
        TIMEOUT: 3,
      } as GeolocationPositionError);
    });
    vi.stubGlobal("navigator", {
      ...globalThis.navigator,
      geolocation: { getCurrentPosition: geolocationMock },
    });

    const { result } = renderHook(() => useMealPlanner());

    await waitFor(() => {
      expect(result.current.marketSearchState.status).toBe("ready");
    });

    expect(geolocationMock).toHaveBeenCalled();
    expect(result.current.marketSearchState.notice).toBe(
      "Location access was denied — using your saved ZIP instead.",
    );
    expect(result.current.activeLocationRequest).toEqual({
      mode: "zip",
      zipCode: "23111",
      latitude: 37.6085,
      longitude: -77.3321,
    });

    const requestBody = JSON.parse(fetchMock.mock.calls[0]![1]!.body as string) as {
      zipCode?: string;
      latitude?: number;
      longitude?: number;
    };
    expect(requestBody.zipCode).toBe("23111");
    expect(requestBody.latitude).toBe(37.6085);
    expect(requestBody.longitude).toBe(-77.3321);
  });

  it("proof-of-catch: Settings save succeeds on browser coordinates without ZIP", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(marketPayload("Geo save market", "23111")), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const geolocationMock = vi.fn((success: PositionCallback) => {
      success({
        coords: {
          latitude: 37.6085,
          longitude: -77.3739,
          accuracy: 10,
          altitude: null,
          altitudeAccuracy: null,
          heading: null,
          speed: null,
        },
        timestamp: Date.now(),
      } as GeolocationPosition);
    });
    vi.stubGlobal("navigator", {
      ...globalThis.navigator,
      geolocation: { getCurrentPosition: geolocationMock },
    });

    const { result } = renderHook(() => useMealPlanner());

    await act(async () => {
      result.current.setForm((current) => ({
        ...current,
        zipCode: "",
        selectedStoreIds: ["kroger-1"],
      }));
    });

    await act(async () => {
      result.current.handleBrowserLocationSearch();
    });

    await waitFor(() => {
      expect(result.current.onboardingStep).toBe("radius");
    });

    await act(async () => {
      result.current.handleRadiusContinue();
    });

    await waitFor(() => {
      expect(result.current.marketSearchState.status).toBe("ready");
    });

    await act(async () => {
      result.current.handleSaveSettings();
    });

    expect(result.current.settingsSaveError).toBeUndefined();
    expect(result.current.settingsComplete).toBe(true);
    expect(result.current.activeTab).toBe("home");

    const prefs = readSettingsPreferences();
    expect(prefs?.setupComplete).toBe(true);
    expect(prefs?.locationMode).toBe("geolocation");
    expect(prefs?.latitude).toBeUndefined();
    expect(prefs?.longitude).toBeUndefined();
    expect(prefs?.zipCode).toBeUndefined();
  });

  it("proof-of-catch: Settings save still requires ZIP when geolocation is unavailable", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(marketPayload("ZIP-only market", "23111")), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useMealPlanner());

    await act(async () => {
      result.current.setForm((current) => ({
        ...current,
        zipCode: "23111",
        selectedStoreIds: ["kroger-1"],
      }));
    });
    await act(async () => {
      result.current.handleFindStores();
    });

    await waitFor(() => {
      expect(result.current.marketSearchState.status).toBe("ready");
    });

    await act(async () => {
      result.current.setForm((current) => ({ ...current, zipCode: "" }));
    });

    await act(async () => {
      result.current.handleSaveSettings();
    });

    expect(result.current.settingsComplete).toBe(false);
    expect(result.current.activeTab).toBe("settings");
  });

  it("clears ranked results when Settings are saved after a successful rank (C5)", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify(marketPayload("Save market", "23111")), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify(recommendationPayload("Pre-save meal")), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useMealPlanner());
    await setTestZip(result);

    await act(async () => {
      result.current.handleFindStores();
    });

    await waitFor(() => {
      expect(result.current.marketSearchState.status).toBe("ready");
    });

    await act(async () => {
      result.current.handleRankMeals();
    });

    await waitFor(() => {
      expect(result.current.recommendationState.status).toBe("ready");
    });

    await act(async () => {
      result.current.handleSaveSettings();
    });

    expect(result.current.recommendationState.status).toBe("idle");
    expect(result.current.recommendations).toHaveLength(0);
    expect(result.current.cookEnabled).toBe(false);
  });

  it("clears ranked results when Welcome continues after a prior rank (C5)", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify(marketPayload("Welcome market", "23111")), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify(recommendationPayload("Pre-welcome meal")), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useMealPlanner());
    await setTestZip(result);

    await act(async () => {
      result.current.handleFindStores();
    });

    await waitFor(() => {
      expect(result.current.marketSearchState.status).toBe("ready");
    });

    await act(async () => {
      result.current.handleRankMeals();
    });

    await waitFor(() => {
      expect(result.current.recommendationState.status).toBe("ready");
    });

    await act(async () => {
      result.current.handleCompleteWelcome();
    });

    expect(result.current.recommendationState.status).toBe("idle");
    expect(result.current.flowStep).toBe("welcome-dietary");

    await act(async () => {
      result.current.handleCompleteDietary();
    });

    expect(result.current.flowStep).toBe("ingredients");
  });
});

describe("useMealPlanner pantry coverage debounce", () => {
  beforeEach(() => {
    clearSettingsPreferences();
    clearHomeSessionSnapshot();
    clearAllZipSearchCenters();
    writeZipSearchCenter("23111", { latitude: 37.6085, longitude: -77.3321 });
  });

  afterEach(() => {
    clearSettingsPreferences();
    clearHomeSessionSnapshot();
    clearAllZipSearchCenters();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("does not schedule a second pantry coverage request when assess resolves", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify(marketPayload("Pantry market", "23111")), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      )
      .mockResolvedValue(
        new Response(JSON.stringify(pantryCoveragePayload()), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useMealPlanner());
    await loadMarketAndOpenPantry(result);

    await waitFor(() => {
      expect(result.current.pantryCoverageState.status).toBe("ready");
    });

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 2_000));
    });

    expect(fetchMock.mock.calls.filter(isPantryCoverageCall)).toHaveLength(1);
  });

  it("debounces pantry ingredient changes into one follow-up request", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify(marketPayload("Pantry market", "23111")), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      )
      .mockResolvedValue(
        new Response(JSON.stringify(pantryCoveragePayload()), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useMealPlanner());
    await loadMarketAndOpenPantry(result);

    await waitFor(() => {
      expect(result.current.pantryCoverageState.status).toBe("ready");
    });

    await act(async () => {
      result.current.handleTogglePantryChecklistItem("olive-oil", true);
    });

    await waitFor(() => {
      expect(result.current.pantryIngredientIds).toContain("olive-oil");
    });

    await waitFor(
      () => {
        expect(fetchMock.mock.calls.filter(isPantryCoverageCall)).toHaveLength(2);
      },
      { timeout: 2_000 },
    );
  });

  it("does not auto-retry pantry coverage in a tight loop after 429", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify(marketPayload("Pantry market", "23111")), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      )
      .mockResolvedValue(
        new Response(
          JSON.stringify({
            ok: false,
            error: "Too many requests. Please wait and try again.",
          }),
          {
            status: 429,
            headers: {
              "Content-Type": "application/json",
              "Retry-After": "60",
            },
          },
        ),
      );
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useMealPlanner());
    await loadMarketAndOpenPantry(result);

    await waitFor(() => {
      expect(result.current.pantryCoverageState.status).toBe("rate-limited");
    });

    const requestTimes: number[] = [];
    for (const call of fetchMock.mock.calls.filter(isPantryCoverageCall)) {
      requestTimes.push(Date.now());
    }
    expect(requestTimes).toHaveLength(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_000);
    });

    expect(fetchMock.mock.calls.filter(isPantryCoverageCall)).toHaveLength(1);
    expect(result.current.pantryCoverageState.error).toMatch(/too many requests/i);
  });
});
