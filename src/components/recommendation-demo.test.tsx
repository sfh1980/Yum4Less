// @vitest-environment jsdom

import { createElement } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/components/nearby-stores-map", () => ({
  NearbyStoresMap: () => createElement("div", { "data-testid": "nearby-stores-map-stub" }),
}));

import { RecommendationDemo } from "@/components/recommendation-demo";

const fetchMock = vi.fn();

describe("RecommendationDemo", () => {
  afterEach(() => {
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
        new Response(JSON.stringify(recommendationPayload), {
          status: 200,
          headers: {
            "Content-Type": "application/json",
          },
        }),
      );
    vi.stubGlobal("fetch", fetchMock);

    render(createElement(RecommendationDemo));

    expect(
      screen.getByRole("heading", { name: "Step 1: Find nearby stores" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        name: "Nearby stores",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        name: "Dinner recommendations",
      }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Find nearby stores" }));

    expect(await screen.findByText("Kroger Mechanicsville")).toBeInTheDocument();
    expect(await screen.findByRole("heading", { name: "Location set" })).toBeInTheDocument();
    expect(await screen.findByRole("heading", { name: "Step 2: Set meal preferences" })).toBeInTheDocument();
    expect(await screen.findByText("Nearby stores map")).toBeInTheDocument();
    expect(screen.queryByText("Seed preview pricing")).not.toBeInTheDocument();
    expect(await screen.findAllByRole("note", { name: /heads up about these prices/i })).toHaveLength(2);
    expect(screen.getAllByText(/saved weekly ads and recent store prices/i)).toHaveLength(2);
    expect(screen.getAllByText(/saved backup data instead of a fresh store search/i)).toHaveLength(2);
    expect(
      screen.queryByRole("button", { name: "Project & data details (internal)" }),
    ).not.toBeInTheDocument();
    expect(screen.getByText(/saved weekly ads for supported/i)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Rank dinner options" }));

    expect(
      await screen.findByRole("heading", { name: "How to read these results" }),
    ).toBeInTheDocument();
    expect(await screen.findByText("Weeknight Lemon Chicken")).toBeInTheDocument();
    expect(screen.getByText("Est. $13.42")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Ranked meal totals below use saved weekly-ad prices — not live checkout.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Saved weekly-ad prices at Kroger Mechanicsville — not live checkout; confirm in store.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByText(/Est\. \$6\.49/)).toBeInTheDocument();
    expect(screen.getAllByRole("note", { name: /heads up about these prices/i })).toHaveLength(2);
    expect(screen.getAllByText(/Treat totals as estimates/i)).toHaveLength(2);
    expect(await screen.findByText("Kroger weekly ad special — verify in store")).toBeInTheDocument();
    expect(screen.queryByText("Postgres catalog + ingested prices")).not.toBeInTheDocument();
    expect(screen.queryByText("Geocodio lookup")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Dismiss" }));

    await waitFor(() => {
      expect(
        screen.queryByRole("heading", { name: "How to read these results" }),
      ).not.toBeInTheDocument();
    });

    expect(
      screen.queryByRole("heading", { name: "Project & data details (internal)" }),
    ).not.toBeInTheDocument();
    expect(screen.getByText("Est. $13.42")).toBeInTheDocument();
  }, 15_000);

  it("shows database outage copy instead of adjust-radius guidance when dataSource is unavailable", async () => {
    const user = userEvent.setup({ delay: null });
    const unavailableMarketPayload = {
      ok: true,
      market: {
        ...marketSearchPayload.market,
        nearbyStores: [],
        recommendationReadyStoreCount: 0,
        dataSource: "unavailable",
      },
    };

    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify(unavailableMarketPayload), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    render(createElement(RecommendationDemo));

    await user.click(screen.getByRole("button", { name: "Find nearby stores" }));

    expect(
      await screen.findByRole("heading", {
        name: "Store and meal prices aren't loading",
      }),
    ).toBeInTheDocument();
    expect(screen.getByText(/isn't your ZIP or search radius/i)).toBeInTheDocument();
    expect(screen.queryByText(/Adjust the location search first/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Try a larger radius/i)).not.toBeInTheDocument();
    expect(
      await screen.findByRole("heading", { name: "Meal rankings need saved prices" }),
    ).toBeInTheDocument();
  }, 15_000);

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
    vi.stubGlobal("fetch", fetchMock);

    const { RecommendationDemo: DemoWithInternal } = await import(
      "@/components/recommendation-demo"
    );
    render(createElement(DemoWithInternal));

    await user.click(screen.getByRole("button", { name: "Find nearby stores" }));
    await screen.findByText("Kroger Mechanicsville");

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
          "Publix is an approved next target, but it is not yet active for trusted recommendation pricing in this MVP.",
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
          "Kroger official store discovery found 1 nearby store(s). These results support discovery only for now and do not yet drive ranked meal pricing.",
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
    message:
      "Showing 1 nearby store(s) within 5 miles of Mechanicsville, VA using local PostgreSQL data. 1 currently feed ranked recommendations in this MVP. Kroger official store discovery found 1 nearby store(s). These results support discovery only for now and do not yet drive ranked meal pricing. Kroger official pricing preview matched 2 of 5 tracked ingredient(s). Coverage is still limited, so this preview remains informational and is not used for ranked meal pricing.",
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
            ingredient: "Chicken thighs",
            quantityNote: "2 lb family pack",
            storeName: "Kroger Mechanicsville",
            price: 6.49,
            freshnessDaysAgo: 1,
            saleLabel: "Weekly special",
            saleConfidence: {
              level: "advertised-recent",
              label: "Kroger weekly ad special — verify in store",
              note: "This sale came from a scraped Kroger weekly-ad pull (88% ingredient match). Weekly ads change often, so confirm price and package size in store.",
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
        freshnessLabel: "Recent prices",
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
            directionalLabel: "Directional provider preview looks lower",
            message:
              "Compared 1 of 5 recipe ingredient(s) where Kroger provider preview matches exist. For those overlapping ingredients, ranked cache subtotal is $6.49 versus a directional Kroger preview subtotal of $5.99 (-$0.50). This comparison is directional only and does not change the ranked meal total above.",
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
            directionalLabel: "No directional provider comparison",
            message:
              "No Publix provider preview prices overlapped this recipe's ingredients, so Yum4Less cannot show a directional comparison yet. Ranked meal pricing still uses ingested cache rows only and does not change the ranked meal total above.",
            ingredients: [],
          },
        ],
      },
    ],
  },
};
