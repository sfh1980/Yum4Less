import { describe, expect, it } from "vitest";
import { buildMultiStorePlan, buildSingleStorePlan } from "@/lib/shopping-plan-builder";
import {
  aldiStore,
  blackBeanTacoRecipe,
  buildFullKrogerBlackBeanObservations,
  buildWeeklyAdObservation,
  krogerStore,
  splitStoreNearbyStores,
  splitStoreSnapshot,
} from "@/lib/shopping-plan-builder.fixture";

describe("buildSingleStorePlan", () => {
  it("returns an empty plan when no store stocks every ingredient", () => {
    const plan = buildSingleStorePlan(
      blackBeanTacoRecipe,
      [krogerStore],
      [
        buildWeeklyAdObservation({ ingredientId: "black-beans" }),
        buildWeeklyAdObservation({ ingredientId: "corn-tortillas" }),
      ],
      "database",
    );

    expect(plan).toEqual([]);
  });

  it("returns a full-store basket when one store stocks every ingredient", () => {
    const plan = buildSingleStorePlan(
      blackBeanTacoRecipe,
      [krogerStore],
      buildFullKrogerBlackBeanObservations(),
      "database",
    );

    expect(plan).toHaveLength(blackBeanTacoRecipe.ingredients.length);
    expect(new Set(plan.map((item) => item.storeName))).toEqual(new Set(["Kroger"]));
  });

  it("selects the store with the better plan quality when multiple stores qualify", () => {
    const cheaperKroger = buildFullKrogerBlackBeanObservations().map((observation) => ({
      ...observation,
      price: 0.99,
      priceSourceTier: 2,
    }));
    const pricierAldi = buildFullKrogerBlackBeanObservations().map((observation) => ({
      ...observation,
      storeId: "aldi-mechanicsville",
      price: 2.49,
      priceSource: "aldi-weekly-ad-scrape",
      priceSourceTier: 3,
    }));

    const plan = buildSingleStorePlan(
      blackBeanTacoRecipe,
      [aldiStore, krogerStore],
      [...cheaperKroger, ...pricierAldi],
      "database",
    );

    expect(plan[0]?.storeName).toBe("Kroger");
  });

  it("breaks plan-quality ties with fresher observations", () => {
    const staleKroger = buildFullKrogerBlackBeanObservations().map((observation) => ({
      ...observation,
      freshnessHoursAgo: 72,
    }));
    const freshAldi = buildFullKrogerBlackBeanObservations().map((observation) => ({
      ...observation,
      storeId: "aldi-mechanicsville",
      priceSource: "aldi-weekly-ad-scrape",
      freshnessHoursAgo: 6,
      price: 1.09,
      priceSourceTier: 2,
    }));

    const plan = buildSingleStorePlan(
      blackBeanTacoRecipe,
      [krogerStore, aldiStore],
      [...staleKroger, ...freshAldi],
      "database",
    );

    expect(plan[0]?.storeName).toBe("Aldi");
  });

  it("maps observation fields onto shopping plan items", () => {
    const plan = buildSingleStorePlan(
      {
        ...blackBeanTacoRecipe,
        ingredients: [{ ingredientId: "black-beans", displayName: "Black beans", quantityNote: "1 can" }],
      },
      [krogerStore],
      [
        buildWeeklyAdObservation({
          ingredientId: "black-beans",
          price: 1.09,
          saleLabel: "Weekly ad promo",
        }),
      ],
      "database",
    );

    expect(plan[0]).toMatchObject({
      ingredient: "Black beans",
      storeName: "Kroger",
      price: 1.09,
      priceSource: "kroger-weekly-ad-scrape",
      saleLabel: "Weekly ad promo",
    });
  });
});

describe("buildMultiStorePlan", () => {
  it("returns an empty plan when any ingredient lacks an in-stock observation", () => {
    const plan = buildMultiStorePlan(
      blackBeanTacoRecipe,
      splitStoreNearbyStores,
      splitStoreSnapshot.priceObservations.filter(
        (observation) => observation.ingredientId !== "black-beans",
      ),
      "database",
    );

    expect(plan).toEqual([]);
  });

  it("chooses the best observation per ingredient across stores", () => {
    const plan = buildMultiStorePlan(
      blackBeanTacoRecipe,
      splitStoreNearbyStores,
      splitStoreSnapshot.priceObservations,
      "database",
    );

    expect(plan.map((item) => ({
      ingredient: item.ingredient,
      storeName: item.storeName,
      price: item.price,
    }))).toEqual([
      { ingredient: "Black beans", storeName: "Aldi", price: 0.89 },
      { ingredient: "Corn tortillas", storeName: "Kroger", price: 2.29 },
      { ingredient: "Cabbage", storeName: "Kroger", price: 2.19 },
      { ingredient: "Lime", storeName: "Aldi", price: 0.45 },
      { ingredient: "Olive oil", storeName: "Aldi", price: 2.49 },
      { ingredient: "Taco seasoning", storeName: "Kroger", price: 0.89 },
      { ingredient: "Ground cumin", storeName: "Kroger", price: 0.79 },
    ]);
  });

  it("reproduces the CI-02 split-store subtotal", () => {
    const plan = buildMultiStorePlan(
      blackBeanTacoRecipe,
      splitStoreNearbyStores,
      splitStoreSnapshot.priceObservations,
      "database",
    );

    const subtotal = Math.round(plan.reduce((sum, item) => sum + item.price, 0) * 100) / 100;
    expect(subtotal).toBe(9.99);
  });

  it("uses two stores when ingredients split across chains", () => {
    const plan = buildMultiStorePlan(
      blackBeanTacoRecipe,
      splitStoreNearbyStores,
      splitStoreSnapshot.priceObservations,
      "database",
    );

    expect(new Set(plan.map((item) => item.storeName))).toEqual(new Set(["Kroger", "Aldi"]));
  });

  it("ignores out-of-stock observations", () => {
    const plan = buildMultiStorePlan(
      blackBeanTacoRecipe,
      splitStoreNearbyStores,
      splitStoreSnapshot.priceObservations.map((observation) =>
        observation.ingredientId === "black-beans" && observation.storeId === "aldi-mechanicsville"
          ? { ...observation, inStock: false }
          : observation,
      ),
      "database",
    );

    expect(plan.find((item) => item.ingredient === "Black beans")?.storeName).toBe("Kroger");
  });

  it("prefers higher-confidence observations when tier and freshness tie", () => {
    const observations = [
      buildWeeklyAdObservation({
        storeId: "kroger-mechanicsville",
        ingredientId: "lime",
        price: 0.55,
        matchConfidence: 0.72,
      }),
      buildWeeklyAdObservation({
        storeId: "aldi-mechanicsville",
        ingredientId: "lime",
        price: 0.55,
        priceSource: "aldi-weekly-ad-scrape",
        matchConfidence: 0.95,
      }),
    ];

    const plan = buildMultiStorePlan(
      {
        ...blackBeanTacoRecipe,
        ingredients: [{ ingredientId: "lime", displayName: "Lime", quantityNote: "1" }],
      },
      splitStoreNearbyStores,
      observations,
      "database",
    );

    expect(plan[0]?.storeName).toBe("Aldi");
  });
});
