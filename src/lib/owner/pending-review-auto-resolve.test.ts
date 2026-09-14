import { describe, expect, it } from "vitest";
import { planPendingReviewResolution } from "@/lib/owner/pending-review-auto-resolve";

describe("pending review auto-resolve", () => {
  it("does not map steak-house dressing or plant steak onto beef", () => {
    expect(planPendingReviewResolution("Ken's Steak House Dressing")).toMatchObject({
      action: "yes",
      ingredientId: "salad-dressing",
    });
    expect(planPendingReviewResolution("Nasoya Plant-Based Steak")).toMatchObject({
      action: "skip",
    });
    expect(planPendingReviewResolution("Unreal Deli Plant-Based Steak Slices")).toMatchObject({
      action: "skip",
    });
  });

  it("rejects vague brand lines and dessert coffee ramen", () => {
    expect(planPendingReviewResolution("Thomas' Products").action).toBe("no");
    expect(planPendingReviewResolution("Publix Vegetables").action).toBe("no");
    expect(planPendingReviewResolution("Fresh Family Pack").action).toBe("no");
    expect(planPendingReviewResolution("GreenWise Organic Coffee").action).toBe("no");
    expect(planPendingReviewResolution("Ghirardelli Sauce").action).toBe("no");
    expect(planPendingReviewResolution("Chef Woo Ramen").action).toBe("no");
    expect(
      planPendingReviewResolution("Newman's Own Pizza or Farm Rich Meatballs").action,
    ).toBe("no");
  });

  it("maps leftover grocery onto generic foods, not brand slugs", () => {
    expect(planPendingReviewResolution("Mama Cozzi's Pizza Kitchen Pizza Dough")).toMatchObject({
      action: "yes",
      ingredientId: "pizza-dough",
    });
    expect(planPendingReviewResolution("Trans Ocean Crab Classic")).toMatchObject({
      action: "yes",
      ingredientId: "imitation-crab",
    });
    expect(planPendingReviewResolution("Whiting Fillets")).toMatchObject({
      action: "yes",
      ingredientId: "white-fish",
    });
    expect(planPendingReviewResolution("Thomas' English Muffins")).toMatchObject({
      action: "yes",
      ingredientId: "english-muffin",
    });
    expect(planPendingReviewResolution("Garden Life Romaine Leaves")).toMatchObject({
      action: "yes",
      ingredientId: "lettuce",
    });
    expect(planPendingReviewResolution("Ground Round Burgers or Slider Burgers")).toMatchObject({
      action: "yes",
      ingredientId: "ground-beef",
    });
    expect(planPendingReviewResolution("Boneless Chuck Roast")).toMatchObject({
      action: "yes",
      ingredientId: "beef-roast",
    });
    expect(planPendingReviewResolution("Ribeye Steak Boneless")).toMatchObject({
      action: "yes",
      ingredientId: "beef-steak",
    });
    expect(planPendingReviewResolution("A.1. Steak Sauce")).toMatchObject({
      action: "yes",
      ingredientId: "steak-sauce",
    });
    expect(planPendingReviewResolution("Eggo Frozen Waffles")).toMatchObject({
      action: "yes",
      ingredientId: "waffles",
    });
    expect(planPendingReviewResolution("GreenWise Chicken Drumsticks or Bone-In Thighs, USDA Grade A, Raised Without Antibiotics")).toMatchObject({
      action: "yes",
      ingredientId: "chicken-thighs",
    });
  });

  it("reuses peach if peaches is missing", () => {
    const plan = planPendingReviewResolution("Eastern Peaches", {
      existingIds: new Set(["peach"]),
    });
    expect(plan).toMatchObject({ action: "yes", ingredientId: "peach" });
  });

  it("skips prepared sides and unknown sauces", () => {
    expect(planPendingReviewResolution("BOB EVANS FAMILY SIZE SIDE DISH").action).toBe(
      "skip",
    );
    expect(planPendingReviewResolution("Mae Ploy Sauce").action).toBe("skip");
    expect(planPendingReviewResolution("Giovanni Rana Meat Lasagna").action).toBe("skip");
  });

  it("leaves unmatched grocery pending", () => {
    expect(planPendingReviewResolution("Mystery Aisle Widget").action).toBe("skip");
  });

  it("maps smashburgers, filet mignon, baba ganoush, and grill mates", () => {
    expect(
      planPendingReviewResolution("Schweid & Sons Signature Smashburgers"),
    ).toMatchObject({ action: "yes", ingredientId: "ground-beef" });
    expect(planPendingReviewResolution("Verde Farms Filet Mignon")).toMatchObject({
      action: "yes",
      ingredientId: "beef-steak",
    });
    expect(
      planPendingReviewResolution("Haig's Delicacies Baba Ghannouge"),
    ).toMatchObject({ action: "yes", ingredientId: "baba-ganoush" });
    expect(
      planPendingReviewResolution(
        "McCormick Grill Mates 30 Minute Montreal Steak Marinade",
      ),
    ).toMatchObject({ action: "yes", ingredientId: "grill-seasoning" });
  });
});
