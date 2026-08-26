"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { buildDiscoveryMapModel } from "@/lib/nearby-stores-map-model";
import type { MealPreferenceForm, MealRecommendation } from "@/lib/recommendation-service";
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
  clearHomeSessionDinners,
  clearHomeSessionSnapshot,
  readAppReturnSnapshot,
  readHomeSessionSnapshot,
  shouldRestoreHomeSessionSnapshot,
  writeAppReturnSnapshot,
  writeHomeSessionSnapshot,
} from "@/lib/home-session-snapshot";
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
import { mergeSuggestedPantryChecklist } from "@/lib/recipe-plan-coverage";
import {
  clearSavedMeals,
  readSavedMeals,
  toggleSavedMeal,
  writeSavedMeals,
  type SavedMealSnapshot,
} from "@/lib/saved-meals";
import type { AppTab } from "@/components/meal-planner/app-tab";
import {
  SSR_DEFAULT_APP_TAB,
} from "@/components/meal-planner/app-tab";
import type { IngredientPickMode } from "@/components/meal-planner/ingredient-pick-mode";
import type { FlowStep } from "@/components/meal-planner/flow-step";
import { getInitialFlowStep, isWelcomeFlowStep } from "@/components/meal-planner/flow-step";
import {
  GPS_UNAVAILABLE_NOTICE,
  isPersistableOnboardingStep,
  previousOnboardingStep,
  remainingSetupStepCount,
  resolveResumeOnboardingStep,
  type OnboardingStep,
  type PersistableOnboardingStep,
} from "@/components/meal-planner/onboarding-step";
import { resolveThemePreference } from "@/lib/resolve-theme";
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

const defaultForm: MealPreferenceForm = {
  zipCode: "",
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
    ...(saved.theme
      ? {
          theme:
            saved.theme === "system"
              ? resolveThemePreference("system")
              : saved.theme,
        }
      : {}),
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
  const [splashVisible, setSplashVisible] = useState(true);
  const [onboardingStep, setOnboardingStep] = useState<OnboardingStep>("choose-location");
  const [gpsRequesting, setGpsRequesting] = useState(false);
  const [gpsNotice, setGpsNotice] = useState<string>();
  const [pendingBrowserLocation, setPendingBrowserLocation] = useState<{
    latitude: number;
    longitude: number;
  }>();
  const splashFinishedRef = useRef(false);
  const [flowStep, setFlowStep] = useState<FlowStep>(() => getInitialFlowStep());
  const [form, setForm] = useState<FormState>(defaultFormState);
  const [preferencesHydrated, setPreferencesHydrated] = useState(false);
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
  const [pantryCoverageState, setPantryCoverageState] = useState<PantryCoverageState>(
    initialPantryCoverageState,
  );
  const [savedMeals, setSavedMeals] = useState<SavedMealSnapshot[]>(() => readSavedMeals());
  const marketSearchRequestRef = useRef(0);
  const rankRequestRef = useRef(0);
  const pantryCoverageRequestRef = useRef(0);
  const geolocationRequestRef = useRef(0);
  const autoMarketSearchAttemptedRef = useRef(false);
  const rankedStoreScopeRef = useRef<string[] | null>(null);
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
    const saved = readSettingsPreferences();
    setForm(hydrateFormFromSettings());
    const complete = isSettingsPreferencesComplete(saved);
    setSettingsComplete(complete);
    if (saved?.theme === "system") {
      const resolved = resolveThemePreference("system");
      setForm((current) => ({ ...current, theme: resolved }));
      writeSettingsPreferences(buildSettingsPreferencesPatch({ theme: resolved }));
    }
    if (!complete) {
      setOnboardingStep(
        resolveResumeOnboardingStep(saved?.onboardingStep, saved?.locationMode),
      );
    }
    setPreferencesHydrated(true);

    if (shouldRestoreHomeSessionSnapshot()) {
      const returnSnapshot = readAppReturnSnapshot();
      const dinners = readHomeSessionSnapshot();
      if (returnSnapshot?.splashFinished) {
        splashFinishedRef.current = true;
        setSplashVisible(false);
        setActiveTab(returnSnapshot.activeTab);
        setFlowStep(returnSnapshot.flowStep);
        if (dinners) {
          setMarketSearchState(dinners.marketSearchState);
          setRecommendationState(dinners.recommendationState);
          setHasAttemptedRanking(true);
        }
        return;
      }
    }

    // First-run: stay on splash until Continue. Returning visitors with setup
    // already saved get a brief splash, then Home (Q7).
    if (!complete) {
      return;
    }

    const reducedMotion =
      typeof window.matchMedia !== "function" ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const delay = reducedMotion ? 0 : 2000;
    const timer = window.setTimeout(() => {
      finishSplash(true);
    }, delay);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (recommendationState.status === "ready") {
      setFlowStep("results");
    }
  }, [recommendationState.status]);

  useEffect(() => {
    if (
      marketSearchState.status !== "ready" ||
      !marketSearchState.market ||
      recommendationState.status !== "ready"
    ) {
      return;
    }

    writeHomeSessionSnapshot({
      flowStep: "results",
      marketSearchState,
      recommendationState,
    });
  }, [marketSearchState, recommendationState]);

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
      pantryCoverageState.suggestedChecklist.map((item) => [
        item.ingredientId,
        item.ingredientName,
      ]),
    );

    return pantryIngredientIds.map((ingredientId) => ({
      ingredientId,
      ingredientName: nameById.get(ingredientId) ?? ingredientId,
      source: pantryItemSources[ingredientId] ?? "suggested",
      recipeCount: pantryCoverageState.suggestedChecklist.find(
        (item) => item.ingredientId === ingredientId,
      )?.recipeCount,
    }));
  }, [
    pantryCoverageState.suggestedChecklist,
    pantryIngredientIds,
    pantryItemSources,
  ]);

  const savedMealIds = useMemo(
    () => new Set(savedMeals.map((meal) => meal.id)),
    [savedMeals],
  );

  useEffect(() => {
    if (!preferencesHydrated) {
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
        ...(isPersistableOnboardingStep(onboardingStep)
          ? { onboardingStep }
          : {}),
      }),
    );
  }, [
    preferencesHydrated,
    form.zipCode,
    form.radiusMiles,
    form.shoppingStyle,
    form.selectedStoreIds,
    form.theme,
    onboardingStep,
  ]);

  useEffect(() => {
    if (!preferencesHydrated || splashVisible) {
      return;
    }

    writeAppReturnSnapshot({
      splashFinished: true,
      activeTab,
      flowStep,
    });
  }, [preferencesHydrated, splashVisible, activeTab, flowStep]);

  useEffect(() => {
    if (!preferencesHydrated) {
      return;
    }

    if (rankedStoreScopeRef.current === null) {
      return;
    }

    if (sameSelectedStoreIds(form.selectedStoreIds, rankedStoreScopeRef.current)) {
      return;
    }

    invalidateRankedResults();
  }, [form.selectedStoreIds, preferencesHydrated]);

  function invalidateRankedResults() {
    rankedStoreScopeRef.current = null;
    rankRequestRef.current += 1;
    setRecommendationState(initialRecommendationState);
    clearHomeSessionDinners();
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
    setPantryCoverageState(initialPantryCoverageState);
    pantryCoverageStatusRef.current = initialPantryCoverageState.status;
    pantryCoverageRateLimitedUntilRef.current = null;
    setIsMapOverlayOpen(false);
    clearHomeSessionSnapshot();
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
        (isWelcomeFlowStep(flowStep) || flowStep === "ingredients")) ||
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

  function finishSplash(
    complete = isSettingsPreferencesComplete(readSettingsPreferences()),
  ) {
    if (splashFinishedRef.current) {
      return;
    }
    splashFinishedRef.current = true;
    setSplashVisible(false);
    if (complete) {
      setActiveTab("home");
      setFlowStep("welcome-budget");
    } else {
      setActiveTab("settings");
    }
  }

  function persistOnboardingStep(
    step: PersistableOnboardingStep,
    extras?: Parameters<typeof buildSettingsPreferencesPatch>[0],
  ) {
    const radiusMiles = Number(form.radiusMiles);
    writeSettingsPreferences(
      buildSettingsPreferencesPatch({
        ...(form.zipCode.trim() ? { zipCode: form.zipCode.trim() } : {}),
        ...(Number.isFinite(radiusMiles) ? { radiusMiles } : {}),
        shoppingStyle: form.shoppingStyle,
        selectedStoreIds: canonicalizeStoreIdsForSettings(form.selectedStoreIds),
        theme: form.theme === "system" ? resolveThemePreference("system") : form.theme,
        onboardingStep: step,
        ...extras,
      }),
    );
  }

  function goToOnboardingStep(
    step: PersistableOnboardingStep,
    extras?: Parameters<typeof buildSettingsPreferencesPatch>[0],
  ) {
    setOnboardingStep(step);
    persistOnboardingStep(step, extras);
  }

  function handleTabChange(tab: AppTab) {
    setActiveTab(tab);

    if (tab === "cook" && cookEnabled) {
      setFlowStep("results");
    }

    if (tab === "settings" && settingsComplete) {
      goToOnboardingStep("choose-location");
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
  }

  function handleBrowserLocationSearch() {
    setSettingsSaveError(undefined);
    setGpsNotice(undefined);
    setLocationValidationMode("browser");
    setHasAttemptedLocationSearch(true);
    geolocationRequestRef.current += 1;

    if (!("geolocation" in navigator)) {
      setGpsRequesting(false);
      setGpsNotice(GPS_UNAVAILABLE_NOTICE);
      goToOnboardingStep("zip-input");
      return;
    }

    setGpsRequesting(true);

    const geolocationRequestId = ++geolocationRequestRef.current;

    navigator.geolocation.getCurrentPosition(
      (position) => {
        if (geolocationRequestId !== geolocationRequestRef.current) {
          return;
        }

        const coords = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        };
        setGpsRequesting(false);
        setPendingBrowserLocation(coords);
        setActiveLocationRequest({
          mode: "browser",
          latitude: coords.latitude,
          longitude: coords.longitude,
        });
        goToOnboardingStep("radius", { locationMode: "geolocation" });
      },
      () => {
        if (geolocationRequestId !== geolocationRequestRef.current) {
          return;
        }

        setGpsRequesting(false);
        setGpsNotice(GPS_UNAVAILABLE_NOTICE);
        goToOnboardingStep("zip-input");
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
    setFlowStep("welcome-budget");
  }

  function handleFactoryReset() {
    clearSettingsPreferences();
    clearAllZipSearchCenters();
    clearSavedMeals();
    clearHomeSessionSnapshot();
    setSavedMeals([]);
    resetLocationDependentState();
    setForm(defaultFormState);
    setSettingsSaveError(undefined);
    setZipCenterCancelNotice(undefined);
    setHasAttemptedLocationSearch(false);
    setHasAttemptedWelcome(false);
    setHasAttemptedRanking(false);
    setLocationValidationMode("zip");
    setSettingsComplete(false);
    setSplashVisible(true);
    splashFinishedRef.current = false;
    setOnboardingStep("choose-location");
    setGpsRequesting(false);
    setGpsNotice(undefined);
    setPendingBrowserLocation(undefined);
    setActiveTab("settings");
    setFlowStep("welcome-budget");
  }

  function handleCompleteWelcome() {
    setHasAttemptedWelcome(true);
    if (Object.keys(validateMealFields(form)).length > 0) {
      return;
    }

    invalidateRankedResults();
    setFlowStep("welcome-dietary");
    setIngredientPickMode("unset");
    setSelectedIngredientIds([]);
  }

  function handleCompleteDietary() {
    setHasAttemptedWelcome(true);
    if (Object.keys(validateMealFields(form)).length > 0) {
      return;
    }

    invalidateRankedResults();
    setFlowStep("ingredients");
    setIngredientPickMode("unset");
    setSelectedIngredientIds([]);
  }

  function handleEnterZipPath() {
    setGpsRequesting(false);
    geolocationRequestRef.current += 1;
    setLocationValidationMode("zip");
    goToOnboardingStep("zip-input", { locationMode: "zip" });
  }

  function handleZipInputContinue() {
    setHasAttemptedLocationSearch(true);
    setLocationValidationMode("zip");
    if (Object.keys(validateLocationFields(form, true)).length > 0) {
      return;
    }
    goToOnboardingStep("zip-pin", { locationMode: "zip" });
  }

  function handleZipPinCommit(center: { latitude: number; longitude: number }) {
    const zipCode = form.zipCode.trim();
    writeZipSearchCenter(zipCode, center);
    setLocationValidationMode("zip");
    setHasAttemptedLocationSearch(true);
    goToOnboardingStep("radius", { locationMode: "zip", zipCode });
  }

  function startMarketSearchForCurrentLocation() {
    const radiusMiles = Number(form.radiusMiles);
    if (!Number.isFinite(radiusMiles)) {
      return;
    }

    const browserCoords =
      pendingBrowserLocation ??
      (activeLocationRequest?.mode === "browser"
        ? {
            latitude: activeLocationRequest.latitude,
            longitude: activeLocationRequest.longitude,
          }
        : undefined);

    if (locationValidationMode === "browser" || browserCoords) {
      if (browserCoords) {
        void runMarketSearch(
          {
            zipCode: "",
            radiusMiles,
            latitude: browserCoords.latitude,
            longitude: browserCoords.longitude,
          },
          {
            mode: "browser",
            latitude: browserCoords.latitude,
            longitude: browserCoords.longitude,
          },
        );
        return;
      }

      if (!("geolocation" in navigator)) {
        setGpsNotice(GPS_UNAVAILABLE_NOTICE);
        goToOnboardingStep("zip-input");
        return;
      }

      const geolocationRequestId = ++geolocationRequestRef.current;
      navigator.geolocation.getCurrentPosition(
        (position) => {
          if (geolocationRequestId !== geolocationRequestRef.current) {
            return;
          }
          void runMarketSearch(
            {
              zipCode: "",
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
          setGpsNotice(GPS_UNAVAILABLE_NOTICE);
          goToOnboardingStep("zip-input");
        },
      );
      return;
    }

    const zipCode = form.zipCode.trim();
    const cachedCenter = readZipSearchCenter(zipCode);
    if (!cachedCenter) {
      goToOnboardingStep("zip-pin");
      return;
    }
    runZipMarketSearch(zipCode, radiusMiles, cachedCenter);
  }

  function handleRadiusContinue() {
    setHasAttemptedLocationSearch(true);
    if (Object.keys(validateLocationFields(form, locationValidationMode === "zip")).length > 0) {
      return;
    }
    goToOnboardingStep("shopping-style");
    startMarketSearchForCurrentLocation();
  }

  function handleShoppingStyleContinue() {
    goToOnboardingStep("stores");
  }

  function handleShoppingStyleChange(shoppingStyle: FormState["shoppingStyle"]) {
    const selectable = filterSettingsSelectableStores(market?.nearbyStores ?? []);
    setForm((current) => ({
      ...current,
      shoppingStyle,
      selectedStoreIds: defaultSelectedStoreIdsForSettings(selectable, shoppingStyle),
    }));
  }

  function handleStoreSelectionChange(
    shoppingStyle: FormState["shoppingStyle"],
    selectedStoreIds: string[],
  ) {
    setForm((current) => ({
      ...current,
      shoppingStyle,
      selectedStoreIds,
    }));
  }

  function handleWizardBack() {
    geolocationRequestRef.current += 1;
    setGpsRequesting(false);
    const locationMode =
      locationValidationMode === "browser" ? "geolocation" : "zip";
    const previous = previousOnboardingStep(onboardingStep, locationMode);
    if (previous && isPersistableOnboardingStep(previous)) {
      goToOnboardingStep(previous);
    }
  }

  function handleToggleTheme() {
    const resolved = resolveThemePreference(form.theme);
    const next = resolved === "light" ? "dark" : "light";
    setForm((current) => ({ ...current, theme: next }));
    writeSettingsPreferences(buildSettingsPreferencesPatch({ theme: next }));
  }

  function handleDismissSplash() {
    const complete = isSettingsPreferencesComplete(readSettingsPreferences());
    splashFinishedRef.current = true;
    setSplashVisible(false);
    if (complete) {
      setActiveTab("home");
      setFlowStep("welcome-budget");
    } else {
      setActiveTab("settings");
    }
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

        setPantryCoverageState((current) => ({
          status: "ready",
          suggestedChecklist:
            current.status === "ready" && current.suggestedChecklist.length > 0
              ? mergeSuggestedPantryChecklist(
                  current.suggestedChecklist,
                  result.suggestedChecklist,
                )
              : result.suggestedChecklist,
          fullyCoveredRecipeCount: result.fullyCoveredRecipeCount,
          eligibleRecipeCount: result.eligibleRecipeCount,
        }));
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
        skipLoadingState: pantryCoverageStatusRef.current !== "idle",
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

  function handleRemovePantryIngredient(ingredientId: string) {
    setPantryIngredientIds((current) => current.filter((id) => id !== ingredientId));
    setPantryItemSources((current) => {
      const next = { ...current };
      delete next[ingredientId];
      return next;
    });
  }

  function handleToggleSaveMeal(meal: MealRecommendation) {
    setSavedMeals((current) => {
      const next = toggleSavedMeal(current, meal);
      writeSavedMeals(next);
      return next;
    });
  }

  function handleRemoveSavedMeal(mealId: string) {
    setSavedMeals((current) => {
      const next = current.filter((meal) => meal.id !== mealId);
      writeSavedMeals(next);
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
    savedMeals,
    savedMealIds,
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
    handleRemovePantryIngredient,
    handleToggleSaveMeal,
    handleRemoveSavedMeal,
    handleOpenMapOverlay,
    handleCloseMapOverlay,
    splashVisible,
    onboardingStep,
    gpsRequesting,
    gpsNotice,
    remainingSetupSteps: remainingSetupStepCount(onboardingStep, settingsComplete),
    handleDismissSplash,
    handleWizardBack,
    handleToggleTheme,
    handleEnterZipPath,
    handleZipInputContinue,
    handleZipPinCommit,
    handleRadiusContinue,
    handleShoppingStyleContinue,
    handleShoppingStyleChange,
    handleStoreSelectionChange,
    handleCompleteDietary,
    locationValidationMode,
    handleWelcomeBudgetBack: () => {
      setFlowStep("welcome-budget");
    },
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
