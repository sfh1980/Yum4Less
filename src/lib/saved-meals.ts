import type { MealRecommendation } from "@/contracts/recommendations";

export const SAVED_MEALS_STORAGE_KEY = "yum4less.saved-meals.v1";
export const MAX_SAVED_MEALS = 40;

export type SavedMealSnapshot = {
  id: string;
  title: string;
  summary: string;
  estimatedTotal: number;
  primaryStore: string;
  cookTimeMinutes: number;
  difficulty: string;
  confidenceLabel: string;
  freshnessLabel: string;
  ingredientHighlights: string[];
  instructions: string[];
  savedAt: string;
};

export function savedMealIdFromRecommendation(
  meal: Pick<MealRecommendation, "title" | "primaryStore">,
): string {
  return `${meal.title.trim().toLowerCase()}::${meal.primaryStore.trim().toLowerCase()}`;
}

export function toSavedMealSnapshot(meal: MealRecommendation): SavedMealSnapshot {
  return {
    id: savedMealIdFromRecommendation(meal),
    title: meal.title,
    summary: meal.summary,
    estimatedTotal: meal.estimatedTotal,
    primaryStore: meal.primaryStore,
    cookTimeMinutes: meal.cookTimeMinutes,
    difficulty: meal.difficulty,
    confidenceLabel: meal.confidenceLabel,
    freshnessLabel: meal.freshnessLabel,
    ingredientHighlights: [...meal.ingredientHighlights],
    instructions: [...meal.instructions],
    savedAt: new Date().toISOString(),
  };
}

function parseSavedMeal(value: unknown): SavedMealSnapshot | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const record = value as Record<string, unknown>;
  if (
    typeof record.id !== "string" ||
    typeof record.title !== "string" ||
    typeof record.summary !== "string" ||
    typeof record.estimatedTotal !== "number" ||
    !Number.isFinite(record.estimatedTotal) ||
    typeof record.primaryStore !== "string" ||
    typeof record.cookTimeMinutes !== "number" ||
    typeof record.difficulty !== "string" ||
    typeof record.confidenceLabel !== "string" ||
    typeof record.freshnessLabel !== "string" ||
    typeof record.savedAt !== "string" ||
    !Array.isArray(record.ingredientHighlights) ||
    !Array.isArray(record.instructions)
  ) {
    return null;
  }

  return {
    id: record.id,
    title: record.title,
    summary: record.summary,
    estimatedTotal: record.estimatedTotal,
    primaryStore: record.primaryStore,
    cookTimeMinutes: record.cookTimeMinutes,
    difficulty: record.difficulty,
    confidenceLabel: record.confidenceLabel,
    freshnessLabel: record.freshnessLabel,
    ingredientHighlights: record.ingredientHighlights.filter(
      (item): item is string => typeof item === "string",
    ),
    instructions: record.instructions.filter(
      (item): item is string => typeof item === "string",
    ),
    savedAt: record.savedAt,
  };
}

export function parseSavedMeals(raw: unknown): SavedMealSnapshot[] {
  if (!Array.isArray(raw)) {
    return [];
  }

  const meals: SavedMealSnapshot[] = [];
  for (const item of raw) {
    const parsed = parseSavedMeal(item);
    if (parsed) {
      meals.push(parsed);
    }
  }

  return meals.slice(0, MAX_SAVED_MEALS);
}

export function readSavedMeals(): SavedMealSnapshot[] {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(SAVED_MEALS_STORAGE_KEY);
    if (!raw) {
      return [];
    }
    return parseSavedMeals(JSON.parse(raw));
  } catch {
    return [];
  }
}

export function writeSavedMeals(meals: SavedMealSnapshot[]): void {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(
    SAVED_MEALS_STORAGE_KEY,
    JSON.stringify(meals.slice(0, MAX_SAVED_MEALS)),
  );
}

export function clearSavedMeals(): void {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem(SAVED_MEALS_STORAGE_KEY);
}

export function toggleSavedMeal(
  current: SavedMealSnapshot[],
  meal: MealRecommendation,
): SavedMealSnapshot[] {
  const id = savedMealIdFromRecommendation(meal);
  if (current.some((entry) => entry.id === id)) {
    return current.filter((entry) => entry.id !== id);
  }

  return [toSavedMealSnapshot(meal), ...current].slice(0, MAX_SAVED_MEALS);
}

export function isMealSaved(
  meals: SavedMealSnapshot[],
  meal: Pick<MealRecommendation, "title" | "primaryStore">,
): boolean {
  const id = savedMealIdFromRecommendation(meal);
  return meals.some((entry) => entry.id === id);
}
