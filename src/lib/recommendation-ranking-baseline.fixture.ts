import type { ScoreBreakdown } from "@/lib/recommendation-types";
import type { MealRecommendation } from "@/lib/recommendation-types";

/** Frozen CI-02 ranking outputs for ZIP 23111 default single-store preferences. */
export const zip23111DefaultRankingBaseline = {
  titles: [
    "Black Bean Tacos with Lime Slaw",
    "Garlic Butter Pasta with Spinach",
    "Sheet Pan Lemon Chicken and Vegetables",
  ] as const,
  estimatedTotals: [10.68, 13.99, 15.4] as const,
  scores: [
    { total: 82, price: 34, convenience: 30, freshness: 6, fit: 12 },
    { total: 79, price: 27, convenience: 30, freshness: 8, fit: 14 },
    { total: 70, price: 24, convenience: 20, freshness: 10, fit: 16 },
  ] as const satisfies readonly ScoreBreakdown[],
};

export const zip23111Budget12Baseline = {
  titles: ["Black Bean Tacos with Lime Slaw"] as const,
  estimatedTotals: [10.68] as const,
};

export const zip23111VegetarianBaseline = {
  titles: [
    "Black Bean Tacos with Lime Slaw",
    "Garlic Butter Pasta with Spinach",
  ] as const,
};

export const zip23111SplitStoreMultiBaseline = {
  title: "Black Bean Tacos with Lime Slaw",
  estimatedTotal: 9.99,
  storeCount: 2,
  confidenceLabel: "Multi-store estimate" as const,
  shoppingPlan: [
    { ingredient: "Black beans", storeName: "Aldi", price: 0.89 },
    { ingredient: "Corn tortillas", storeName: "Kroger", price: 2.29 },
    { ingredient: "Cabbage", storeName: "Kroger", price: 2.19 },
    { ingredient: "Lime", storeName: "Aldi", price: 0.45 },
    { ingredient: "Olive oil", storeName: "Aldi", price: 2.49 },
    { ingredient: "Taco seasoning", storeName: "Kroger", price: 0.89 },
    { ingredient: "Ground cumin", storeName: "Kroger", price: 0.79 },
  ] as const,
};

export function pickRankingSnapshot(meals: MealRecommendation[]) {
  return meals.map((meal) => ({
    title: meal.title,
    estimatedTotal: meal.estimatedTotal,
    score: meal.score,
    storeCount: meal.storeCount,
    confidenceLabel: meal.confidenceLabel,
  }));
}
