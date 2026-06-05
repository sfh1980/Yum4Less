"use client";

import { useEffect, useMemo, useState } from "react";
import { buildNearbyStoresMapModel } from "@/lib/nearby-stores-map-model";
import type { MealPreferenceForm } from "@/lib/recommendation-service";
import { getDefaultRecipeSource } from "@/lib/recipe-sources/recipe-source-registry";
import {
  buildMealPreferencePayload,
  validateLocationFields,
  validateMealFields,
} from "@/components/recommendation-demo/form-validation";
import { trackClientEvent } from "@/lib/analytics/track-client-event";
import type {
  ActiveLocationRequest,
  FieldErrors,
  FormState,
  MarketSearchRequest,
  MarketSearchResponse,
  MarketSearchState,
  RecommendationRequest,
  RecommendationResponse,
  RecommendationState,
} from "@/components/recommendation-demo/types";

const defaultForm: MealPreferenceForm = {
  zipCode: "23111",
  radiusMiles: 5,
  budget: 16,
  maxIngredients: 8,
  dinnersWanted: 3,
  shoppingStyle: "single-store",
  dietaryFocus: "anything",
  recipeSource: getDefaultRecipeSource(),
};

const defaultFormState: FormState = {
  zipCode: defaultForm.zipCode,
  radiusMiles: String(defaultForm.radiusMiles),
  budget: String(defaultForm.budget),
  maxIngredients: String(defaultForm.maxIngredients),
  dinnersWanted: String(defaultForm.dinnersWanted),
  shoppingStyle: defaultForm.shoppingStyle,
  dietaryFocus: defaultForm.dietaryFocus,
  recipeSource: defaultForm.recipeSource,
};

const initialMarketSearchState: MarketSearchState = { status: "idle" };
const initialRecommendationState: RecommendationState = { status: "idle" };

export function useRecommendationDemo() {
  const [form, setForm] = useState<FormState>(defaultFormState);
  const [marketSearchState, setMarketSearchState] =
    useState<MarketSearchState>(initialMarketSearchState);
  const [recommendationState, setRecommendationState] =
    useState<RecommendationState>(initialRecommendationState);
  const [activeLocationRequest, setActiveLocationRequest] =
    useState<ActiveLocationRequest>();
  const [locationValidationMode, setLocationValidationMode] = useState<
    "zip" | "browser"
  >("zip");
  const [hasAttemptedLocationSearch, setHasAttemptedLocationSearch] =
    useState(false);
  const [hasAttemptedRanking, setHasAttemptedRanking] = useState(false);
  const [isTrustExplainerOpen, setIsTrustExplainerOpen] = useState(false);
  const [hasDismissedTrustExplainer, setHasDismissedTrustExplainer] =
    useState(false);
  const [isInternalDetailsOpen, setIsInternalDetailsOpen] = useState(false);
  const [isEditingLocation, setIsEditingLocation] = useState(false);
  const [focusMealPreferencesToken, setFocusMealPreferencesToken] = useState(0);
  const [selectedStoreId, setSelectedStoreId] = useState<string>();

  const locationErrors = useMemo(
    () => validateLocationFields(form, locationValidationMode === "zip"),
    [form, locationValidationMode],
  );
  const mealErrors = useMemo(() => validateMealFields(form), [form]);
  const displayedErrors: FieldErrors = {
    ...(hasAttemptedLocationSearch ? locationErrors : {}),
    ...(hasAttemptedRanking ? mealErrors : {}),
  };

  useEffect(() => {
    if (
      recommendationState.status === "ready" &&
      !hasDismissedTrustExplainer
    ) {
      setIsTrustExplainerOpen(true);
    }
  }, [recommendationState.status, hasDismissedTrustExplainer]);

  const market = marketSearchState.market;
  const recommendations = recommendationState.recommendations ?? [];
  const shopperNotice = recommendationState.shopperNotice;
  const marketBlocked = !!market && market.recommendationReadyStoreCount === 0;
  const nearbyStoresMapModel = useMemo(
    () => (market ? buildNearbyStoresMapModel(market) : undefined),
    [market],
  );

  function resetLocationDependentState() {
    setMarketSearchState(initialMarketSearchState);
    setRecommendationState(initialRecommendationState);
    setActiveLocationRequest(undefined);
    setHasAttemptedRanking(false);
    setIsEditingLocation(true);
    setSelectedStoreId(undefined);
  }

  async function runMarketSearch(
    payload: MarketSearchRequest,
    request: ActiveLocationRequest,
  ) {
    setMarketSearchState({ status: "loading" });
    setRecommendationState(initialRecommendationState);
    trackClientEvent("location_search_started", {
      mode: request.mode,
      radius_miles: payload.radiusMiles,
    });

    try {
      const response = await fetch("/api/market-search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        cache: "no-store",
      });
      const result = (await response.json()) as MarketSearchResponse;

      if (!result.ok) {
        setMarketSearchState({
          status: "error",
          providerConfigured: result.providerConfigured,
          error: result.error,
        });
        trackClientEvent("location_search_failed", {
          mode: request.mode,
          error_code: result.providerConfigured === false ? "provider_unconfigured" : "not_found",
        });
        return;
      }

      setMarketSearchState({ status: "ready", market: result.market });
      setActiveLocationRequest(request);
      setIsEditingLocation(false);
      setFocusMealPreferencesToken((current) => current + 1);
      setSelectedStoreId(undefined);
      trackClientEvent("location_search_completed", {
        mode: request.mode,
        in_mvp_area: result.market.dataSource !== "unavailable",
        radius_miles: result.market.radiusMiles,
        store_count_bucket: bucketCount(result.market.nearbyStores.length),
        recommendation_ready_count_bucket: bucketCount(
          result.market.recommendationReadyStoreCount,
        ),
      });
    } catch (error: unknown) {
      setMarketSearchState({
        status: "error",
        error:
          error instanceof Error
            ? error.message
            : "Nearby store lookup failed unexpectedly.",
      });
      trackClientEvent("location_search_failed", {
        mode: request.mode,
        error_code: "network",
      });
    }
  }

  function handleZipSearch() {
    setLocationValidationMode("zip");
    setHasAttemptedLocationSearch(true);

    if (Object.keys(validateLocationFields(form, true)).length > 0) {
      return;
    }

    void runMarketSearch(
      {
        zipCode: form.zipCode.trim(),
        radiusMiles: Number(form.radiusMiles),
      },
      { mode: "zip", zipCode: form.zipCode.trim() },
    );
  }

  function handleBrowserLocationSearch() {
    setLocationValidationMode("browser");
    setHasAttemptedLocationSearch(true);

    if (Object.keys(validateLocationFields(form, false)).length > 0) {
      return;
    }

    if (!("geolocation" in navigator)) {
      setMarketSearchState({
        status: "error",
        error: "Browser geolocation is not available here. Try ZIP search instead.",
      });
      return;
    }

    setMarketSearchState({ status: "loading" });
    setRecommendationState(initialRecommendationState);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        void runMarketSearch(
          {
            zipCode: "",
            radiusMiles: Number(form.radiusMiles),
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          },
          {
            mode: "browser",
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          },
        );
      },
      () => {
        setMarketSearchState({
          status: "error",
          error:
            "We could not access your browser location. Check location permissions or use ZIP search instead.",
        });
      },
    );
  }

  async function handleRankMeals() {
    setHasAttemptedRanking(true);

    if (!market || !activeLocationRequest) {
      return;
    }

    if (Object.keys(validateMealFields(form)).length > 0) {
      return;
    }

    const preferences = buildMealPreferencePayload(form);
    if (!preferences) {
      return;
    }

    setRecommendationState({ status: "loading" });
    trackClientEvent("rank_meals_started", {
      shopping_style: preferences.shoppingStyle,
      dietary_focus: preferences.dietaryFocus,
      recipe_source: preferences.recipeSource,
    });

    const payload: RecommendationRequest = {
      ...preferences,
      ...(activeLocationRequest.mode === "zip"
        ? { zipCode: activeLocationRequest.zipCode }
        : {
            zipCode: "",
            latitude: activeLocationRequest.latitude,
            longitude: activeLocationRequest.longitude,
          }),
    };

    try {
      const response = await fetch("/api/recommendations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        cache: "no-store",
      });
      const result = (await response.json()) as RecommendationResponse;

      if (!result.ok) {
        setRecommendationState({ status: "error", error: result.error });
        trackClientEvent("rank_meals_failed", { error_code: "not_found" });
        return;
      }

      setMarketSearchState({
        status: "ready",
        market: result.experience.market,
      });
      setRecommendationState({
        status: "ready",
        recommendations: result.experience.recommendations,
        shopperNotice: result.experience.shopperNotice,
      });
      trackClientEvent("rank_meals_completed", {
        shopping_style: preferences.shoppingStyle,
        dietary_focus: preferences.dietaryFocus,
        recipe_source: preferences.recipeSource,
        result_count_bucket: bucketCount(result.experience.recommendations.length),
        market_data_source: result.experience.market.dataSource,
        has_fallback_notice: result.experience.market.providerStoreSearches.some(
          (search) => search.fallbackUsed,
        ),
      });
    } catch (error: unknown) {
      setRecommendationState({
        status: "error",
        error:
          error instanceof Error
            ? error.message
            : "Recommendation lookup failed unexpectedly.",
      });
      trackClientEvent("rank_meals_failed", { error_code: "network" });
    }
  }

  function handleStoreSelect(storeId: string) {
    setSelectedStoreId(storeId);
    const store = market?.nearbyStores.find((candidate) => candidate.id === storeId);
    if (store) {
      trackClientEvent("store_pin_selected", {
        chain: store.chainLabel,
        recommendation_enabled: store.recommendationEnabled,
      });
    }
  }

  function handleTrustExplainerClose() {
    setIsTrustExplainerOpen(false);
    setHasDismissedTrustExplainer(true);
    trackClientEvent("trust_explainer_dismissed");
  }

  return {
    form,
    setForm,
    resetLocationDependentState,
    displayedErrors,
    marketSearchState,
    recommendationState,
    activeLocationRequest,
    market,
    recommendations,
    shopperNotice,
    marketBlocked,
    nearbyStoresMapModel,
    isTrustExplainerOpen,
    setIsTrustExplainerOpen,
    handleTrustExplainerClose,
    isInternalDetailsOpen,
    setIsInternalDetailsOpen,
    isEditingLocation,
    setIsEditingLocation,
    focusMealPreferencesToken,
    selectedStoreId,
    handleStoreSelect,
    handleZipSearch,
    handleBrowserLocationSearch,
    handleRankMeals,
  };
}

function bucketCount(count: number) {
  if (count <= 0) {
    return "0";
  }

  if (count <= 3) {
    return "1-3";
  }

  return "4+";
}
