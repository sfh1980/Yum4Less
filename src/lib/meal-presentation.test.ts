import { describe, expect, it } from "vitest";
import { toRecommendation } from "@/lib/meal-presentation";
import { buildPlanItem, buildRecipe, defaultPreferences } from "@/lib/recommendation-scoring.fixture";
import { scoreCandidate } from "@/lib/recommendation-scoring";

describe("meal presentation explanation copy", () => {
  it("uses comfortable budget wording when price score is high", () => {
    const recommendation = toRecommendation(
      {
        recipe: buildRecipe({ title: "Budget Hero Bowl" }),
        shoppingPlan: [buildPlanItem()],
        estimatedTotal: 8,
        score: scoreCandidate({
          recipe: buildRecipe(),
          shoppingPlan: [buildPlanItem()],
          preferences: defaultPreferences,
          estimatedTotal: 8,
        }),
        confidenceLabel: "Single-store estimate",
        freshnessLabel: "Recent weekly-ad prices",
      },
      "database",
      [],
    );

    expect(recommendation.explanation).toContain("comfortably under the current budget");
    expect(recommendation.explanation).toContain("one-store trip");
  });

  it("uses directional freshness wording when freshness score is low", () => {
    const recommendation = toRecommendation(
      {
        recipe: buildRecipe({ title: "Older Price Pasta" }),
        shoppingPlan: [
          buildPlanItem({
            freshnessHoursAgo: 120,
            freshnessDaysAgo: 5,
            matchConfidence: 0.55,
          }),
        ],
        estimatedTotal: 14,
        score: scoreCandidate({
          recipe: buildRecipe(),
          shoppingPlan: [
            buildPlanItem({
              freshnessHoursAgo: 120,
              freshnessDaysAgo: 5,
              matchConfidence: 0.55,
            }),
          ],
          preferences: defaultPreferences,
          estimatedTotal: 14,
        }),
        confidenceLabel: "Single-store estimate",
        freshnessLabel: "Older prices — verify in store",
      },
      "database",
      [],
    );

    expect(recommendation.explanation).toContain("still fits the current budget");
    expect(recommendation.explanation).toContain("more directional");
  });

  it("mentions multi-store savings when the plan spans stores", () => {
    const recommendation = toRecommendation(
      {
        recipe: buildRecipe({ title: "Split Store Tacos" }),
        shoppingPlan: [
          buildPlanItem({ storeName: "Kroger" }),
          buildPlanItem({ storeName: "Aldi", ingredient: "Lime" }),
        ],
        estimatedTotal: 9.99,
        score: scoreCandidate({
          recipe: buildRecipe(),
          shoppingPlan: [
            buildPlanItem({ storeName: "Kroger" }),
            buildPlanItem({ storeName: "Aldi", ingredient: "Lime" }),
          ],
          preferences: { ...defaultPreferences, shoppingStyle: "multi-store" },
          estimatedTotal: 9.99,
        }),
        confidenceLabel: "Multi-store estimate",
        freshnessLabel: "Recent weekly-ad prices",
      },
      "database",
      [],
    );

    expect(recommendation.explanation).toContain("balances savings across multiple nearby stores");
  });

  it("mentions recent observations when freshness score is strong", () => {
    const recommendation = toRecommendation(
      {
        recipe: buildRecipe({ title: "Fresh Market Stir Fry" }),
        shoppingPlan: [buildPlanItem({ freshnessHoursAgo: 4 })],
        estimatedTotal: 11,
        score: {
          total: 80,
          price: 30,
          convenience: 30,
          freshness: 18,
          fit: 2,
        },
        confidenceLabel: "Single-store estimate",
        freshnessLabel: "Same-day online prices",
      },
      "database",
      [],
    );

    expect(recommendation.explanation).toContain("checked recently");
    expect(recommendation.explanation).toContain("not live checkout totals");
  });
});
