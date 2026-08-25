import type { CatalogIngredient } from "@/lib/ingredient-category";
import { MIN_WEEKLY_AD_MATCH_CONFIDENCE } from "@/lib/weekly-ad-ingestion/weekly-ad-ingredient-matching";
import { flyerLineLooksLikeJunk } from "@/lib/weekly-ad-ingestion/weekly-ad-junk-heuristics";
import {
  normalizeWeeklyAdFlyerLabel,
  splitWeeklyAdOrLabels,
} from "@/lib/weekly-ad-ingestion/weekly-ad-label-normalize";
import { resolveCanonicalSimpleFood } from "@/lib/weekly-ad-ingestion/weekly-ad-simple-food";
import { matchWeeklyAdOffers } from "@/lib/weekly-ad-ingestion/weekly-ad-ingredient-matching";
import type { WeeklyAdChain } from "@/lib/weekly-ad-ingestion/weekly-ad-ingestion-types";

export type WeeklyAdMatchCatalogSnapshot = {
  ingredients: CatalogIngredient[];
  skipLabels: Set<string>;
  aliasesByLabel: Map<string, string>;
  extraSearchTermsByIngredientId: Record<string, string[]>;
};

export type WeeklyAdFlyerClassification =
  | { action: "skip"; reason: "skip-table" | "junk"; normalizedLabel: string }
  | {
      action: "match";
      ingredientId: string;
      matchConfidence: number;
      saveAlias: boolean;
      normalizedLabel: string;
    }
  | {
      action: "auto-create";
      ingredient: CatalogIngredient;
      nickname: string;
      normalizedLabel: string;
    }
  | { action: "review"; normalizedLabel: string; rawProductName: string };

export function classifyWeeklyAdFlyerLine(input: {
  productName: string;
  chain: WeeklyAdChain;
  catalog: WeeklyAdMatchCatalogSnapshot;
}): WeeklyAdFlyerClassification[] {
  const rawProductName = input.productName.trim();
  const normalizedLabel = normalizeWeeklyAdFlyerLabel(rawProductName);
  const parts = splitWeeklyAdOrLabels(normalizedLabel);

  return parts.map((part) =>
    classifyOneFlyerPart({
      part,
      rawProductName,
      chain: input.chain,
      catalog: input.catalog,
    }),
  );
}

function classifyOneFlyerPart(input: {
  part: string;
  rawProductName: string;
  chain: WeeklyAdChain;
  catalog: WeeklyAdMatchCatalogSnapshot;
}): WeeklyAdFlyerClassification {
  const normalizedLabel = input.part;

  if (input.catalog.skipLabels.has(normalizedLabel)) {
    return { action: "skip", reason: "skip-table", normalizedLabel };
  }

  const aliasId = input.catalog.aliasesByLabel.get(normalizedLabel);
  if (aliasId) {
    return {
      action: "match",
      ingredientId: aliasId,
      matchConfidence: 0.95,
      saveAlias: false,
      normalizedLabel,
    };
  }

  const scored = matchWeeklyAdOffers({
    chain: input.chain,
    storeId: "classify-probe",
    sourceUrl: "yum4less://classify",
    observedAt: "2026-01-01T00:00:00.000Z",
    rawOffers: [{ productName: normalizedLabel, price: 0 }],
    trackedIngredientIds: input.catalog.ingredients.map((ingredient) => ingredient.id),
    catalogIngredients: input.catalog.ingredients,
    extraSearchTermsByIngredientId: input.catalog.extraSearchTermsByIngredientId,
  })[0];

  if (
    scored?.ingredientId &&
    (scored.matchConfidence ?? 0) >= MIN_WEEKLY_AD_MATCH_CONFIDENCE
  ) {
    return {
      action: "match",
      ingredientId: scored.ingredientId,
      matchConfidence: scored.matchConfidence ?? MIN_WEEKLY_AD_MATCH_CONFIDENCE,
      saveAlias: true,
      normalizedLabel,
    };
  }

  if (flyerLineLooksLikeJunk(input.rawProductName, normalizedLabel)) {
    return { action: "skip", reason: "junk", normalizedLabel };
  }

  const created = resolveCanonicalSimpleFood(normalizedLabel);
  if (created) {
    return {
      action: "auto-create",
      ingredient: created,
      nickname: input.rawProductName,
      normalizedLabel,
    };
  }

  return {
    action: "review",
    normalizedLabel,
    rawProductName: input.rawProductName,
  };
}
