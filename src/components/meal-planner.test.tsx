// @vitest-environment jsdom

import { createElement } from "react";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/components/nearby-stores-map", () => ({
  NearbyStoresMap: () => createElement("div", { "data-testid": "nearby-stores-map-stub" }),
}));

vi.mock("@/components/zip-center-pick-map", () => ({
  ZipCenterPickMap: () => createElement("div", { "data-testid": "zip-center-pick-map-stub" }),
}));

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...props
  }: {
    href: string;
    children: React.ReactNode;
    className?: string;
    id?: string;
    "aria-label"?: string;
  }) => createElement("a", { href, ...props }, children),
}));

import { MealPlanner } from "@/components/meal-planner";
import { clearSettingsPreferences, readSettingsPreferences, writeSettingsPreferences } from "@/lib/settings-preferences";
import { clearHomeSessionSnapshot, writeAppReturnSnapshot } from "@/lib/home-session-snapshot";
import {
  clearAllZipSearchCenters,
  writeZipSearchCenter,
} from "@/lib/zip-search-centers";

const fetchMock = vi.fn();

function stubPlannerFetch() {
  vi.stubGlobal("fetch", async (input: RequestInfo, init?: RequestInit) => {
    const url =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.href
          : input.url;
    if (url.includes("/api/geocode/zip")) {
      return new Response(
        JSON.stringify({
          ok: true,
          location: {
            latitude: 37.6085,
            longitude: -77.3321,
            city: "Mechanicsville",
            state: "VA",
          },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }
    return fetchMock(input, init);
  });
}

async function dismissOnboardingSplash(user: ReturnType<typeof userEvent.setup>) {
  const splash = await screen.findByTestId("onboarding-splash");
  await user.click(within(splash).getByRole("button", { name: "Continue" }));
  await waitFor(() => {
    expect(screen.queryByTestId("onboarding-splash")).not.toBeInTheDocument();
  });
}

async function completeSettingsFlow(user: ReturnType<typeof userEvent.setup>) {
  writeZipSearchCenter("23111", { latitude: 37.6085, longitude: -77.3321 });
  await dismissOnboardingSplash(user);
  await screen.findByRole("heading", { name: "Let’s get started" });
  await user.click(screen.getByRole("button", { name: "Enter ZIP code" }));
  await user.click(screen.getByRole("button", { name: "Continue" }));
  await screen.findByRole("heading", { name: "Place your pin" });
  await user.click(await screen.findByRole("button", { name: "Continue" }));
  await screen.findByRole("heading", { name: "How far should we look?" });
  await user.click(screen.getByRole("button", { name: "Continue" }));
  await screen.findByRole("heading", { name: "How do you shop?" });
  await user.click(screen.getByRole("button", { name: "Continue" }));
  await screen.findByRole("heading", { name: "Which stores should we use?" });
  await screen.findByRole("checkbox", { name: /Select / });
  await user.click(screen.getByRole("button", { name: "Continue" }));
  await screen.findByRole("heading", { name: "How much do you want to spend?" });
}

async function completeWelcomeFlow(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: "Continue" }));
  await screen.findByRole("heading", { name: "Dietary focus" });
  await user.click(screen.getByRole("button", { name: "Continue to ingredients" }));
  await screen.findByRole("heading", { name: "Ingredients" });
}

async function completeIngredientGate(user: ReturnType<typeof userEvent.setup>) {
  await user.click(
    screen.getByRole("button", { name: "Use everything on sale" }),
  );
  await screen.findByRole("heading", { name: "Pantry check" });
}

async function goToPantryStep(user: ReturnType<typeof userEvent.setup>) {
  await completeIngredientGate(user);
}

async function suggestRecipesFromPantry(user: ReturnType<typeof userEvent.setup>) {
  const suggestButton = screen.getByRole("button", {
    name: "Suggest recipes for my store(s)",
  });
  expect(suggestButton).not.toBeDisabled();
  await user.click(suggestButton);
}

const pantryCoveragePayload = {
  ok: true,
  suggestedChecklist: [],
  fullyCoveredRecipeCount: 0,
  eligibleRecipeCount: 3,
  ingredientCatalog: [{ id: "olive-oil", name: "Olive oil", category: "pantry" }],
};

describe("MealPlanner", () => {
  beforeEach(() => {
    clearSettingsPreferences();
    clearAllZipSearchCenters();
    clearHomeSessionSnapshot();
  });

  afterEach(() => {
    clearAllZipSearchCenters();
    clearHomeSessionSnapshot();
    fetchMock.mockReset();
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("renders MVP-oriented results and trust guidance from the server response", async () => {
    const user = userEvent.setup({ delay: null });

    fetchMock
      .mockResolvedValueOnce(
        new Response(JSON.stringify(marketSearchPayload), {
          status: 200,
          headers: {
            "Content-Type": "application/json",
          },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify(pantryCoveragePayload), {
          status: 200,
          headers: {
            "Content-Type": "application/json",
          },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify(recommendationPayload), {
          status: 200,
          headers: {
            "Content-Type": "application/json",
          },
        }),
      );
    stubPlannerFetch();

    render(createElement(MealPlanner));

    await completeSettingsFlow(user);
    await completeWelcomeFlow(user);
    await goToPantryStep(user);

    expect(await screen.findByRole("navigation", { name: "Main" })).toBeInTheDocument();
    expect(screen.queryByText("Seed preview pricing")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Project & data details (internal)" }),
    ).not.toBeInTheDocument();

    await suggestRecipesFromPantry(user);

    expect(await screen.findByText("Weeknight Lemon Chicken")).toBeInTheDocument();
    expect(
      screen.queryByRole("note", { name: /heads up about these prices/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "How to read these results" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "How to read these labels" }),
    ).not.toBeInTheDocument();

    expect(
      screen.getByRole("link", {
        name: "Where do these prices come from? Opens FAQ",
      }),
    ).toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: "Weeknight Lemon Chicken" }),
    );

    expect(screen.getByText("Lowest price we found: $13.42")).toBeInTheDocument();
    expect(document.querySelector(".meal-card-price-age")).toBeNull();
    expect(
      screen.queryByText(
        "Dinner totals below use saved sale prices — not live checkout.",
      ),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText(
        "Saved sale prices at Kroger Mechanicsville — not live checkout; confirm in store.",
      ),
    ).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Shopping plan" }));
    expect(screen.getAllByText(/Lowest price we found: \$6\.49|Estimated lowest price: \$6\.49/).length).toBeGreaterThanOrEqual(1);
    expect(
      screen.getByRole("link", {
        name: "Where do these prices come from? Opens FAQ",
      }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("note", { name: /heads up about these prices/i })).not.toBeInTheDocument();
    expect(await screen.findByText("Sale price — estimate only")).toBeInTheDocument();
    expect(screen.queryByText("Postgres catalog + ingested prices")).not.toBeInTheDocument();
    expect(screen.queryByText("Geocodio lookup")).not.toBeInTheDocument();

    expect(
      screen.queryByRole("heading", { name: "Project & data details (internal)" }),
    ).not.toBeInTheDocument();
  }, 15_000);

  it("shows database outage copy instead of adjust-radius guidance when market search returns 503", async () => {
    const user = userEvent.setup({ delay: null });

    writeSettingsPreferences({
      zipCode: "23111",
      radiusMiles: 5,
      shoppingStyle: "single-store",
      selectedStoreIds: ["kroger-1"],
      setupComplete: true,
    });
    writeZipSearchCenter("23111", { latitude: 37.6085, longitude: -77.3321 });

    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          ok: false,
          error:
            "Store and meal prices are not loading right now. Try again shortly.",
        }),
        {
          status: 503,
          headers: { "Content-Type": "application/json" },
        },
      ),
    );
    stubPlannerFetch();

    render(createElement(MealPlanner));

    await screen.findByRole("heading", { name: "How much do you want to spend?" });
    await user.click(screen.getByRole("button", { name: "Deals" }));

    expect(
      screen.getByRole("alert").textContent,
    ).toMatch(/Store and meal prices are not loading right now/i);
    expect(screen.queryByText(/Adjust the location search first/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Try a larger radius/i)).not.toBeInTheDocument();
  }, 15_000);

  it("defaults to ingredient-first merged ranking without opt-in UI and shows data-age copy", async () => {
    const user = userEvent.setup({ delay: null });
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify(marketSearchPayload), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    stubPlannerFetch();

    render(createElement(MealPlanner));

    await completeSettingsFlow(user);
    await completeWelcomeFlow(user);
    await user.click(screen.getByRole("button", { name: "Choose specific sale items" }));
    await screen.findByText("Chicken thighs");

    expect(
      screen.queryByRole("checkbox", {
        name: /Also include TheMealDB recipes that match my sale ingredients/i,
      }),
    ).not.toBeInTheDocument();
    expect(screen.getByText(/Prices from ~24 hours ago/i)).toBeInTheDocument();
    expect(screen.getByText(/Sale price — estimate only/i)).toBeInTheDocument();
    expect(screen.queryByText(/cheapest|best price|live price/i)).not.toBeInTheDocument();
  });

  it("toggles light and dark from the chrome control", async () => {
    const user = userEvent.setup({ delay: null });
    render(createElement(MealPlanner));

    await dismissOnboardingSplash(user);
    await screen.findByRole("heading", { name: "Let’s get started" });
    await user.click(screen.getByRole("button", { name: "Switch to dark theme" }));
    await waitFor(() => {
      expect(document.documentElement.dataset.theme).toBe("dark");
    });
    expect(readSettingsPreferences()?.theme).toBe("dark");

    await user.click(screen.getByRole("button", { name: "Switch to light theme" }));
    await waitFor(() => {
      expect(document.documentElement.dataset.theme).toBe("light");
    });
    expect(readSettingsPreferences()?.theme).toBe("light");
  });

  it("does not overwrite saved dark theme or stores when remounting", async () => {
    writeSettingsPreferences({
      zipCode: "23111",
      radiusMiles: 5,
      shoppingStyle: "single-store",
      selectedStoreIds: ["kroger-1"],
      theme: "dark",
      setupComplete: true,
    });

    const { unmount } = render(createElement(MealPlanner));
    await screen.findByRole("heading", { name: "How much do you want to spend?" });
    await waitFor(() => {
      expect(document.documentElement.dataset.theme).toBe("dark");
    });
    expect(readSettingsPreferences()?.theme).toBe("dark");
    expect(readSettingsPreferences()?.selectedStoreIds).toEqual(["kroger-1"]);

    unmount();
    render(createElement(MealPlanner));
    await screen.findByRole("heading", { name: "How much do you want to spend?" });
    await waitFor(() => {
      expect(document.documentElement.dataset.theme).toBe("dark");
    });
    expect(readSettingsPreferences()?.theme).toBe("dark");
    expect(readSettingsPreferences()?.selectedStoreIds).toEqual(["kroger-1"]);
    expect(readSettingsPreferences()?.setupComplete).toBe(true);
  });

  it("restores the Settings tab after a client return snapshot", async () => {
    writeSettingsPreferences({
      zipCode: "23111",
      radiusMiles: 5,
      shoppingStyle: "single-store",
      selectedStoreIds: ["kroger-1"],
      theme: "dark",
      setupComplete: true,
    });
    writeAppReturnSnapshot({
      splashFinished: true,
      activeTab: "settings",
      flowStep: "welcome-budget",
    });

    render(createElement(MealPlanner));

    await screen.findByRole("heading", { name: "Let’s get started" });
    expect(screen.getByRole("link", { name: "FAQ" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Terms of use" })).toBeInTheDocument();
    expect(screen.queryByTestId("onboarding-splash")).not.toBeInTheDocument();
    await waitFor(() => {
      expect(document.documentElement.dataset.theme).toBe("dark");
    });
    expect(readSettingsPreferences()?.setupComplete).toBe(true);
  });

  it("shows welcome budget controls after settings are saved", async () => {
    const user = userEvent.setup({ delay: null });
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify(marketSearchPayload), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    stubPlannerFetch();

    render(createElement(MealPlanner));

    await completeSettingsFlow(user);

    expect(
      screen.getByRole("spinbutton", { name: "Spending limit" }),
    ).toBeInTheDocument();
    expect(screen.queryByLabelText("Maximum ingredients")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Dinner options wanted")).not.toBeInTheDocument();
  });

  it("shows internal diagnostics only when NEXT_PUBLIC_YUM4LESS_SHOW_INTERNAL_DETAILS=1", async () => {
    vi.stubEnv("NEXT_PUBLIC_YUM4LESS_SHOW_INTERNAL_DETAILS", "1");
    vi.resetModules();

    const user = userEvent.setup({ delay: null });
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify(marketSearchPayload), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    stubPlannerFetch();

    const { MealPlanner: DemoWithInternal } = await import(
      "@/components/meal-planner"
    );
    render(createElement(DemoWithInternal));

    await completeSettingsFlow(user);
    await completeWelcomeFlow(user);
    await user.click(
      screen.getByRole("button", { name: "Do you want to see store locations?" }),
    );
    await screen.findAllByText("Kroger Mechanicsville");

    await user.click(
      screen.getByRole("button", { name: "Project & data details (internal)" }),
    );

    expect(
      await screen.findByRole("heading", {
        name: "Project & data details (internal)",
      }),
    ).toBeInTheDocument();
    expect(screen.getByText("Postgres catalog + ingested prices")).toBeInTheDocument();
    expect(screen.getByText("Geocodio lookup")).toBeInTheDocument();
  });
});

const marketSearchPayload = {
  ok: true,
  market: {
    searchedZipCode: "23111",
    locationLabel: "Mechanicsville, VA",
    searchLatitude: 37.6085,
    searchLongitude: -77.3321,
    radiusMiles: 5,
    nearbyStores: [
      {
        id: "kroger-1",
        name: "Kroger Mechanicsville",
        kind: "grocery",
        latitude: 37.6153,
        longitude: -77.3491,
        distanceMiles: 2.4,
        chain: "kroger",
        chainLabel: "Kroger",
        rolloutStatus: "weekly-ad-preview",
        recommendationEnabled: true,
        rolloutNote:
          "Kroger meal prices use weekly ad deals (5 matched ingredients). Totals are estimated—verify price, package size, and tags in store before checkout.",
      },
    ],
    recommendationReadyStoreCount: 1,
    providerRollout: [
      {
        chain: "kroger",
        label: "Kroger",
        status: "weekly-ad-preview",
        recommendationEnabled: true,
        priority: 1,
        note:
          "Kroger meal prices use weekly ad deals (5 matched ingredients). Totals are estimated—verify price, package size, and tags in store before checkout.",
      },
      {
        chain: "publix",
        label: "Publix",
        status: "coming-soon",
        recommendationEnabled: false,
        priority: 2,
        note:
          "Publix dinner estimates use saved sale prices when available near you. Totals are estimates — verify in store.",
      },
    ],
    providerStoreSearches: [
      {
        provider: "kroger",
        label: "Kroger official store discovery",
        status: "available",
        provenance: "official-api",
        retrievalMode: "live",
        configured: true,
        fallbackUsed: false,
        fetchedAt: "2026-05-20T12:00:00.000Z",
        persistedSnapshotId: 7,
        stores: [
          {
            provider: "kroger",
            providerStoreId: "01100479",
            name: "Kroger Mechanicsville",
            addressLine1: "9351 Atlee Rd",
            city: "Mechanicsville",
            state: "VA",
            zipCode: "23116",
            latitude: 37.6652,
            longitude: -77.3651,
          },
        ],
        message:
          "Kroger Location API found 1 nearby store(s). Map pins prefer these API coordinates over OpenStreetMap when both are present; ranked meal estimates use ingested prices when production sync and promotion gates pass — verify totals in store.",
      },
      {
        provider: "publix",
        label: "Publix official store discovery",
        status: "not-configured",
        provenance: "not-configured",
        retrievalMode: "none",
        configured: false,
        fallbackUsed: false,
        fetchedAt: "2026-05-20T12:00:00.000Z",
        stores: [],
        message:
          "Publix official store discovery is not configured yet. Publix is the approved next chain target, but Yum4Less does not yet have an approved official API path for live store discovery in this MVP. These results stay separate from ranked meal pricing.",
      },
      {
        provider: "walmart",
        label: "Walmart official store discovery",
        status: "not-configured",
        provenance: "not-configured",
        retrievalMode: "none",
        configured: false,
        fallbackUsed: false,
        fetchedAt: "2026-05-20T12:00:00.000Z",
        stores: [],
        message:
          "Walmart official store discovery is not configured yet. Walmart appears on the map for nearby context only; live, current Walmart pricing is not available for ranked dinners in this MVP.",
      },
    ],
    providerPricingPreviews: [
      {
        provider: "kroger",
        label: "Kroger official pricing preview",
        status: "available",
        provenance: "official-api",
        retrievalMode: "live",
        configured: true,
        fallbackUsed: false,
        storeName: "Kroger Mechanicsville",
        providerStoreId: "01100479",
        coverageStatus: "limited",
        matchedIngredientCount: 2,
        totalTrackedIngredients: 5,
        items: [
          {
            provider: "kroger",
            ingredientId: "chicken-thighs",
            ingredientName: "Chicken thighs",
            providerProductId: "0001111000001",
            description: "Fresh Chicken Thighs Family Pack",
            regularPrice: 6.49,
            promoPrice: 5.99,
            currencyCode: "USD",
            inStock: true,
            matchConfidence: 0.88,
            matchReason:
              "description contains the full ingredient name; item is marked in stock",
          },
        ],
        message:
          "Kroger official pricing preview matched 2 of 5 tracked ingredient(s). Coverage is still limited, so this preview remains informational and is not used for ranked meal pricing.",
        fetchedAt: "2026-05-20T12:00:00.000Z",
      },
      {
        provider: "publix",
        label: "Publix official pricing preview",
        status: "fallback",
        provenance: "fallback-local",
        retrievalMode: "none",
        configured: false,
        fallbackUsed: true,
        storeName: "No matched provider store",
        providerStoreId: "unavailable",
        coverageStatus: "none",
        matchedIngredientCount: 0,
        totalTrackedIngredients: 5,
        items: [],
        message:
          "No official provider store was available for pricing preview in this search, so Yum4Less did not run provider-backed product matching.",
        fetchedAt: "2026-05-20T12:00:00.000Z",
      },
      {
        provider: "walmart",
        label: "Walmart official pricing preview",
        status: "fallback",
        provenance: "fallback-local",
        retrievalMode: "none",
        configured: false,
        fallbackUsed: true,
        storeName: "No matched provider store",
        providerStoreId: "unavailable",
        coverageStatus: "none",
        matchedIngredientCount: 0,
        totalTrackedIngredients: 5,
        items: [],
        message:
          "No official provider store was available for pricing preview in this search, so Yum4Less did not run provider-backed product matching.",
        fetchedAt: "2026-05-20T12:00:00.000Z",
      },
    ],
    providerCoverageRollup: {
      overallCoverageStatus: "limited",
      trustGate: "monitoring",
      rankedPricingSource: "weekly-ad-cache",
      totalTrackedIngredients: 5,
      matchedIngredientCount: 1,
      unmatchedIngredientCount: 4,
      averageMatchConfidence: 0.88,
      usesCachedPreview: false,
      ingredientSummaries: [
        {
          ingredientId: "chicken-thighs",
          ingredientName: "Chicken thighs",
          matched: true,
          matchConfidence: 0.88,
          matchReason:
            "description contains the full ingredient name; item is marked in stock",
          provider: "kroger",
          providerProductDescription: "Fresh Chicken Thighs Family Pack",
          retrievalMode: "live",
        },
        {
          ingredientId: "baby-potatoes",
          ingredientName: "Baby potatoes",
          matched: false,
        },
        {
          ingredientId: "broccoli",
          ingredientName: "Broccoli",
          matched: false,
        },
        {
          ingredientId: "lemon",
          ingredientName: "Lemon",
          matched: false,
        },
        {
          ingredientId: "olive-oil",
          ingredientName: "Olive oil",
          matched: false,
        },
      ],
      message:
        "Market-level provider preview coverage: 1 of 5 tracked ingredient(s) matched. Coverage is limited, so provider previews remain informational only. Ranked meal pricing currently reads scraped weekly-ad observations from PostgreSQL.",
    },
    providerPromotionReadiness: [
      {
        provider: "kroger",
        overallStatus: "approaching",
        gatesPassedCount: 4,
        gatesTotalCount: 6,
        gates: [
          {
            id: "provider-configured",
            label: "Provider configured",
            passed: true,
            note: "Kroger official pricing preview credentials are configured.",
          },
          {
            id: "live-preview-data",
            label: "Live preview data",
            passed: true,
            note: "The current preview came from a live provider lookup.",
          },
          {
            id: "official-api-provenance",
            label: "Official API provenance",
            passed: true,
            note: "Preview pricing came from the official Kroger API path.",
          },
          {
            id: "strong-tracked-coverage",
            label: "Strong tracked coverage",
            passed: false,
            note:
              "Promotion requires strong tracked-ingredient coverage before ranked meal pricing can change.",
          },
          {
            id: "average-match-confidence",
            label: "Average match confidence",
            passed: true,
            note: "Average accepted match confidence is at least 70%.",
          },
          {
            id: "mvp-promotion-lock",
            label: "MVP promotion lock",
            passed: false,
            note:
              "Ranked meal pricing uses ingested weekly-ad and official API observations. Provider preview promotion remains informational until explicitly enabled.",
          },
        ],
        recommendationPricingPromotionEnabled: false,
        message:
          "Kroger preview promotion is approaching readiness (4/5 technical gates passed), but ranked meal pricing still uses ingested cache rows rather than provider preview data.",
      },
      {
        provider: "publix",
        overallStatus: "blocked",
        gatesPassedCount: 0,
        gatesTotalCount: 6,
        gates: [
          {
            id: "provider-configured",
            label: "Provider configured",
            passed: false,
            note: "Publix official pricing preview is not configured for this environment.",
          },
          {
            id: "mvp-promotion-lock",
            label: "MVP promotion lock",
            passed: false,
            note:
              "Ranked meal pricing uses ingested weekly-ad and official API observations. Provider preview promotion remains informational until explicitly enabled.",
          },
        ],
        recommendationPricingPromotionEnabled: false,
        message:
          "Publix preview promotion is blocked because preview coverage is unavailable or too weak. Ranked meal pricing uses ingested cache rows only.",
      },
      {
        provider: "walmart",
        overallStatus: "blocked",
        gatesPassedCount: 0,
        gatesTotalCount: 6,
        gates: [
          {
            id: "provider-configured",
            label: "Provider configured",
            passed: false,
            note: "Walmart official pricing preview is not configured for this environment.",
          },
          {
            id: "mvp-promotion-lock",
            label: "MVP promotion lock",
            passed: false,
            note:
              "Ranked meal pricing uses ingested weekly-ad and official API observations. Provider preview promotion remains informational until explicitly enabled.",
          },
        ],
        recommendationPricingPromotionEnabled: false,
        message:
          "Walmart preview promotion is blocked because preview coverage is unavailable or too weak. Ranked meal pricing uses ingested cache rows only.",
      },
    ],
    providerPriceObservationSync: [],
    weeklyAdIngestionStatus: [],
    weeklyAdPromotionReadiness: [],
    lookupSource: "geocodio",
    lookupProviderConfigured: true,
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
        offers: [
          {
            storeId: "kroger-1",
            storeName: "Kroger Mechanicsville",
            price: 6.49,
            saleLabel: "Weekly special",
            freshnessDaysAgo: 1,
            freshnessHoursAgo: 24,
            trustLabel: "directional",
          },
        ],
      },
    ],
    message:
      "Showing 1 nearby store(s) within 5 miles of Mechanicsville, VA using local PostgreSQL data. 1 currently feed ranked recommendations in this MVP. Kroger Location API found 1 nearby store(s). Map pins prefer these API coordinates over OpenStreetMap when both are present; ranked meal estimates use ingested prices when production sync and promotion gates pass — verify totals in store. Kroger official pricing preview matched 2 of 5 tracked ingredient(s). Coverage is still limited, so this preview remains informational and is not used for ranked meal pricing.",
  },
};

const recommendationPayload = {
  ok: true,
  experience: {
    market: marketSearchPayload.market,
    recommendations: [
      {
        title: "Weeknight Lemon Chicken",
        summary: "Simple roasted chicken and vegetables for a low-cost weeknight dinner.",
        estimatedTotal: 13.42,
        storeCount: 1,
        matchedIngredients: 5,
        cookTimeMinutes: 35,
        difficulty: "easy",
        primaryStore: "Kroger Mechanicsville",
        ingredientHighlights: ["chicken thighs", "baby potatoes", "broccoli"],
        instructions: ["Roast the chicken and vegetables until tender."],
        shoppingPlan: [
          {
            ingredientId: "chicken-thighs",
            ingredient: "Chicken thighs",
            quantityNote: "2 lb family pack",
            sourcedFromPantry: false,
            storeName: "Kroger Mechanicsville",
            price: 6.49,
            freshnessDaysAgo: 1,
            freshnessHoursAgo: 24,
            saleLabel: "Weekly special",
            saleConfidence: {
              level: "advertised-recent",
              label: "Sale price — estimate only",
              note: "This sale came from saved store prices (88% ingredient match). Shelf labels can change before you shop, so confirm price and package size in store.",
            },
          },
        ],
        storePlan: [
          {
            storeName: "Kroger Mechanicsville",
            subtotal: 13.42,
            itemCount: 5,
          },
        ],
        score: {
          total: 74,
          price: 32,
          convenience: 22,
          freshness: 12,
          fit: 8,
        },
        confidenceLabel: "Single-store estimate",
        tags: ["family-friendly"],
        freshnessLabel: "Recent sale prices",
        explanation: "The meal fits the budget and keeps the trip simple.",
        providerPreviewComparisons: [
          {
            provider: "kroger",
            providerLabel: "Kroger",
            recipeId: "weeknight-lemon-chicken",
            recipeTitle: "Weeknight Lemon Chicken",
            seedEstimatedTotal: 13.42,
            seedComparedSubtotal: 6.49,
            providerPreviewSubtotal: 5.99,
            comparedIngredientCount: 1,
            totalRecipeIngredients: 5,
            priceDelta: -0.5,
            comparisonStatus: "partial",
            directionalLabel: "Online check looks lower for these ingredients",
            message:
              "Compared 1 of 5 recipe ingredient(s) using saved prices and a recent online store check. For those ingredients, saved total is $6.49 versus online check $5.99 (-$0.50). This note does not change your meal total above.",
            ingredients: [
              {
                ingredientId: "chicken-thighs",
                ingredientName: "Chicken thighs",
                seedPrice: 6.49,
                providerPrice: 5.99,
                priceDelta: -0.5,
                matched: true,
              },
            ],
          },
          {
            provider: "publix",
            providerLabel: "Publix",
            recipeId: "weeknight-lemon-chicken",
            recipeTitle: "Weeknight Lemon Chicken",
            seedEstimatedTotal: 13.42,
            seedComparedSubtotal: 0,
            providerPreviewSubtotal: null,
            comparedIngredientCount: 0,
            totalRecipeIngredients: 5,
            priceDelta: null,
            comparisonStatus: "unavailable",
            directionalLabel: "No side-by-side price check yet",
            message:
              "Not enough overlapping store prices to show a side-by-side check for this recipe yet. Your meal total above still uses saved prices from your selected store(s).",
            ingredients: [],
          },
        ],
      },
    ],
  },
};
