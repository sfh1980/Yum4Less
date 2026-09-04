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
    expect(
      isWeeklyAdJunkProduct("My Texas House Cambria Swivel Outdoor Dining Chair"),
    ).toBe(true);
    expect(
      isWeeklyAdJunkProduct(
        "Beautiful 5 in 1 Electric Skillet - Expandable up to 7 Qt with Glass Lid, White Icing by Drew Barrymore",
      ),
    ).toBe(true);
    expect(
      isWeeklyAdJunkProduct(
        "FitRx SmartBell Gym, 60 lbs. 4-in-1 Adjustable Interchangeable Dumbbell, Barbell, and Kettlebell Weight Set, Black",
      ),
    ).toBe(true);
    expect(
      isWeeklyAdJunkProduct(
        "Restored Premium Dyson Airwrap™ Multi-styler Complete Long Diffuse | Nickel/Copper (Refurbished)",
      ),
    ).toBe(true);
    expect(
      isWeeklyAdJunkProduct(
        "GE Profile™ Opal™ Nugget Ice Maker + Side Tank, Countertop Icemaker, Stainless Steel, 33lbs Daily Ice Production",
      ),
    ).toBe(true);
    expect(
      isWeeklyAdJunkProduct(
        "Beautiful 10-Cup Food Processor with Accessories, Cornflower Blue by Drew Barrymore",
      ),
    ).toBe(true);
    expect(
      isWeeklyAdJunkProduct(
        "Instant Pot 6Qt RIO Chef Series 7-in-1 Multi-Cooker, Pressure Cooker, Slow Cook, & More, Black",
      ),
    ).toBe(true);
    expect(
      isWeeklyAdJunkProduct("My Texas House Cambria Outdoor Dining Table"),
    ).toBe(true);
    expect(
      isWeeklyAdJunkProduct(
        "Restored Premium Dyson Airstrait™ Straightener | Amber Silk (Refurbished)",
      ),
    ).toBe(true);
    expect(
      isWeeklyAdJunkProduct(
        'Samsung 34" Odyssey G55T WQHD 165Hz 1ms(MPRT) AMD FreeSync HDR Curved Gaming Monitor - LC34G55TWDNXZA',
      ),
    ).toBe(true);
    expect(
      isWeeklyAdJunkProduct(
        "VIZIO 55 in Mini LED Quantum 4K QLED HDR Smart TV, 2026 Model, VQM55C-10",
      ),
    ).toBe(true);
    expect(
      isWeeklyAdJunkProduct(
        "Nutrafol Women's Hair Serum, Supports Visibly Thicker and Stronger Hair, Vegan, Lightweight and Fast-Absorbing",
      ),
    ).toBe(true);
    expect(
      isWeeklyAdJunkProduct(
        "Cosco Kids Entrada Infant & Toddler Convertible Car Seat, Baby Car Seat, Shady Day, Grey",
      ),
    ).toBe(true);
    expect(
      isWeeklyAdJunkProduct("London by Burberry, Eau De Parfum, Perfume for Women"),
    ).toBe(true);
    expect(
      isWeeklyAdJunkProduct(
        "Zevo Max Flying Insect Indoor Fly Trap: Easy, Mess-Free Solution - Light Trap Catches & Kills House Flies, Fruit Flies, Gnats, & More (1 Plug in Device & 4 Cartridges)",
      ),
    ).toBe(true);
    expect(
      isWeeklyAdJunkProduct(
        "Altec Lansing Hydra Jolt 2.0 Everything-Proof Wireless Magnetic Bluetooth Portable Speaker for Travel, Black",
      ),
    ).toBe(true);
    expect(
      isWeeklyAdJunkProduct("Beautiful 6-Speed Electric Hand Mixer, Lavender by Drew Barrymore"),
    ).toBe(true);
    expect(
      isWeeklyAdJunkProduct("Jessica Simpson Women's and Women's Plus Eydie Tee"),
    ).toBe(true);
    expect(
      isWeeklyAdJunkProduct("NETGEAR WiFi 6 Router (RAX5) – Security Features, AX1600 Wireless Speed"),
    ).toBe(true);
    expect(
      isWeeklyAdJunkProduct("PUR Faucet Mount Water Filtration System, Vertical, White, FM3333B"),
    ).toBe(true);
    expect(
      isWeeklyAdJunkProduct("Great Value Low Streaking Wet Mopping Cloths, Lavender, 24 Count"),
    ).toBe(true);
    expect(
      isWeeklyAdJunkProduct(
        "Glade® Scent Flow PlugIns® Air Freshener Starter Kit, Clean Linen, 1 Device + 1 Refill",
      ),
    ).toBe(true);
    expect(
      isWeeklyAdJunkProduct("Zep Home Pro Mold and Mildew Stain Eraser and Cleaner, Clean Fresh Scent"),
    ).toBe(true);
    expect(isWeeklyAdJunkProduct("Totino's Pizza Rolls")).toBe(true);
    expect(isWeeklyAdJunkProduct("Little Debbie Fall Cakes")).toBe(true);
    expect(isWeeklyAdJunkProduct("HOSTESS DONETTES")).toBe(true);
    expect(isWeeklyAdJunkProduct("Stouffer's Family Size Dinners")).toBe(true);
    expect(isWeeklyAdJunkProduct("KEURIG DONUT SHOP OR GREEN MOUNTAIN")).toBe(true);
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
    expect(isWeeklyAdJunkProduct("Swanson TV Dinners")).toBe(false);
    expect(isWeeklyAdJunkProduct("Great Value Ice Cream")).toBe(false);
    expect(isWeeklyAdJunkProduct("Kraft Salad Dressing")).toBe(false);
    expect(isWeeklyAdJunkProduct("A.1. Steak Sauce")).toBe(false);
    expect(isWeeklyAdJunkProduct("Marketside Caesar Salad Kit, 14.55 oz Bag (Fresh)")).toBe(
      false,
    );
    expect(isWeeklyAdJunkProduct("Martin's Potato Slider Rolls")).toBe(false);
    expect(isWeeklyAdJunkProduct("OLD EL PASO DINNER KIT")).toBe(false);
    expect(isWeeklyAdJunkProduct("RESER'S AMERICAN CLASSICS SIDES")).toBe(false);
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
