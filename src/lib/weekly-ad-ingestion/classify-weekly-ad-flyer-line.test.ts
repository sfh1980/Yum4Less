import { describe, expect, it } from "vitest";
import { INTERNAL_CATALOG_INGREDIENTS } from "@/lib/internal-catalog";
import {
  classifyWeeklyAdFlyerLine,
  type WeeklyAdMatchCatalogSnapshot,
} from "@/lib/weekly-ad-ingestion/classify-weekly-ad-flyer-line";
import { normalizeWeeklyAdFlyerLabel } from "@/lib/weekly-ad-ingestion/weekly-ad-label-normalize";

function catalogSnapshot(
  overrides: Partial<WeeklyAdMatchCatalogSnapshot> = {},
): WeeklyAdMatchCatalogSnapshot {
  return {
    ingredients: INTERNAL_CATALOG_INGREDIENTS,
    skipLabels: new Set(),
    aliasesByLabel: new Map(),
    extraSearchTermsByIngredientId: {},
    ...overrides,
  };
}

describe("classifyWeeklyAdFlyerLine", () => {
  it("splits pears-or-oranges flyer lines into two simple foods", () => {
    const results = classifyWeeklyAdFlyerLine({
      productName: "Bartlett Pears or Navel Oranges",
      chain: "kroger",
      catalog: catalogSnapshot(),
    });

    expect(results.map((result) => result.action)).toEqual([
      "auto-create",
      "auto-create",
    ]);
    expect(results).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          action: "auto-create",
          ingredient: expect.objectContaining({ id: "pears", category: "produce" }),
        }),
        expect.objectContaining({
          action: "auto-create",
          ingredient: expect.objectContaining({ id: "oranges", category: "produce" }),
        }),
      ]),
    );
  });

  it("auto-creates pork loin and skips gadgets", () => {
    const pork = classifyWeeklyAdFlyerLine({
      productName: "Center Cut Pork Loin",
      chain: "kroger",
      catalog: catalogSnapshot(),
    });
    expect(pork).toEqual([
      expect.objectContaining({
        action: "auto-create",
        ingredient: expect.objectContaining({ id: "pork-loin", category: "protein" }),
      }),
    ]);

    const gadget = classifyWeeklyAdFlyerLine({
      productName: "Football Gadget Set",
      chain: "walmart",
      catalog: catalogSnapshot(),
    });
    expect(gadget).toEqual([
      expect.objectContaining({ action: "skip", reason: "junk" }),
    ]);
  });

  it("never treats chips as potatoes", () => {
    const results = classifyWeeklyAdFlyerLine({
      productName: "Lay's Classic Potato Chips",
      chain: "walmart",
      catalog: catalogSnapshot(),
    });

    expect(results).toEqual([
      expect.objectContaining({ action: "skip", reason: "junk" }),
    ]);
  });

  it("still matches chicken breast to the existing catalog id", () => {
    const results = classifyWeeklyAdFlyerLine({
      productName: "Simple Truth Natural Boneless Chicken Breasts, Value Pack",
      chain: "kroger",
      catalog: catalogSnapshot(),
    });

    expect(results).toEqual([
      expect.objectContaining({
        action: "match",
        ingredientId: "chicken-breast",
        saveAlias: true,
      }),
    ]);
  });

  it("uses a weekly-ad nickname before scoring", () => {
    const results = classifyWeeklyAdFlyerLine({
      productName: "Family Pack Chicken",
      chain: "aldi",
      catalog: catalogSnapshot({
        aliasesByLabel: new Map([
          [normalizeWeeklyAdFlyerLabel("Family Pack Chicken"), "chicken-breast"],
        ]),
      }),
    });

    expect(results).toEqual([
      expect.objectContaining({
        action: "match",
        ingredientId: "chicken-breast",
        saveAlias: false,
      }),
    ]);
  });

  it("drops skip-table labels and queues unclear foods for owner review", () => {
    const skipped = classifyWeeklyAdFlyerLine({
      productName: "Air Fryer",
      chain: "walmart",
      catalog: catalogSnapshot({
        skipLabels: new Set(["air fryer"]),
      }),
    });
    expect(skipped).toEqual([
      expect.objectContaining({ action: "skip", reason: "skip-table" }),
    ]);

    const pending = classifyWeeklyAdFlyerLine({
      productName: "Restaurant Style Dinner Kit",
      chain: "publix",
      catalog: catalogSnapshot(),
    });
    expect(pending).toEqual([
      expect.objectContaining({
        action: "review",
        normalizedLabel: expect.stringContaining("dinner kit"),
      }),
    ]);
  });

  it("skips housewares and personal-care junk while leaving dinner foods in review or auto-create", () => {
    expect(
      classifyWeeklyAdFlyerLine({
        productName: "KIRKTON HOUSE Fall Icon Candle",
        chain: "aldi",
        catalog: catalogSnapshot(),
      }),
    ).toEqual([expect.objectContaining({ action: "skip", reason: "junk" })]);

    expect(
      classifyWeeklyAdFlyerLine({
        productName: "Colgate Total Toothpaste",
        chain: "publix",
        catalog: catalogSnapshot(),
      }),
    ).toEqual([expect.objectContaining({ action: "skip", reason: "junk" })]);

    expect(
      classifyWeeklyAdFlyerLine({
        productName:
          'GIGABYTE Gaming A16 16" Laptop, Intel Core i7, 16GB RAM, 1TB SSD, GeForce RTX 5060',
        chain: "walmart",
        catalog: catalogSnapshot(),
      }),
    ).toEqual([expect.objectContaining({ action: "skip", reason: "junk" })]);

    expect(
      classifyWeeklyAdFlyerLine({
        productName: "Gravy Train Wet Dog Food",
        chain: "walmart",
        catalog: catalogSnapshot(),
      }),
    ).toEqual([expect.objectContaining({ action: "skip", reason: "junk" })]);

    expect(
      classifyWeeklyAdFlyerLine({
        productName: "Libman 24-Inch Cotton Dust Mop",
        chain: "walmart",
        catalog: catalogSnapshot(),
      }),
    ).toEqual([expect.objectContaining({ action: "skip", reason: "junk" })]);

    expect(
      classifyWeeklyAdFlyerLine({
        productName: "Avia Women's Bubble Bottom Sneakers",
        chain: "walmart",
        catalog: catalogSnapshot(),
      }),
    ).toEqual([expect.objectContaining({ action: "skip", reason: "junk" })]);

    expect(
      classifyWeeklyAdFlyerLine({
        productName: "Athletic Works Girls Active Graphic Tee with Short Sleeves",
        chain: "kroger",
        catalog: catalogSnapshot(),
      }),
    ).toEqual([expect.objectContaining({ action: "skip", reason: "junk" })]);

    expect(
      classifyWeeklyAdFlyerLine({
        productName: "Publix Garden Salad",
        chain: "publix",
        catalog: catalogSnapshot(),
      }),
    ).toEqual([
      expect.objectContaining({
        action: "review",
        normalizedLabel: expect.stringContaining("garden salad"),
      }),
    ]);

    expect(
      classifyWeeklyAdFlyerLine({
        productName: "McCormick Grill Mates 30 Minute Montreal Steak Marinade",
        chain: "publix",
        catalog: catalogSnapshot(),
      }),
    ).toEqual([
      expect.objectContaining({
        action: "review",
        normalizedLabel: expect.stringContaining("grill mates"),
      }),
    ]);

    expect(
      classifyWeeklyAdFlyerLine({
        productName: "Eastern Peaches",
        chain: "food-lion",
        catalog: catalogSnapshot(),
      }),
    ).toEqual([
      expect.objectContaining({
        action: "review",
        normalizedLabel: expect.stringContaining("peaches"),
      }),
    ]);

    expect(
      classifyWeeklyAdFlyerLine({
        productName: "Boneless Strip Steaks",
        chain: "kroger",
        catalog: catalogSnapshot(),
      }),
    ).toEqual([
      expect.objectContaining({
        action: "review",
        normalizedLabel: expect.stringContaining("steaks"),
      }),
    ]);
  });
});
