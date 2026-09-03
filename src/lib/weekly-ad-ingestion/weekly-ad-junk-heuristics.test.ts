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
      isWeeklyAdJunkProduct("Avia Women's Bubble Bottom Sneakers"),
    ).toBe(true);
    expect(
      isWeeklyAdJunkProduct("Crocs Women's Kadee Flip Flop Wedge Sandal"),
    ).toBe(true);
    expect(
      isWeeklyAdJunkProduct("Wonder Nation Boys Straight Fit Denim Jeans"),
    ).toBe(true);
    expect(
      isWeeklyAdJunkProduct("Coppertone Sport Sunscreen Spray, SPF 50 Sunscreen"),
    ).toBe(true);
    expect(
      isWeeklyAdJunkProduct("Lysol Disinfectant Spray, Lavender & Cotton Blossom"),
    ).toBe(true);
    expect(
      isWeeklyAdJunkProduct(
        "Chefman Anti-Overflow Belgian Waffle Maker with Shade Selector",
      ),
    ).toBe(true);
    expect(
      isWeeklyAdJunkProduct("Yellowstone Kayce Ceramic Dinner Plate"),
    ).toBe(true);
    expect(isWeeklyAdJunkProduct("Charmin Essentials Soft Toilet Paper 12 Mega Rolls")).toBe(
      true,
    );
    expect(
      isWeeklyAdJunkProduct("Hamilton Beach Smoothie Blender, 48 oz BPA-Free Jar"),
    ).toBe(true);
    expect(
      isWeeklyAdJunkProduct("Great Value Disinfecting Wipes, Lemon and Fresh Scent"),
    ).toBe(true);
    expect(
      isWeeklyAdJunkProduct("Razer Basilisk V3 Ergonomic Wired Gaming Mouse"),
    ).toBe(true);
    expect(
      isWeeklyAdJunkProduct(
        "Ninja French Door 8-in-1 Countertop Oven, with Smart Surroundair Technology and Air Fry Function, Dishwasher Safe, 6 Pieces, FO100 Silver",
      ),
    ).toBe(true);
    expect(isWeeklyAdJunkProduct("Tidy Cats Clumping Cat Litter")).toBe(true);
    expect(isWeeklyAdJunkProduct("Purina Beggin' Strips Dog Treats")).toBe(true);
    expect(isWeeklyAdJunkProduct("Heart to Tail Pet Bed")).toBe(true);
    expect(isWeeklyAdJunkProduct("Pedigree Puppy Chow Complete Puppy Food")).toBe(true);
    expect(
      isWeeklyAdJunkProduct("Estee Lauder Advanced Night Repair Serum Duo"),
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
    expect(isWeeklyAdJunkProduct("Short ribs")).toBe(false);
    expect(isWeeklyAdJunkProduct("Iced tea")).toBe(false);
    expect(isWeeklyAdJunkProduct("Ball Park Hot Dogs")).toBe(false);
    expect(isWeeklyAdJunkProduct("Catfish Fillets")).toBe(false);
    expect(isWeeklyAdJunkProduct("PET Evaporated Milk")).toBe(false);
    expect(isWeeklyAdJunkProduct("Daisy Sour Cream")).toBe(false);
    expect(isWeeklyAdJunkProduct("Filippo Berio Extra Virgin Olive Oil")).toBe(false);
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
