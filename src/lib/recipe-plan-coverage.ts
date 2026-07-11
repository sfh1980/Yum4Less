import type {
  CatalogPriceObservation,
  CatalogRecipeRecord,
} from "@/lib/market-catalog-types";
import type { CatalogIngredient } from "@/lib/ingredient-category";
import { INTERNAL_CATALOG_INGREDIENTS } from "@/lib/internal-catalog";
import type { NearbyStoreSummary } from "@/lib/recommendation-types";

export type RecipePlanCoverageContext = {
  stores: NearbyStoreSummary[];
  observations: CatalogPriceObservation[];
  shoppingStyle: "single-store" | "multi-store";
  pantryIngredientIds?: ReadonlySet<string>;
  /**
   * Expand-aware observation join for single-store coverage. Omit → exact-id.
   */
  equivalentStoreIdsByStoreId?: ReadonlyMap<string, ReadonlySet<string>>;
};

export type MissingIngredientLine = {
  ingredientId: string;
  displayName: string;
};

export type RecipePlanCoverageResult = {
  recipeId: string;
  isFullyCovered: boolean;
  missingLineCount: number;
  missingLines: MissingIngredientLine[];
};

export type SuggestedPantryChecklistItem = {
  ingredientId: string;
  ingredientName: string;
  category?: string;
  recipeCount: number;
};

const NEAR_MISS_MIN_MISSING = 1;
const NEAR_MISS_MAX_MISSING = 4;

const internalCatalogById = new Map(
  INTERNAL_CATALOG_INGREDIENTS.map((ingredient) => [ingredient.id, ingredient]),
);

export function buildCatalogIdSet(catalog: CatalogIngredient[]): ReadonlySet<string> {
  return new Set(catalog.map((ingredient) => ingredient.id));
}

export function buildCatalogById(
  catalog: CatalogIngredient[],
): ReadonlyMap<string, CatalogIngredient> {
  return new Map(catalog.map((ingredient) => [ingredient.id, ingredient]));
}

function resolvePantrySet(pantryIngredientIds?: ReadonlySet<string>): ReadonlySet<string> {
  return pantryIngredientIds ?? new Set<string>();
}

function hasInStockObservation(
  storeId: string,
  ingredientId: string,
  observations: CatalogPriceObservation[],
  equivalentStoreIds?: ReadonlySet<string>,
): boolean {
  const allowed = equivalentStoreIds ?? new Set([storeId]);
  return observations.some(
    (observation) =>
      allowed.has(observation.storeId) &&
      observation.ingredientId === ingredientId &&
      observation.inStock,
  );
}

function isLineSatisfied(
  ingredientId: string,
  storeId: string | undefined,
  observations: CatalogPriceObservation[],
  pantryIds: ReadonlySet<string>,
  shoppingStyle: RecipePlanCoverageContext["shoppingStyle"],
  equivalentStoreIds?: ReadonlySet<string>,
): boolean {
  if (pantryIds.has(ingredientId)) {
    return true;
  }

  if (shoppingStyle === "single-store") {
    return (
      storeId !== undefined &&
      hasInStockObservation(storeId, ingredientId, observations, equivalentStoreIds)
    );
  }

  return observations.some(
    (observation) =>
      observation.ingredientId === ingredientId && observation.inStock,
  );
}

function toMissingLine(
  ingredientId: string,
  displayName: string,
): MissingIngredientLine {
  return { ingredientId, displayName };
}

export function assessRecipePlanCoverage(
  recipe: CatalogRecipeRecord,
  context: RecipePlanCoverageContext,
): RecipePlanCoverageResult {
  const pantryIds = resolvePantrySet(context.pantryIngredientIds);

  if (context.shoppingStyle === "multi-store") {
    const missingLines = recipe.ingredients
      .filter(
        (ingredient) =>
          !isLineSatisfied(
            ingredient.ingredientId,
            undefined,
            context.observations,
            pantryIds,
            "multi-store",
          ),
      )
      .map((ingredient) =>
        toMissingLine(ingredient.ingredientId, ingredient.displayName),
      );

    return {
      recipeId: recipe.id,
      isFullyCovered: missingLines.length === 0,
      missingLineCount: missingLines.length,
      missingLines,
    };
  }

  let bestMissingLines: MissingIngredientLine[] = recipe.ingredients.map((ingredient) =>
    toMissingLine(ingredient.ingredientId, ingredient.displayName),
  );

  for (const store of context.stores) {
    const equivalentIds = context.equivalentStoreIdsByStoreId?.get(store.id);
    const missingLines = recipe.ingredients
      .filter(
        (ingredient) =>
          !isLineSatisfied(
            ingredient.ingredientId,
            store.id,
            context.observations,
            pantryIds,
            "single-store",
            equivalentIds,
          ),
      )
      .map((ingredient) =>
        toMissingLine(ingredient.ingredientId, ingredient.displayName),
      );

    if (missingLines.length < bestMissingLines.length) {
      bestMissingLines = missingLines;
    }

    if (bestMissingLines.length === 0) {
      break;
    }
  }

  return {
    recipeId: recipe.id,
    isFullyCovered: bestMissingLines.length === 0,
    missingLineCount: bestMissingLines.length,
    missingLines: bestMissingLines,
  };
}

export function assessRecipePoolCoverage(
  recipes: CatalogRecipeRecord[],
  context: RecipePlanCoverageContext,
): RecipePlanCoverageResult[] {
  return recipes.map((recipe) => assessRecipePlanCoverage(recipe, context));
}

export function countFullyCoveredRecipes(
  assessments: RecipePlanCoverageResult[],
): number {
  return assessments.filter((assessment) => assessment.isFullyCovered).length;
}

export function isNearMissCoverage(assessment: RecipePlanCoverageResult): boolean {
  return (
    assessment.missingLineCount >= NEAR_MISS_MIN_MISSING &&
    assessment.missingLineCount <= NEAR_MISS_MAX_MISSING
  );
}

export function buildSuggestedPantryChecklist(
  assessments: RecipePlanCoverageResult[],
  catalogById: ReadonlyMap<string, CatalogIngredient> = internalCatalogById,
): SuggestedPantryChecklistItem[] {
  const recipeCountByIngredientId = new Map<string, number>();
  const displayNameByIngredientId = new Map<string, string>();

  for (const assessment of assessments) {
    if (!isNearMissCoverage(assessment)) {
      continue;
    }

    for (const line of assessment.missingLines) {
      recipeCountByIngredientId.set(
        line.ingredientId,
        (recipeCountByIngredientId.get(line.ingredientId) ?? 0) + 1,
      );
      if (!displayNameByIngredientId.has(line.ingredientId)) {
        displayNameByIngredientId.set(line.ingredientId, line.displayName);
      }
    }
  }

  return [...recipeCountByIngredientId.entries()]
    .map(([ingredientId, recipeCount]) => {
      const catalogRow = catalogById.get(ingredientId);
      return {
        ingredientId,
        ingredientName:
          catalogRow?.name ??
          displayNameByIngredientId.get(ingredientId) ??
          ingredientId,
        ...(catalogRow?.category ? { category: catalogRow.category } : {}),
        recipeCount,
      };
    })
    .sort((left, right) => {
      const byCount = right.recipeCount - left.recipeCount;
      if (byCount !== 0) {
        return byCount;
      }
      return left.ingredientName.localeCompare(right.ingredientName);
    });
}

export function buildIngredientCatalogForClient(
  catalog: CatalogIngredient[],
): CatalogIngredient[] {
  return catalog.map((ingredient) => ({ ...ingredient }));
}

export function filterValidPantryIngredientIds(
  ids: string[],
  validIds: ReadonlySet<string>,
): string[] {
  const seen = new Set<string>();
  const valid: string[] = [];

  for (const id of ids) {
    if (!validIds.has(id) || seen.has(id)) {
      continue;
    }
    seen.add(id);
    valid.push(id);
  }

  return valid;
}
