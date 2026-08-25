import { describe, expect, it } from "vitest";
import {
  flyerLineLooksLikeJunk,
  isWeeklyAdJunkProduct,
} from "@/lib/weekly-ad-ingestion/weekly-ad-junk-heuristics";

describe("isWeeklyAdJunkProduct", () => {
  it("skips electronics, housewares, personal care, pet, and beer-brand leftovers", () => {
    expect(
      isWeeklyAdJunkProduct(
        'GIGABYTE Gaming A16 16" Laptop, Intel Core i7, 16GB RAM, 1TB SSD, GeForce RTX 5060',
      ),
    ).toBe(true);
    expect(isWeeklyAdJunkProduct("KIRKTON HOUSE Fall Icon Candle")).toBe(true);
    expect(
      isWeeklyAdJunkProduct("Colgate Total 5.1-oz, Sensitive 6-oz or MaxFresh 4.5-oz Toothpaste"),
    ).toBe(true);
    expect(isWeeklyAdJunkProduct("Gravy Train Wet Dog Food")).toBe(true);
    expect(
      isWeeklyAdJunkProduct(
        "Libman 24-Inch Cotton Dust Mop with Red Steel Handle for Commercial Use",
      ),
    ).toBe(true);
    expect(
      isWeeklyAdJunkProduct("Licensed Toddlers' Character Halloween Slippers"),
    ).toBe(true);
    expect(isWeeklyAdJunkProduct("nobilo")).toBe(true);
    expect(isWeeklyAdJunkProduct("Corona, Modelo or Pacifico")).toBe(true);
    expect(
      isWeeklyAdJunkProduct(
        "Better Homes & Gardens River Oaks Outdoor Sofa & 2 Nesting Tables with Patio Cover",
      ),
    ).toBe(true);
  });

  it("does not skip dinner foods that junk used to false-hit", () => {
    expect(isWeeklyAdJunkProduct("Publix Garden Salad")).toBe(false);
    expect(
      isWeeklyAdJunkProduct("McCormick Grill Mates 30 Minute Montreal Steak Marinade"),
    ).toBe(false);
    expect(isWeeklyAdJunkProduct("GreenWise Organic Baby Spinach")).toBe(false);
    expect(isWeeklyAdJunkProduct("Eastern Peaches")).toBe(false);
    expect(isWeeklyAdJunkProduct("Boneless Strip Steaks")).toBe(false);
    expect(isWeeklyAdJunkProduct("Hillshire Farm Lunch Meats")).toBe(false);
    expect(isWeeklyAdJunkProduct("Mama Cozzi's Pizza Kitchen Pizza Dough")).toBe(false);
  });

  it("treats either the raw title or the normalized label as junk", () => {
    expect(
      flyerLineLooksLikeJunk(
        "Everyday Living® Bath Towel",
        "everyday living bath towel",
      ),
    ).toBe(true);
    expect(
      flyerLineLooksLikeJunk("Eastern Peaches", "eastern peaches"),
    ).toBe(false);
  });
});
