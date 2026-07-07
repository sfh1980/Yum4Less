import type { CatalogIngredient } from "@/lib/ingredient-category";
import type { MealPreferenceForm } from "@/lib/recommendation-types";
import {
  parseRecommendationRequest,
  type RecommendationRequestBody,
} from "@/contracts/recommendations";
import { parsePantryIngredientIds } from "@/contracts/shared/meal-preferences";

export type PantryCoverageChecklistItem = {
  ingredientId: string;
  ingredientName: string;
  category?: string;
  recipeCount: number;
};

export type PantryCoverageExperience = {
  suggestedChecklist: PantryCoverageChecklistItem[];
  fullyCoveredRecipeCount: number;
  eligibleRecipeCount: number;
  ingredientCatalog?: CatalogIngredient[];
};

export type PantryCoverageRequestBody = RecommendationRequestBody & {
  pantryIngredientIds?: string[];
  includeIngredientCatalog?: boolean;
};

export function parsePantryCoverageRequest(
  body: unknown,
): PantryCoverageRequestBody | undefined {
  const base = parseRecommendationRequest(body);
  if (!base) {
    return undefined;
  }

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return undefined;
  }

  const record = body as Record<string, unknown>;

  if (
    record.pantryIngredientIds !== undefined &&
    record.pantryIngredientIds !== null
  ) {
    const pantryIngredientIds = parsePantryIngredientIds(record.pantryIngredientIds);
    if (pantryIngredientIds === undefined) {
      return undefined;
    }

    return {
      ...base,
      pantryIngredientIds,
      ...(record.includeIngredientCatalog === true
        ? { includeIngredientCatalog: true }
        : {}),
    };
  }

  return {
    ...base,
    ...(record.includeIngredientCatalog === true
      ? { includeIngredientCatalog: true }
      : {}),
  };
}

export type PantryCoveragePreferences = MealPreferenceForm & {
  pantryIngredientIds: string[];
  includeIngredientCatalog?: boolean;
};
