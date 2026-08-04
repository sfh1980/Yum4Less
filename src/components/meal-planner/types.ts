import type {
  MealPreferenceForm,
  RecommendationExperience,
  ShopperNotice,
} from "@/lib/recommendation-service";
import type { RecipeSourceSelection } from "@/lib/recipe-sources/recipe-source-types";
import type { ThemePreference } from "@/lib/settings-preferences";
import type { CatalogIngredient } from "@/lib/ingredient-category";

export type FormState = {
  zipCode: string;
  radiusMiles: string;
  budget: string;
  shoppingStyle: MealPreferenceForm["shoppingStyle"];
  dietaryFocus: MealPreferenceForm["dietaryFocus"];
  recipeSource: RecipeSourceSelection;
  selectedStoreIds: string[];
  theme: ThemePreference;
};

export type FieldErrors = Partial<Record<keyof FormState, string>>;

export type MarketSearchState = {
  status: "idle" | "loading" | "ready" | "error";
  market?: RecommendationExperience["market"];
  error?: string;
  errorTitle?: string;
  errorHint?: string;
  notice?: string;
  providerConfigured?: boolean;
};

export type RecommendationState = {
  status: "idle" | "loading" | "ready" | "error";
  recommendations?: RecommendationExperience["recommendations"];
  shopperNotice?: ShopperNotice;
  supplementaryShopperNotices?: ShopperNotice[];
  error?: string;
  errorTitle?: string;
  errorHint?: string;
};

export type ActiveLocationRequest =
  | {
      mode: "zip";
      zipCode: string;
      latitude: number;
      longitude: number;
    }
  | {
      mode: "browser";
      latitude: number;
      longitude: number;
    };

export type RecommendationResponse =
  | {
      ok: true;
      experience: RecommendationExperience;
    }
  | {
      ok: false;
      error: string;
      providerConfigured: boolean;
    };

export type MarketSearchResponse =
  | {
      ok: true;
      market: RecommendationExperience["market"];
    }
  | {
      ok: false;
      error: string;
      providerConfigured: boolean;
    };

export type MarketSearchRequest = {
  zipCode: string;
  radiusMiles: number;
  latitude?: number;
  longitude?: number;
};

export type RecommendationRequest = MealPreferenceForm & {
  latitude?: number;
  longitude?: number;
  selectedIngredientIds?: string[];
  pantryIngredientIds?: string[];
  market?: RecommendationExperience["market"];
};

export type PantryCoverageResponse =
  | {
      ok: true;
      suggestedChecklist: Array<{
        ingredientId: string;
        ingredientName: string;
        category?: string;
        recipeCount: number;
      }>;
      fullyCoveredRecipeCount: number;
      eligibleRecipeCount: number;
      ingredientCatalog?: CatalogIngredient[];
    }
  | {
      ok: false;
      error: string;
      providerConfigured?: boolean;
    };

export type PantryCoverageState = {
  status: "idle" | "loading" | "ready" | "error" | "rate-limited";
  suggestedChecklist: NonNullable<
    Extract<PantryCoverageResponse, { ok: true }>["suggestedChecklist"]
  >;
  fullyCoveredRecipeCount: number;
  eligibleRecipeCount: number;
  error?: string;
};
