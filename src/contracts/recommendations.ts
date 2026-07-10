import { z } from "zod";
import type {
  CatalogRecipeRecord,
  CatalogStore,
} from "@/lib/market-catalog-types";
import type { ResolvedSearchLocation } from "@/lib/location-resolution";
import type { MarketDataSource } from "@/lib/market-repository";
import type { SaleConfidence } from "@/lib/sale-confidence";
import type {
  ProviderRolloutEntry,
  ProviderRolloutStatus,
  StoreChain,
} from "@/lib/provider-rollout";
import type { ProviderCoverageRollup } from "@/lib/provider-coverage-rollup";
import type { ProviderPromotionReadiness } from "@/lib/provider-promotion-readiness";
import type { RecipeProviderPreviewComparison } from "@/lib/seed-vs-provider-recipe-comparison";
import type { ProviderPriceObservationSyncSummary } from "@/lib/provider-price-observation-sync";
import type { WeeklyAdIngestionStatusSummary } from "@/lib/weekly-ad-ingestion/weekly-ad-ingestion-types";
import type { WeeklyAdPromotionReadiness } from "@/lib/weekly-ad-ingestion/weekly-ad-promotion-readiness";
import type {
  ProviderPricingPreviewResult,
  ProviderStoreSearchResult,
} from "@/lib/providers/provider-types";
import type { SaleIngredientChoice } from "@/lib/sale-ingredient-offers";
import type { StoreMapLocationProvenance } from "@/lib/store-map-location-copy";
import type { RecipeSourceSelection } from "@/lib/recipe-sources/recipe-source-types";
import {
  getDefaultRecipeSource,
  listSelectableRecipeSources,
} from "@/lib/recipe-sources/recipe-source-registry";
import {
  DEFAULT_MAX_INGREDIENTS,
  DEFAULT_PLANNING_MODE,
} from "@/lib/meal-preference-defaults";
import { parseLocationRequestFields } from "@/contracts/shared/location";
import { radiusMilesSchema } from "@/contracts/shared/location";
import {
  apiBudgetSchema,
  dietaryFocusSchema,
  maxIngredientsSchema,
  mealPlanningModeSchema,
  parsePantryIngredientIds,
  parseSelectedIngredientIds,
  parseSelectedStoreIds,
  shoppingStyleSchema,
  validateSelectedStoreIdsForShoppingStyle,
} from "@/contracts/shared/meal-preferences";

export type MealPlanningMode = z.infer<typeof mealPlanningModeSchema>;

export type MealPreferenceForm = {
  zipCode: string;
  radiusMiles: number;
  budget: number;
  maxIngredients: number;
  shoppingStyle: z.infer<typeof shoppingStyleSchema>;
  dietaryFocus: z.infer<typeof dietaryFocusSchema>;
  recipeSource: RecipeSourceSelection;
  planningMode?: MealPlanningMode;
  selectedStoreIds: string[];
  selectedIngredientIds?: string[];
  pantryIngredientIds?: string[];
};

export type RecipeDifficulty = "easy" | "medium";

export type NearbyStoreSummary = {
  id: string;
  name: string;
  city?: string;
  state?: string;
  kind: CatalogStore["kind"];
  latitude: number;
  longitude: number;
  distanceMiles: number;
  chain: StoreChain;
  chainLabel: string;
  rolloutStatus: ProviderRolloutStatus;
  recommendationEnabled: boolean;
  rolloutNote: string;
  /** Dinner-tracked ingredients with a fresh ranked price at this store. */
  matchedIngredientCount: number;
  /** Denominator for coverage ratios (dinner-tracked catalog size). */
  totalTrackedIngredientCount: number;
  /** Primary ranked price source for shopper honesty copy. */
  pricingSourceKind: "official-online" | "weekly-ad" | "none";
  sourceName?: string;
  sourceStoreId?: string;
  lastVerifiedAt?: string;
  locationProvenance: StoreMapLocationProvenance;
  locationBadge: string;
  locationNote: string;
};

export type MarketSummary = {
  searchedZipCode?: string;
  locationLabel: string;
  searchLatitude: number;
  searchLongitude: number;
  radiusMiles: number;
  nearbyStores: NearbyStoreSummary[];
  recommendationReadyStoreCount: number;
  providerRollout: ProviderRolloutEntry[];
  providerStoreSearches: ProviderStoreSearchResult[];
  providerPricingPreviews: ProviderPricingPreviewResult[];
  providerCoverageRollup: ProviderCoverageRollup;
  providerPromotionReadiness: ProviderPromotionReadiness[];
  providerPriceObservationSync: ProviderPriceObservationSyncSummary[];
  weeklyAdIngestionStatus: WeeklyAdIngestionStatusSummary[];
  weeklyAdPromotionReadiness: WeeklyAdPromotionReadiness[];
  lookupSource: ResolvedSearchLocation["source"];
  lookupProviderConfigured: boolean;
  dataSource: MarketDataSource;
  /** Sale/API/scrape ingredient rows near the search point for optional shopper selection. */
  saleIngredientChoices: SaleIngredientChoice[];
  /** Honest notice when search-time OSM discovery is degraded, sparse, or ephemeral. */
  mapDiscoveryNotice?: string;
  /** True when any visible pin came from ephemeral search-time OSM merge (not Postgres). */
  usesEphemeralOsmDiscovery?: boolean;
  /**
   * Retired for shopper UI (TRUST-06). Structured fields above replace the old
   * concatenated blob. Omitted from public API responses.
   */
  message?: string;
};

export type ShopperNotice = {
  title: string;
  body: string;
};

export type ShoppingPlanItem = {
  ingredientId: string;
  ingredient: string;
  quantityNote: string;
  sourcedFromPantry: boolean;
  storeName?: string;
  price: number;
  pantryNote?: string;
  freshnessDaysAgo?: number;
  freshnessHoursAgo?: number;
  saleLabel?: string;
  priceSource?: string;
  priceSourceKind?: "official-online" | "weekly-ad" | "sample" | "unknown";
  priceSourceTier?: number;
  matchConfidence?: number;
  saleConfidence: import("@/lib/sale-confidence").SaleConfidence;
};

export type StorePlan = {
  storeName: string;
  subtotal: number;
  itemCount: number;
};

export type ScoreBreakdown = {
  total: number;
  price: number;
  convenience: number;
  freshness: number;
  fit: number;
};

export type MealRecommendation = {
  title: string;
  summary: string;
  estimatedTotal: number;
  storeCount: number;
  matchedIngredients: number;
  cookTimeMinutes: number;
  difficulty: RecipeDifficulty;
  primaryStore: string;
  ingredientHighlights: string[];
  instructions: string[];
  shoppingPlan: ShoppingPlanItem[];
  storePlan: StorePlan[];
  score: ScoreBreakdown;
  confidenceLabel: string;
  tags: string[];
  freshnessLabel: string;
  explanation: string;
  providerPreviewComparisons: RecipeProviderPreviewComparison[];
  recipeAttribution?: string;
  recipeAttributionUrl?: string;
};

export type RecommendationExperience = {
  market: MarketSummary;
  recommendations: MealRecommendation[];
  /** Primary layman notice for the main UI (e.g. inactive recipe source). */
  shopperNotice?: ShopperNotice;
  /** Additional notices shown alongside the primary (C1 — never replace empty-meal copy). */
  supplementaryShopperNotices?: ShopperNotice[];
  /** Server-normalized store IDs when client selection was stale or collocated twins collapsed. */
  effectiveSelectedStoreIds?: string[];
};

/** Internal ranking candidate before presentation formatting. */
export type RecommendationCandidate = {
  recipe: CatalogRecipeRecord;
  shoppingPlan: ShoppingPlanItem[];
  estimatedTotal: number;
  score: ScoreBreakdown;
  freshnessLabel: string;
  confidenceLabel: string;
};

export class RecommendationDependencyUnavailableError extends Error {
  constructor(
    message = "Store and meal prices are not loading right now. Try again shortly.",
  ) {
    super(message);
    this.name = "RecommendationDependencyUnavailableError";
  }
}

/**
 * Pass-through only: full market snapshot shape is validated in
 * `market-pass-through.ts`, not here — avoids token-style indirection.
 */
export type RecommendationRequestBody = MealPreferenceForm & {
  latitude?: number;
  longitude?: number;
  market?: unknown;
};

function resolveRecipeSource(value: unknown): RecipeSourceSelection | undefined {
  if (value === undefined || value === null || value === "") {
    return getDefaultRecipeSource();
  }

  if (typeof value !== "string") {
    return undefined;
  }

  const allowed = listSelectableRecipeSources().map((source) => source.id);
  if (!allowed.includes(value as RecipeSourceSelection)) {
    return undefined;
  }

  return value as RecipeSourceSelection;
}

export function parseRecommendationRequest(
  body: unknown,
): RecommendationRequestBody | undefined {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return undefined;
  }

  const record = body as Record<string, unknown>;
  const location = parseLocationRequestFields(record);
  if (!location) {
    return undefined;
  }

  const radiusResult = radiusMilesSchema.safeParse(record.radiusMiles);
  const budgetResult = apiBudgetSchema.safeParse(record.budget);
  const shoppingStyleResult = shoppingStyleSchema.safeParse(record.shoppingStyle);
  const dietaryFocusResult = dietaryFocusSchema.safeParse(record.dietaryFocus);

  if (
    !radiusResult.success ||
    !budgetResult.success ||
    !shoppingStyleResult.success ||
    !dietaryFocusResult.success
  ) {
    return undefined;
  }

  const planningModeRaw = record.planningMode;
  const planningModeResult =
    planningModeRaw === undefined || planningModeRaw === null
      ? { success: true as const, data: undefined }
      : mealPlanningModeSchema.safeParse(planningModeRaw);

  if (!planningModeResult.success) {
    return undefined;
  }

  const maxIngredientsResult =
    record.maxIngredients === undefined || record.maxIngredients === null
      ? { success: true as const, data: DEFAULT_MAX_INGREDIENTS }
      : maxIngredientsSchema.safeParse(record.maxIngredients);

  if (!maxIngredientsResult.success) {
    return undefined;
  }

  const recipeSource = resolveRecipeSource(record.recipeSource);
  const selectedIngredientIds = parseSelectedIngredientIds(
    record.selectedIngredientIds,
  );
  let pantryIngredientIds: string[] | undefined;
  if (record.pantryIngredientIds !== undefined && record.pantryIngredientIds !== null) {
    const parsedPantryIngredientIds = parsePantryIngredientIds(record.pantryIngredientIds);
    if (parsedPantryIngredientIds === undefined) {
      return undefined;
    }
    pantryIngredientIds = parsedPantryIngredientIds;
  }
  const selectedStoreIds = parseSelectedStoreIds(record.selectedStoreIds);

  if (
    !recipeSource ||
    recipeSource !== "internal-library" ||
    selectedIngredientIds === undefined ||
    !selectedStoreIds ||
    !validateSelectedStoreIdsForShoppingStyle(
      selectedStoreIds,
      shoppingStyleResult.data,
    )
  ) {
    return undefined;
  }

  const resolvedPlanningMode =
    planningModeResult.data === "standard"
      ? "standard"
      : DEFAULT_PLANNING_MODE;

  const preferences: MealPreferenceForm = {
    zipCode: location.zipCode,
    radiusMiles: radiusResult.data,
    budget: budgetResult.data,
    maxIngredients: maxIngredientsResult.data,
    shoppingStyle: shoppingStyleResult.data,
    dietaryFocus: dietaryFocusResult.data,
    recipeSource,
    selectedStoreIds,
    planningMode: resolvedPlanningMode,
    ...(selectedIngredientIds && selectedIngredientIds.length > 0
      ? { selectedIngredientIds }
      : {}),
    ...(pantryIngredientIds && pantryIngredientIds.length > 0
      ? { pantryIngredientIds }
      : {}),
  };

  return {
    ...preferences,
    ...(location.latitude !== undefined && location.longitude !== undefined
      ? { latitude: location.latitude, longitude: location.longitude }
      : {}),
    ...(record.market !== undefined ? { market: record.market } : {}),
  };
}
