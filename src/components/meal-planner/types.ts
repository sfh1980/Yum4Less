import type {
  MealPreferenceForm,
  RecommendationExperience,
  ShopperNotice,
} from "@/lib/recommendation-service";
import type { RecipeSourceSelection } from "@/lib/recipe-sources/recipe-source-types";
import type { ThemePreference } from "@/lib/settings-preferences";

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
  market?: RecommendationExperience["market"];
};
