"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { buildDiscoveryMapModel } from "@/lib/nearby-stores-map-model";
import type { MealPreferenceForm } from "@/lib/recommendation-service";
import { DEFAULT_MAX_INGREDIENTS } from "@/lib/meal-preference-defaults";
import { getDefaultRecipeSource } from "@/lib/recipe-sources/recipe-source-registry";
import {
  buildMealPreferencePayload,
  validateLocationFields,
  validateMealFields,
} from "@/components/meal-planner/form-validation";
import {
  mapMarketSearchApiError,
  mapRecommendationApiError,
} from "@/components/meal-planner/recommendation-error-copy";
import { trackClientEvent } from "@/lib/analytics/track-client-event";
import { trimMarketForRankingPassThrough } from "@/lib/market-pass-through";
import {
  buildSettingsPreferencesPatch,
  clearSettingsPreferences,
  isSettingsPreferencesComplete,
  readSettingsPreferences,
  writeSettingsPreferences,
} from "@/lib/settings-preferences";
import {
  clearAllZipSearchCenters,
  clearZipSearchCenter,
  readZipSearchCenter,
  writeZipSearchCenter,
  type ZipSearchCenter,
} from "@/lib/zip-search-centers";
import { ZIP_SEARCH_CENTER_CANCEL_NOTICE } from "@/lib/zip-search-center-copy";
import {
  canonicalizeStoreIdsForSettings,
  filterSelectedStoreIdsAgainstSelectable,
} from "@/lib/store-identity-settings-lookup";
import { scopeMarketSummaryToSelectedStoresForMap } from "@/lib/store-identity-map-pin-resolve";
import { defaultSelectedStoreIdsForSettings, filterSettingsSelectableStores } from "@/lib/settings-store-selection";
import type { AppTab } from "@/components/meal-planner/app-tab";
import {
  isAppTabEnabled,
  resolveAppTabFromPreferences,
  SSR_DEFAULT_APP_TAB,
} from "@/components/meal-planner/app-tab";
import type { IngredientPickMode } from "@/components/meal-planner/ingredient-pick-mode";
import type { FlowStep } from "@/components/meal-planner/flow-step";
import { getInitialFlowStep } from "@/components/meal-planner/flow-step";
import type { PantryItemSource } from "@/components/meal-planner/pantry-step-panel";
import type {
  ActiveLocationRequest,
  FieldErrors,
  FormState,
  MarketSearchRequest,
  MarketSearchResponse,
  MarketSearchState,
  PantryCoverageResponse,
  PantryCoverageState,
  RecommendationRequest,
  RecommendationResponse,
  RecommendationState,
} from "@/components/meal-planner/types";
import type { CatalogIngredient } from "@/lib/ingredient-category";

const defaultForm: MealPreferenceForm = {
  zipCode: "23111",
  radiusMiles: 5,
  budget: 20,
  maxIngredients: DEFAULT_MAX_INGREDIENTS,
  shoppingStyle: "single-store",
  dietaryFocus: "anything",
  recipeSource: getDefaultRecipeSource(),
  selectedStoreIds: [],
  planningMode: "ingredient-first",
};

const defaultFormState: FormState = {
  zipCode: defaultForm.zipCode,
  radiusMiles: String(defaultForm.radiusMiles),
  budget: String(defaultForm.budget),
  shoppingStyle: defaultForm.shoppingStyle,
  dietaryFocus: defaultForm.dietaryFocus,
  recipeSource: defaultForm.recipeSource,
  selectedStoreIds: [],
  theme: "light",
};

const initialMarketSearchState: MarketSearchState = { status: "idle" };
const initialRecommendationState: RecommendationState = { status: "idle" };
const initialPantryCoverageState: PantryCoverageState = {
  status: "idle",
  suggestedChecklist: [],
  fullyCoveredRecipeCount: 0,
  eligibleRecipeCount: 0,
};

function hydrateFormFromSettings(): FormState {
  const saved = readSettingsPreferences();
  if (!saved) {
    return defaultFormState;
  }

  return {
    ...defaultFormState,
    ...(saved.zipCode ? { zipCode: saved.zipCode } : {}),
    ...(saved.radiusMiles !== undefined
      ? { radiusMiles: String(saved.radiusMiles) }
      : {}),
    ...(saved.shoppingStyle ? { shoppingStyle: saved.shoppingStyle } : {}),
    ...(saved.selectedStoreIds
      ? {
          selectedStoreIds: canonicalizeStoreIdsForSettings(
            saved.selectedStoreIds,
          ),
        }
      : {}),
    ...(saved.theme ? { theme: saved.theme } : {}),
  };
}

function readInitialLocationValidationMode(): "zip" | "browser" {
  const saved = readSettingsPreferences();
  return saved?.locationMode === "geolocation" ? "browser" : "zip";
}

function persistLocationPreferences(
  form: FormState,
  request?: ActiveLocationRequest,
): void {
  const radiusMiles = Number(form.radiusMiles);
  if (!Number.isFinite(radiusMiles)) {
    return;
  }

  writeSettingsPreferences(
    buildSettingsPreferencesPatch({
      ...(form.zipCode.trim() ? { zipCode: form.zipCode.trim() } : {}),
      radiusMiles,
      shoppingStyle: form.shoppingStyle,
      selectedStoreIds: canonicalizeStoreIdsForSettings(form.selectedStoreIds),
      theme: form.theme,
      ...(request?.mode === "browser"
        ? { locationMode: "geolocation" as const }
        : request?.mode === "zip"
          ? { locationMode: "zip" as const }
          : {}),
    }),
  );
}

export function useMealPlanner() {
  const [activeTab, setActiveTab] = useState<AppTab>(SSR_DEFAULT_APP_TAB);
  const [settingsComplete, setSettingsComplete] = useState(false);
  const [flowStep, setFlowStep] = useState<FlowStep>(() => getInitialFlowStep());
  const [form, setForm] = useState<FormState>(defaultFormState);
  const preferencesHydratedRef = useRef(false);
  const [marketSearchState, setMarketSearchState] =
    useState<MarketSearchState>(initialMarketSearchState);
  const [recommendationState, setRecommendationState] =
    useState<RecommendationState>(initialRecommendationState);
  const [activeLocationRequest, setActiveLocationRequest] =
    useState<ActiveLocationRequest>();
  const [locationValidationMode, setLocationValidationMode] = useState<
    "zip" | "browser"
  >(readInitialLocationValidationMode);
  const [hasAttemptedLocationSearch, setHasAttemptedLocationSearch] =
    useState(false);
  const [hasAttemptedRanking, setHasAttemptedRanking] = useState(false);
  const [hasAttemptedWelcome, setHasAttemptedWelcome] = useState(false);
  const [settingsSaveError, setSettingsSaveError] = useState<string>();
  const [isInternalDetailsOpen, setIsInternalDetailsOpen] = useState(false);
  const [selectedStoreId, setSelectedStoreId] = useState<string>();
  const [selectedIngredientIds, setSelectedIngredientIds] = useState<string[]>([]);
  const [ingredientPickMode, setIngredientPickMode] = useState<IngredientPickMode>("unset");
  const [isMapOverlayOpen, setIsMapOverlayOpen] = useState(false);
  const [isZipCenterPickerOpen, setIsZipCenterPickerOpen] = useState(false);
  const [zipCenterCancelNotice, setZipCenterCancelNotice] = useState<string>();
  const [pantryIngredientIds, setPantryIngredientIds] = useState<string[]>([]);
  const [pantryItemSources, setPantryItemSources] = useState<
    Record<string, PantryItemSource>
  >({});
  const [ingredientCatalog, setIngredientCatalog] = useState<CatalogIngredient[]>([]);
  const [pantryCoverageState, setPantryCoverageState] = useState<PantryCoverageState>(
    initialPantryCoverageState,
  );
  const marketSearchRequestRef = useRef(0);
  const rankRequestRef = useRef(0);
  const pantryCoverageRequestRef = useRef(0);
  const geolocationRequestRef = useRef(0);
  const autoMarketSearchAttemptedRef = useRef(false);
  const rankedStoreScopeRef = useRef<string[] | null>(null);
  const pantryCatalogLoadedRef = useRef(false);
  const pantryCoverageStatusRef = useRef<PantryCoverageState["status"]>(
    initialPantryCoverageState.status,
  );
  const pantryCoverageRateLimitedUntilRef = useRef<number | null>(null);

  const marketSearchLoading = marketSearchState.status === "loading";
  const rankLoading = recommendationState.status === "loading";

  const locationErrors = useMemo(
    () => validateLocationFields(form, locationValidationMode === "zip"),
    [form, locationValidationMode],
  );
  const mealErrors = useMemo(() => validateMealFields(form), [form]);
  const rankLocationErrors = useMemo(
    () =>
      activeLocationRequest
        ? validateLocationFields(form, activeLocationRequest.mode === "zip")
        : {},
    [form, activeLocationRequest],
  );
  const displayedErrors: FieldErrors = {
    ...(hasAttemptedLocationSearch ? locationErrors : {}),
    ...(hasAttemptedWelcome || hasAttemptedRanking ? mealErrors : {}),
    ...(hasAttemptedRanking ? rankLocationErrors : {}),
  };

  useEffect(() => {
    setActiveTab(resolveAppTabFromPreferences());
    setForm(hydrateFormFromSettings());
    setSettingsComplete(
      isSettingsPreferencesComplete(readSettingsPreferences()),
    );
    preferencesHydratedRef.current = true;
  }, []);

  useEffect(() => {
    if (recommendationState.status === "ready") {
      setFlowStep("results");
    }
  }, [recommendationState.status]);

  const market = marketSearchState.market;
  const scopedMarket = useMemo(() => {
    if (!market) {
      return market;
    }

    // Expand-aware Map scope (Slice 5b): alias selection still finds canonical
    // pins when server expand collapsed nearbyStores. Flag OFF → exact-id.
    return scopeMarketSummaryToSelectedStoresForMap(
      market,
      form.selectedStoreIds,
    );
  }, [market, form.selectedStoreIds]);
  const recommendations = recommendationState.recommendations ?? [];
  const shopperNotice = recommendationState.shopperNotice;
  const supplementaryShopperNotices =
    recommendationState.supplementaryShopperNotices;
  const marketBlocked = !!scopedMarket && scopedMarket.recommendationReadyStoreCount === 0;
  const nearbyStoresMapModel = useMemo(
    () => (scopedMarket ? buildDiscoveryMapModel(scopedMarket) : undefined),
    [scopedMarket],
  );
  const cookEnabled =
    recommendationState.status === "ready" && recommendations.length > 0;
  const showMapLink =
    activeTab === "home" &&
    flowStep === "ingredients" &&
    Boolean(scopedMarket) &&
    !isMapOverlayOpen;
  const showResultsInHomeFlow =
    activeTab === "home" &&
    (flowStep === "results" ||
      rankLoading ||
      recommendationState.status === "error");

  useEffect(() => {
    pantryCoverageStatusRef.current = pantryCoverageState.status;
  }, [pantryCoverageState.status]);

  const pantryRows = useMemo(() => {
    const nameById = new Map(
      ingredientCatalog.map((ingredient) => [ingredient.id, ingredient.name]),
    );
    for (const item of pantryCoverageState.suggestedChecklist) {
      nameById.set(item.ingredientId, item.ingredientName);
    }

    return pantryIngredientIds.map((ingredientId) => ({
      ingredientId,
      ingredientName: nameById.get(ingredientId) ?? ingredientId,
      source: pantryItemSources[ingredientId] ?? "manual",
      recipeCount: pantryCoverageState.suggestedChecklist.find(
        (item) => item.ingredientId === ingredientId,
      )?.recipeCount,
    }));
  }, [
    ingredientCatalog,
    pantryCoverageState.suggestedChecklist,
    pantryIngredientIds,
    pantryItemSources,
  ]);

  useEffect(() => {
    if (!preferencesHydratedRef.current) {
      return;
    }

    const radiusMiles = Number(form.radiusMiles);
    if (!Number.isFinite(radiusMiles)) {
      return;
    }

    writeSettingsPreferences(
      buildSettingsPreferencesPatch({
        ...(form.zipCode.trim() ? { zipCode: form.zipCode.trim() } : {}),
        radiusMiles,
        shoppingStyle: form.shoppingStyle,
        selectedStoreIds: canonicalizeStoreIdsForSettings(form.selectedStoreIds),
        theme: form.theme,
      }),
    );
  }, [form.zipCode, form.radiusMiles, form.shoppingStyle, form.selectedStoreIds, form.theme]);

  useEffect(() => {
    if (!preferencesHydratedRef.current) {
      return;
    }

    if (rankedStoreScopeRef.current === null) {
      return;
    }

    if (sameSelectedStoreIds(form.selectedStoreIds, rankedStoreScopeRef.current)) {
      return;
    }

    invalidateRankedResults();
  }, [form.selectedStoreIds]);

  function invalidateRankedResults() {
    rankedStoreScopeRef.current = null;
    rankRequestRef.current += 1;
    setRecommendationState(initialRecommendationState);
  }

  function resetLocationDependentState() {
    marketSearchRequestRef.current += 1;
    rankRequestRef.current += 1;
    geolocationRequestRef.current += 1;
    autoMarketSearchAttemptedRef.current = false;
    rankedStoreScopeRef.current = null;
    setMarketSearchState(initialMarketSearchState);
    setRecommendationState(initialRecommendationState);
    setActiveLocationRequest(undefined);
    setHasAttemptedRanking(false);
    setSelectedStoreId(undefined);
    setSelectedIngredientIds([]);
    setIngredientPickMode("unset");
    setPantryIngredientIds([]);
    setPantryItemSources({});
    setIngredientCatalog([]);
    setPantryCoverageState(initialPantryCoverageState);
    pantryCoverageStatusRef.current = initialPantryCoverageState.status;
    pantryCoverageRateLimitedUntilRef.current = null;
    pantryCatalogLoadedRef.current = false;
    setIsMapOverlayOpen(false);
    setIsZipCenterPickerOpen(false);
    setForm((current) => ({ ...current, selectedStoreIds: [] }));
  }

  function runZipMarketSearch(
    zipCode: string,
    radiusMiles: number,
    center: ZipSearchCenter,
    options?: { notice?: string },
  ) {
    void runMarketSearch(
      {
        zipCode,
        radiusMiles,
        latitude: center.latitude,
        longitude: center.longitude,
      },
      {
        mode: "zip",
        zipCode,
        latitude: center.latitude,
        longitude: center.longitude,
      },
      options,
    );
  }

  function openZipCenterPicker() {
    setZipCenterCancelNotice(undefined);
    setIsZipCenterPickerOpen(true);
  }

  function runMarketSearchFromSavedPreferences() {
    const saved = readSettingsPreferences();
    const radiusMiles = Number(form.radiusMiles);
    if (!Number.isFinite(radiusMiles)) {
      return;
    }

    // Exact coords are not persisted — re-request geolocation each visit.
    if (saved?.locationMode === "geolocation") {
      setLocationValidationMode("browser");

      if (!("geolocation" in navigator)) {
        void runMarketSearchWithZipFallback(
          "Browser location is unavailable — using your saved ZIP instead.",
          radiusMiles,
        );
        return;
      }

      setMarketSearchState({ status: "loading" });
      setRecommendationState(initialRecommendationState);

      const geolocationRequestId = ++geolocationRequestRef.current;

      navigator.geolocation.getCurrentPosition(
        (position) => {
          if (geolocationRequestId !== geolocationRequestRef.current) {
            return;
          }

          void runMarketSearch(
            {
              zipCode: form.zipCode.trim(),
              radiusMiles,
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
          if (geolocationRequestId !== geolocationRequestRef.current) {
            return;
          }

          void runMarketSearchWithZipFallback(
            "Location access was denied — using your saved ZIP instead.",
            radiusMiles,
          );
        },
      );
      return;
    }

    setLocationValidationMode("zip");
    if (Object.keys(validateLocationFields(form, true)).length > 0) {
      return;
    }

    const zipCode = form.zipCode.trim();
    const cachedCenter = readZipSearchCenter(zipCode);
    if (!cachedCenter) {
      // Avoid silently searching from ZIP centroid — require a pin (or Find).
      return;
    }

    runZipMarketSearch(zipCode, radiusMiles, cachedCenter);
  }

  function runMarketSearchWithZipFallback(notice: string, radiusMiles: number) {
    setLocationValidationMode("zip");

    if (Object.keys(validateLocationFields(form, true)).length > 0) {
      setMarketSearchState({
        status: "error",
        error: notice,
      });
      return;
    }

    const zipCode = form.zipCode.trim();
    const cachedCenter = readZipSearchCenter(zipCode);
    if (cachedCenter) {
      runZipMarketSearch(zipCode, radiusMiles, cachedCenter, { notice });
      return;
    }

    setZipCenterCancelNotice(undefined);
    setMarketSearchState({
      status: "error",
      error: notice,
    });
    openZipCenterPicker();
  }

  async function runMarketSearch(
    payload: MarketSearchRequest,
    request: ActiveLocationRequest,
    options?: { notice?: string },
  ) {
    const requestId = ++marketSearchRequestRef.current;
    rankRequestRef.current += 1;
    rankedStoreScopeRef.current = null;
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

      if (requestId !== marketSearchRequestRef.current) {
        return;
      }

      if (!result.ok) {
        const mapped = mapMarketSearchApiError({
          httpStatus: response.status,
          error: result.error,
          providerConfigured: result.providerConfigured,
        });
        setMarketSearchState({
          status: "error",
          providerConfigured: result.providerConfigured,
          error: mapped.body,
          errorTitle: mapped.title,
          errorHint: mapped.hint,
        });
        trackClientEvent("location_search_failed", {
          mode: request.mode,
          error_code:
            response.status === 400
              ? "validation"
              : result.providerConfigured === false
                ? "provider_unconfigured"
                : response.status === 404
                  ? "not_found"
                  : response.status >= 500
                    ? "server"
                    : "server",
        });
        return;
      }

      setMarketSearchState({
        status: "ready",
        market: result.market,
        ...(options?.notice ? { notice: options.notice } : {}),
      });
      setActiveLocationRequest(request);
      persistLocationPreferences(
        {
          ...form,
          zipCode: payload.zipCode || form.zipCode,
          radiusMiles: String(payload.radiusMiles),
        },
        request,
      );
      setSelectedStoreId(undefined);
      setSelectedIngredientIds([]);
      setForm((current) => {
        const selectable = filterSettingsSelectableStores(result.market.nearbyStores);
        const enabledSelectableIds = new Set(
          selectable
            .filter((store) => store.recommendationEnabled)
            .map((store) => store.id),
        );
        const persistedSelection = filterSelectedStoreIdsAgainstSelectable(
          current.selectedStoreIds,
          enabledSelectableIds,
        );
        const selectedStoreIds =
          persistedSelection.length > 0
            ? current.shoppingStyle === "single-store"
              ? [persistedSelection[0]!]
              : persistedSelection
            : defaultSelectedStoreIdsForSettings(
                result.market.nearbyStores,
                current.shoppingStyle,
              );

        return { ...current, selectedStoreIds };
      });
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
      if (requestId !== marketSearchRequestRef.current) {
        return;
      }

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

  useEffect(() => {
    const shouldAutoLoadMarket =
      (activeTab === "settings" &&
        !isSettingsPreferencesComplete(readSettingsPreferences())) ||
      (activeTab === "home" &&
        (flowStep === "welcome" || flowStep === "ingredients")) ||
      activeTab === "deals";

    if (!shouldAutoLoadMarket) {
      return;
    }

    if (!isSettingsPreferencesComplete(readSettingsPreferences())) {
      return;
    }

    if (marketSearchState.status !== "idle" || autoMarketSearchAttemptedRef.current) {
      return;
    }

    autoMarketSearchAttemptedRef.current = true;
    runMarketSearchFromSavedPreferences();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- one-shot auto-load for home/deals tabs
  }, [activeTab, flowStep, marketSearchState.status]);

  function handleTabChange(tab: AppTab) {
    if (
      !isAppTabEnabled(tab, {
        settingsComplete,
        cookEnabled,
      })
    ) {
      return;
    }

    setActiveTab(tab);

    if (tab === "cook" && cookEnabled) {
      setFlowStep("results");
    }
  }

  function handleFindStores() {
    setSettingsSaveError(undefined);
    setZipCenterCancelNotice(undefined);
    setLocationValidationMode("zip");
    setHasAttemptedLocationSearch(true);
    geolocationRequestRef.current += 1;

    if (Object.keys(validateLocationFields(form, true)).length > 0) {
      return;
    }

    const zipCode = form.zipCode.trim();
    const radiusMiles = Number(form.radiusMiles);
    const cachedCenter = readZipSearchCenter(zipCode);
    if (cachedCenter) {
      runZipMarketSearch(zipCode, radiusMiles, cachedCenter);
      return;
    }

    openZipCenterPicker();
  }

  function handleZipCenterPickerConfirm(center: ZipSearchCenter) {
    const zipCode = form.zipCode.trim();
    const radiusMiles = Number(form.radiusMiles);
    writeZipSearchCenter(zipCode, center);
    setIsZipCenterPickerOpen(false);
    setZipCenterCancelNotice(undefined);
    setHasAttemptedLocationSearch(true);
    setLocationValidationMode("zip");
    runZipMarketSearch(zipCode, radiusMiles, center);
  }

  function handleZipCenterPickerCancel() {
    setIsZipCenterPickerOpen(false);
    setZipCenterCancelNotice(ZIP_SEARCH_CENTER_CANCEL_NOTICE);
  }

  function handleZipCodeChange(zipCode: string) {
    setForm((current) => {
      const previous = current.zipCode.trim();
      if (/^\d{5}$/.test(previous) && previous !== zipCode.trim()) {
        clearZipSearchCenter(previous);
      }
      return { ...current, zipCode };
    });
    setZipCenterCancelNotice(undefined);
    resetLocationDependentState();
  }

  function handleRadiusMilesChange(radiusMiles: string) {
    setForm((current) => ({ ...current, radiusMiles }));
    setZipCenterCancelNotice(undefined);

    const zipCode = form.zipCode.trim();
    const parsedRadius = Number(radiusMiles);
    const marketReady = marketSearchState.status === "ready";
    const cachedCenter = readZipSearchCenter(zipCode);

    if (!marketReady) {
      return;
    }

    if (!Number.isFinite(parsedRadius)) {
      resetLocationDependentState();
      return;
    }

    if (cachedCenter) {
      rankedStoreScopeRef.current = null;
      setRecommendationState(initialRecommendationState);
      runZipMarketSearch(zipCode, parsedRadius, cachedCenter);
      return;
    }

    resetLocationDependentState();
    openZipCenterPicker();
  }

  function handleBrowserLocationSearch() {
    setSettingsSaveError(undefined);
    setLocationValidationMode("browser");
    setHasAttemptedLocationSearch(true);
    geolocationRequestRef.current += 1;

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

    const geolocationRequestId = ++geolocationRequestRef.current;

    navigator.geolocation.getCurrentPosition(
      (position) => {
        if (geolocationRequestId !== geolocationRequestRef.current) {
          return;
        }

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
        if (geolocationRequestId !== geolocationRequestRef.current) {
          return;
        }

        void runMarketSearchWithZipFallback(
          "Location access was denied — using your ZIP instead.",
          Number(form.radiusMiles),
        );
      },
    );
  }

  function handleSaveSettings() {
    setSettingsSaveError(undefined);
    setHasAttemptedLocationSearch(true);

    if (!market) {
      setSettingsSaveError("Find stores for your area before saving Settings.");
      return;
    }

    const hasBrowserCoordinates =
      activeLocationRequest?.mode === "browser" &&
      Number.isFinite(activeLocationRequest.latitude) &&
      Number.isFinite(activeLocationRequest.longitude);
    const requireZipCode = !hasBrowserCoordinates;

    if (Object.keys(validateLocationFields(form, requireZipCode)).length > 0) {
      return;
    }

    if (
      form.selectedStoreIds.length === 0 ||
      (form.shoppingStyle === "single-store" && form.selectedStoreIds.length !== 1)
    ) {
      setSettingsSaveError("Choose at least one store that matches your shopping style.");
      return;
    }

    const radiusMiles = Number(form.radiusMiles);
    const prefs = buildSettingsPreferencesPatch({
      zipCode: form.zipCode.trim(),
      radiusMiles,
      shoppingStyle: form.shoppingStyle,
      selectedStoreIds: canonicalizeStoreIdsForSettings(form.selectedStoreIds),
      theme: form.theme,
      ...(hasBrowserCoordinates
        ? { locationMode: "geolocation" as const }
        : { locationMode: "zip" as const }),
      markSetupComplete: true,
    });

    if (!isSettingsPreferencesComplete(prefs)) {
      setSettingsSaveError("Complete location, radius, shopping style, and store selection.");
      return;
    }

    writeSettingsPreferences(prefs);
    setSettingsComplete(true);
    if (
      prefs.selectedStoreIds &&
      !sameSelectedStoreIds(form.selectedStoreIds, prefs.selectedStoreIds)
    ) {
      setForm((current) => ({
        ...current,
        selectedStoreIds: prefs.selectedStoreIds!,
      }));
    }
    autoMarketSearchAttemptedRef.current = true;
    invalidateRankedResults();
    setActiveTab("home");
    setFlowStep("welcome");
  }

  function handleFactoryReset() {
    clearSettingsPreferences();
    clearAllZipSearchCenters();
    resetLocationDependentState();
    setForm(defaultFormState);
    setSettingsSaveError(undefined);
    setZipCenterCancelNotice(undefined);
    setHasAttemptedLocationSearch(false);
    setHasAttemptedWelcome(false);
    setHasAttemptedRanking(false);
    setLocationValidationMode("zip");
    setSettingsComplete(false);
    setActiveTab("settings");
    setFlowStep("welcome");
  }

  function handleCompleteWelcome() {
    setHasAttemptedWelcome(true);
    if (Object.keys(validateMealFields(form)).length > 0) {
      return;
    }

    invalidateRankedResults();
    setFlowStep("ingredients");
    setIngredientPickMode("unset");
    setSelectedIngredientIds([]);
  }

  const runPantryCoverageAssess = useCallback(
    async (
      pantryIds: string[],
      options?: { includeIngredientCatalog?: boolean; skipLoadingState?: boolean },
    ) => {
      if (!market || !activeLocationRequest) {
        return;
      }

      const preferences = buildMealPreferencePayload(form);
      if (!preferences) {
        return;
      }

      const requestId = ++pantryCoverageRequestRef.current;
      if (!options?.skipLoadingState) {
        setPantryCoverageState((current) => ({
          ...current,
          status: "loading",
          error: undefined,
        }));
      }

      const payload: RecommendationRequest & { includeIngredientCatalog?: boolean } = {
        ...preferences,
        recipeSource: getDefaultRecipeSource(),
        selectedStoreIds: preferences.selectedStoreIds,
        ...(selectedIngredientIds.length > 0 ? { selectedIngredientIds } : {}),
        ...(pantryIds.length > 0 ? { pantryIngredientIds: pantryIds } : {}),
        ...(options?.includeIngredientCatalog ? { includeIngredientCatalog: true } : {}),
        market: trimMarketForRankingPassThrough(scopedMarket ?? market),
        zipCode:
          activeLocationRequest.mode === "zip"
            ? activeLocationRequest.zipCode
            : "",
        latitude: activeLocationRequest.latitude,
        longitude: activeLocationRequest.longitude,
      };

      try {
        const response = await fetch("/api/pantry-coverage", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
          cache: "no-store",
        });

        if (requestId !== pantryCoverageRequestRef.current) {
          return;
        }

        if (response.status === 429) {
          let errorMessage = "Too many requests. Please wait and try again.";
          try {
            const rateLimitBody = (await response.json()) as PantryCoverageResponse;
            if (!rateLimitBody.ok && rateLimitBody.error) {
              errorMessage = rateLimitBody.error;
            }
          } catch {
            // Keep default rate-limit copy when the body is not JSON.
          }

          const retryAfterHeader = response.headers.get("Retry-After");
          const retryAfterSeconds = retryAfterHeader
            ? Math.max(1, Number.parseInt(retryAfterHeader, 10) || 60)
            : 60;
          pantryCoverageRateLimitedUntilRef.current =
            Date.now() + retryAfterSeconds * 1000;

          setPantryCoverageState({
            status: "rate-limited",
            suggestedChecklist: [],
            fullyCoveredRecipeCount: 0,
            eligibleRecipeCount: 0,
            error: errorMessage,
          });
          return;
        }

        const result = (await response.json()) as PantryCoverageResponse;

        if (requestId !== pantryCoverageRequestRef.current) {
          return;
        }

        if (!response.ok || !result.ok) {
          setPantryCoverageState({
            status: "error",
            suggestedChecklist: [],
            fullyCoveredRecipeCount: 0,
            eligibleRecipeCount: 0,
            error: result.ok ? "Pantry coverage is temporarily unavailable." : result.error,
          });
          return;
        }

        if (result.ingredientCatalog) {
          setIngredientCatalog(result.ingredientCatalog);
          pantryCatalogLoadedRef.current = true;
        }

        setPantryCoverageState({
          status: "ready",
          suggestedChecklist: result.suggestedChecklist,
          fullyCoveredRecipeCount: result.fullyCoveredRecipeCount,
          eligibleRecipeCount: result.eligibleRecipeCount,
        });
      } catch {
        if (requestId !== pantryCoverageRequestRef.current) {
          return;
        }

        setPantryCoverageState({
          status: "error",
          suggestedChecklist: [],
          fullyCoveredRecipeCount: 0,
          eligibleRecipeCount: 0,
          error: "Pantry coverage is temporarily unavailable.",
        });
      }
    },
    [market, activeLocationRequest, form, selectedIngredientIds, scopedMarket],
  );

  useEffect(() => {
    if (flowStep !== "pantry") {
      return;
    }

    const delay = pantryCoverageStatusRef.current === "idle" ? 0 : 300;
    const timer = window.setTimeout(() => {
      void runPantryCoverageAssess(pantryIngredientIds, {
        includeIngredientCatalog: !pantryCatalogLoadedRef.current,
      });
    }, delay);

    return () => window.clearTimeout(timer);
  }, [flowStep, pantryIngredientIds, runPantryCoverageAssess]);

  function transitionToPantryStep() {
    rankedStoreScopeRef.current = null;
    setRecommendationState(initialRecommendationState);
    setPantryIngredientIds([]);
    setPantryItemSources({});
    setPantryCoverageState(initialPantryCoverageState);
    pantryCoverageStatusRef.current = initialPantryCoverageState.status;
    pantryCoverageRateLimitedUntilRef.current = null;
    setFlowStep("pantry");
  }

  function handleContinueToPantry() {
    transitionToPantryStep();
  }

  function handleSuggestRecipesFromPantry() {
    rankedStoreScopeRef.current = null;
    setRecommendationState(initialRecommendationState);
    setFlowStep("results");
    void handleRankMeals();
  }

  async function handleRankMeals() {
    setHasAttemptedRanking(true);

    if (!market || !activeLocationRequest) {
      return;
    }

    const locationFieldErrors = validateLocationFields(
      form,
      activeLocationRequest.mode === "zip",
    );
    if (Object.keys(locationFieldErrors).length > 0) {
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

    const requestId = ++rankRequestRef.current;

    const payload: RecommendationRequest = {
      ...preferences,
      recipeSource: getDefaultRecipeSource(),
      selectedStoreIds: preferences.selectedStoreIds,
      ...(selectedIngredientIds.length > 0 ? { selectedIngredientIds } : {}),
      ...(pantryIngredientIds.length > 0 ? { pantryIngredientIds } : {}),
      market: trimMarketForRankingPassThrough(scopedMarket ?? market),
      zipCode:
        activeLocationRequest.mode === "zip"
          ? activeLocationRequest.zipCode
          : "",
      latitude: activeLocationRequest.latitude,
      longitude: activeLocationRequest.longitude,
    };

    try {
      const response = await fetch("/api/recommendations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        cache: "no-store",
      });
      const result = (await response.json()) as RecommendationResponse;

      if (requestId !== rankRequestRef.current) {
        return;
      }

      if (!result.ok) {
        const mapped = mapRecommendationApiError({
          httpStatus: response.status,
          error: result.error,
          providerConfigured: result.providerConfigured,
        });
        setRecommendationState({
          status: "error",
          error: mapped.body,
          errorTitle: mapped.title,
          errorHint: mapped.hint,
        });
        trackClientEvent("rank_meals_failed", {
          error_code:
            response.status === 400
              ? "validation"
              : response.status === 404
                ? "not_found"
                : response.status >= 500
                  ? "server"
                  : "not_found",
        });
        return;
      }

      const syncedSelectedStoreIds = canonicalizeStoreIdsForSettings(
        result.experience.effectiveSelectedStoreIds ?? preferences.selectedStoreIds,
      );

      if (result.experience.effectiveSelectedStoreIds) {
        setForm((current) => ({
          ...current,
          selectedStoreIds: syncedSelectedStoreIds,
        }));
        const radiusMiles = Number(form.radiusMiles);
        if (Number.isFinite(radiusMiles)) {
          writeSettingsPreferences(
            buildSettingsPreferencesPatch({
              ...(preferences.zipCode.trim()
                ? { zipCode: preferences.zipCode.trim() }
                : {}),
              radiusMiles,
              shoppingStyle: preferences.shoppingStyle,
              selectedStoreIds: syncedSelectedStoreIds,
              theme: form.theme,
            }),
          );
        }
      }

      setRecommendationState({
        status: "ready",
        recommendations: result.experience.recommendations,
        shopperNotice: result.experience.shopperNotice,
        supplementaryShopperNotices: result.experience.supplementaryShopperNotices,
      });
      rankedStoreScopeRef.current = [...syncedSelectedStoreIds];
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
      if (requestId !== rankRequestRef.current) {
        return;
      }

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
    const store = scopedMarket?.nearbyStores.find((candidate) => candidate.id === storeId);
    if (store) {
      trackClientEvent("store_pin_selected", {
        chain: store.chainLabel,
        recommendation_enabled: store.recommendationEnabled,
      });
    }
  }

  function handleToggleIngredient(ingredientId: string, checked: boolean) {
    setSelectedIngredientIds((current) => {
      if (checked) {
        return current.includes(ingredientId) ? current : [...current, ingredientId];
      }

      return current.filter((id) => id !== ingredientId);
    });
  }

  function handleSelectAllIngredients() {
    setSelectedIngredientIds(
      scopedMarket?.saleIngredientChoices.map((choice) => choice.ingredientId) ?? [],
    );
  }

  function handleClearIngredientSelection() {
    setSelectedIngredientIds([]);
  }

  function handleUseAllIngredients() {
    setIngredientPickMode("all");
    setSelectedIngredientIds([]);
    transitionToPantryStep();
  }

  function handlePickIngredientsManually() {
    setIngredientPickMode("manual");
  }

  function handleTogglePantryChecklistItem(ingredientId: string, checked: boolean) {
    if (checked) {
      setPantryIngredientIds((current) =>
        current.includes(ingredientId) ? current : [...current, ingredientId],
      );
      setPantryItemSources((current) => ({ ...current, [ingredientId]: "suggested" }));
      return;
    }

    setPantryIngredientIds((current) => current.filter((id) => id !== ingredientId));
    setPantryItemSources((current) => {
      const next = { ...current };
      delete next[ingredientId];
      return next;
    });
  }

  function handleAddPantryIngredient(result: {
    ingredientId: string;
    ingredientName: string;
    nearMissRecipeCount: number;
  }) {
    setPantryIngredientIds((current) =>
      current.includes(result.ingredientId)
        ? current
        : [...current, result.ingredientId],
    );
    setPantryItemSources((current) => ({
      ...current,
      [result.ingredientId]: "manual",
    }));
  }

  function handleRemovePantryIngredient(ingredientId: string) {
    setPantryIngredientIds((current) => current.filter((id) => id !== ingredientId));
    setPantryItemSources((current) => {
      const next = { ...current };
      delete next[ingredientId];
      return next;
    });
  }

  function handleOpenMapOverlay() {
    setIsMapOverlayOpen(true);
  }

  function handleCloseMapOverlay() {
    setIsMapOverlayOpen(false);
  }

  return {
    activeTab,
    handleTabChange,
    settingsComplete,
    cookEnabled,
    flowStep,
    form,
    setForm,
    resetLocationDependentState,
    displayedErrors,
    marketSearchState,
    recommendationState,
    marketSearchLoading,
    rankLoading,
    activeLocationRequest,
    market,
    scopedMarket,
    recommendations,
    shopperNotice,
    supplementaryShopperNotices,
    marketBlocked,
    nearbyStoresMapModel,
    showMapLink,
    isMapOverlayOpen,
    showResultsInHomeFlow,
    ingredientPickMode,
    pantryIngredientIds,
    pantryCoverageState,
    pantryRows,
    ingredientCatalog,
    settingsSaveError,
    zipCenterCancelNotice,
    isZipCenterPickerOpen,
    isInternalDetailsOpen,
    setIsInternalDetailsOpen,
    selectedStoreId,
    handleStoreSelect,
    handleFindStores,
    handleZipCenterPickerConfirm,
    handleZipCenterPickerCancel,
    handleZipCodeChange,
    handleRadiusMilesChange,
    handleBrowserLocationSearch,
    handleSaveSettings,
    handleFactoryReset,
    handleCompleteWelcome,
    handleContinueToPantry,
    handleSuggestRecipesFromPantry,
    handleRankMeals,
    selectedIngredientIds,
    handleToggleIngredient,
    handleSelectAllIngredients,
    handleClearIngredientSelection,
    handleUseAllIngredients,
    handlePickIngredientsManually,
    handleTogglePantryChecklistItem,
    handleAddPantryIngredient,
    handleRemovePantryIngredient,
    handleOpenMapOverlay,
    handleCloseMapOverlay,
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

function sameSelectedStoreIds(current: string[], previous: string[]) {
  if (current.length !== previous.length) {
    return false;
  }

  return current.every((storeId, index) => storeId === previous[index]);
}
