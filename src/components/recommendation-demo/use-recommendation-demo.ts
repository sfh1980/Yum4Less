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
        return;
      }

      setMarketSearchState({ status: "ready", market: result.market });
      setActiveLocationRequest(request);
      setIsEditingLocation(false);
      setFocusMealPreferencesToken((current) => current + 1);
      setSelectedStoreId(undefined);
    } catch (error: unknown) {
      setMarketSearchState({
        status: "error",
        error:
          error instanceof Error
            ? error.message
            : "Nearby store lookup failed unexpectedly.",
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
    } catch (error: unknown) {
      setRecommendationState({
        status: "error",
        error:
          error instanceof Error
            ? error.message
            : "Recommendation lookup failed unexpectedly.",
      });
    }
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
    setHasDismissedTrustExplainer,
    isInternalDetailsOpen,
    setIsInternalDetailsOpen,
    isEditingLocation,
    setIsEditingLocation,
    focusMealPreferencesToken,
    selectedStoreId,
    setSelectedStoreId,
    handleZipSearch,
    handleBrowserLocationSearch,
    handleRankMeals,
  };
}
