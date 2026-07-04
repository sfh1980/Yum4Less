import type { CatalogRecipeRecord } from "@/lib/market-catalog-types";
import { getProviderChainLabel } from "@/lib/providers/provider-labels";
import type {
  ProviderPricingPreviewResult,
  StoreDiscoveryProvider,
} from "@/lib/providers/provider-types";

type SeedShoppingPlanItem = {
  ingredient: string;
  quantityNote: string;
  storeName: string;
  price: number;
  freshnessDaysAgo: number;
  saleLabel?: string;
};

export type RecipeProviderComparisonStatus = "unavailable" | "partial" | "full";

export type RecipeIngredientPriceComparison = {
  ingredientId: string;
  ingredientName: string;
  seedPrice: number;
  providerPrice?: number;
  priceDelta?: number;
  matched: boolean;
};

export type RecipeProviderPreviewComparison = {
  provider: StoreDiscoveryProvider;
  providerLabel: string;
  recipeId: string;
  recipeTitle: string;
  seedEstimatedTotal: number;
  seedComparedSubtotal: number;
  providerPreviewSubtotal: number | null;
  comparedIngredientCount: number;
  totalRecipeIngredients: number;
  priceDelta: number | null;
  comparisonStatus: RecipeProviderComparisonStatus;
  directionalLabel: string;
  message: string;
  ingredients: RecipeIngredientPriceComparison[];
};

export function buildRecipeProviderPreviewComparisons(input: {
  recipe: CatalogRecipeRecord;
  seedEstimatedTotal: number;
  shoppingPlan: SeedShoppingPlanItem[];
  providerPricingPreviews: ProviderPricingPreviewResult[];
}): RecipeProviderPreviewComparison[] {
  return input.providerPricingPreviews.map((providerPricingPreview) =>
    buildRecipeProviderPreviewComparison({
      recipe: input.recipe,
      seedEstimatedTotal: input.seedEstimatedTotal,
      shoppingPlan: input.shoppingPlan,
      providerPricingPreview,
    }),
  );
}

export function buildRecipeProviderPreviewComparison(input: {
  recipe: CatalogRecipeRecord;
  seedEstimatedTotal: number;
  shoppingPlan: SeedShoppingPlanItem[];
  providerPricingPreview: ProviderPricingPreviewResult;
}): RecipeProviderPreviewComparison {
  const providerLabel = getProviderChainLabel(input.providerPricingPreview.provider);
  const previewItemsByIngredientId = new Map(
    input.providerPricingPreview.items.map((item) => [item.ingredientId, item]),
  );

  const ingredients = input.recipe.ingredients.map((recipeIngredient) => {
    const seedItem = findSeedShoppingItem(
      input.shoppingPlan,
      recipeIngredient.ingredientId,
      recipeIngredient.displayName,
    );
    const previewItem = previewItemsByIngredientId.get(recipeIngredient.ingredientId);
    const seedPrice = seedItem?.price ?? 0;
    const providerPrice = getProviderUnitPrice(previewItem);

    return {
      ingredientId: recipeIngredient.ingredientId,
      ingredientName: recipeIngredient.displayName,
      seedPrice,
      providerPrice,
      priceDelta:
        providerPrice !== undefined
          ? roundCurrency(providerPrice - seedPrice)
          : undefined,
      matched: providerPrice !== undefined,
    };
  });

  const matchedIngredients = ingredients.filter((ingredient) => ingredient.matched);
  const comparedIngredientCount = matchedIngredients.length;
  const totalRecipeIngredients = ingredients.length;
  const seedComparedSubtotal = roundCurrency(
    matchedIngredients.reduce((sum, ingredient) => sum + ingredient.seedPrice, 0),
  );
  const providerPreviewSubtotal =
    comparedIngredientCount > 0
      ? roundCurrency(
          matchedIngredients.reduce(
            (sum, ingredient) => sum + (ingredient.providerPrice ?? 0),
            0,
          ),
        )
      : null;
  const priceDelta =
    providerPreviewSubtotal !== null
      ? roundCurrency(providerPreviewSubtotal - seedComparedSubtotal)
      : null;
  const comparisonStatus = getComparisonStatus(
    comparedIngredientCount,
    totalRecipeIngredients,
  );

  return {
    provider: input.providerPricingPreview.provider,
    providerLabel,
    recipeId: input.recipe.id,
    recipeTitle: input.recipe.title,
    seedEstimatedTotal: input.seedEstimatedTotal,
    seedComparedSubtotal,
    providerPreviewSubtotal,
    comparedIngredientCount,
    totalRecipeIngredients,
    priceDelta,
    comparisonStatus,
    directionalLabel: buildDirectionalLabel(priceDelta, comparisonStatus),
    message: buildComparisonMessage({
      comparedIngredientCount,
      totalRecipeIngredients,
      comparisonStatus,
      priceDelta,
      seedComparedSubtotal,
      providerPreviewSubtotal,
    }),
    ingredients,
  };
}

function findSeedShoppingItem(
  shoppingPlan: SeedShoppingPlanItem[],
  ingredientId: string,
  displayName: string,
) {
  const normalizedDisplayName = displayName.toLowerCase();

  return shoppingPlan.find((item) => {
    const normalizedIngredient = item.ingredient.toLowerCase();
    return (
      normalizedIngredient === normalizedDisplayName ||
      normalizedIngredient.includes(ingredientId.replace(/-/g, " ")) ||
      normalizedDisplayName.includes(normalizedIngredient) ||
      normalizedIngredient.includes(normalizedDisplayName.split(" ")[0] ?? "")
    );
  });
}

function getProviderUnitPrice(
  previewItem:
    | {
        promoPrice?: number;
        regularPrice?: number;
      }
    | undefined,
) {
  if (!previewItem) {
    return undefined;
  }

  if (typeof previewItem.promoPrice === "number") {
    return previewItem.promoPrice;
  }

  if (typeof previewItem.regularPrice === "number") {
    return previewItem.regularPrice;
  }

  return undefined;
}

function getComparisonStatus(
  comparedIngredientCount: number,
  totalRecipeIngredients: number,
): RecipeProviderComparisonStatus {
  if (comparedIngredientCount <= 0) {
    return "unavailable";
  }

  if (comparedIngredientCount >= totalRecipeIngredients) {
    return "full";
  }

  return "partial";
}

function buildDirectionalLabel(
  priceDelta: number | null,
  comparisonStatus: RecipeProviderComparisonStatus,
) {
  if (comparisonStatus === "unavailable") {
    return "No side-by-side price check yet";
  }

  if (priceDelta === null) {
    return "Side-by-side price check";
  }

  if (priceDelta <= -0.5) {
    return "Online check looks lower for these ingredients";
  }

  if (priceDelta >= 0.5) {
    return "Online check looks higher for these ingredients";
  }

  return "Online check looks similar for these ingredients";
}

function buildComparisonMessage(input: {
  comparedIngredientCount: number;
  totalRecipeIngredients: number;
  comparisonStatus: RecipeProviderComparisonStatus;
  priceDelta: number | null;
  seedComparedSubtotal: number;
  providerPreviewSubtotal: number | null;
}) {
  if (input.comparisonStatus === "unavailable") {
    return "Not enough overlapping store prices to show a side-by-side check for this recipe yet. Your meal total above still uses saved prices from your selected store(s).";
  }

  const overlapNote = `Compared ${input.comparedIngredientCount} of ${input.totalRecipeIngredients} recipe ingredient(s) using saved prices and a recent online store check.`;
  const deltaNote =
    input.priceDelta !== null && input.providerPreviewSubtotal !== null
      ? ` For those ingredients, saved total is $${input.seedComparedSubtotal.toFixed(2)} versus online check $${input.providerPreviewSubtotal.toFixed(2)} (${formatSignedCurrency(input.priceDelta)}).`
      : "";

  return `${overlapNote}${deltaNote} This note does not change your meal total above.`;
}

function formatSignedCurrency(value: number) {
  if (value > 0) {
    return `+$${value.toFixed(2)}`;
  }

  if (value < 0) {
    return `-$${Math.abs(value).toFixed(2)}`;
  }

  return "$0.00";
}

function roundCurrency(value: number) {
  return Math.round(value * 100) / 100;
}
