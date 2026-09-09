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
    expect(
      isWeeklyAdJunkProduct("Nanit Essential Smart Baby Video Monitor (Walmart Exclusive)"),
    ).toBe(true);
    expect(
      isWeeklyAdJunkProduct(
        "GCI Outdoor Freestyle Rocker XL Oversized Rocking Camping Chair with Cup & Phone Holder, Pewter",
      ),
    ).toBe(true);
    expect(isWeeklyAdJunkProduct("Igloo 50 QT Overland Ice Chest Cooler, Blue")).toBe(true);
    expect(
      isWeeklyAdJunkProduct(
        "Renwick Modern Upholstered Tub Chair for Living room, Set of 2, Ivory Boucle",
      ),
    ).toBe(true);
    expect(
      isWeeklyAdJunkProduct(
        "My Texas House Cambria Rectangular Steel Outdoor Coffee Table, Black",
      ),
    ).toBe(true);
    expect(
      isWeeklyAdJunkProduct(
        "Equip Comfort Click Chair, Foldable Outdoor Seating with Mesh Back, Cup Holder, and Carry Bag, Supports 300 lbs",
      ),
    ).toBe(true);
    expect(
      isWeeklyAdJunkProduct("My Texas House Cambria Steel Outdoor Chaise Lounge, Black"),
    ).toBe(true);
    expect(
      isWeeklyAdJunkProduct("LifeStride Women's Incredible Ballet Flat - Medium & Wide Width"),
    ).toBe(true);
    expect(
      isWeeklyAdJunkProduct("Serta Air Lumbar Bonded Leather Manager Office Chair, Black"),
    ).toBe(true);
    expect(
      isWeeklyAdJunkProduct("Blackstone Ultimate Griddle Kit"),
    ).toBe(true);
    expect(
      isWeeklyAdJunkProduct("Expert Grill Heavy Duty 24 in Charcoal Grill with Wheels, Black"),
    ).toBe(true);
    expect(
      isWeeklyAdJunkProduct("Kingsford Original Charcoal Briquettes for Grilling, Flag Limited Edition"),
    ).toBe(true);
    expect(
      isWeeklyAdJunkProduct("Titan by Arctic Zone 9 Can Zipperless Soft Cooler, 6 Quart, Rainwash Blue"),
    ).toBe(true);
    expect(
      isWeeklyAdJunkProduct("TAL 20oz Stainless Steel 2-in-1 Straw and Chug Water Bottle with Push Lid, Neon Blue"),
    ).toBe(true);
    expect(
      isWeeklyAdJunkProduct("Great Value 25% Plant-Based Compostable Sandwich Bags"),
    ).toBe(true);
    expect(
      isWeeklyAdJunkProduct("Comet Multipurpose Cleaning Powder with Bleach"),
    ).toBe(true);
    expect(
      isWeeklyAdJunkProduct("Fabuloso 2X Multi-Purpose Cleaner, No Rinse Floor Cleaner, Peach Scent"),
    ).toBe(true);
    expect(
      isWeeklyAdJunkProduct(
        "Windex Fast Shine Foam Glass, Window, and Mirror All Purpose Cleaner, No-Drip Aerosol Cleaning Spray",
      ),
    ).toBe(true);
    expect(
      isWeeklyAdJunkProduct("No Boundaries Ribbed Cami Top, 5-Pack, Women's XXS-XXL"),
    ).toBe(true);
    expect(isWeeklyAdJunkProduct("Stella Artois")).toBe(true);
    expect(isWeeklyAdJunkProduct("Blue Moon")).toBe(true);
    expect(isWeeklyAdJunkProduct("Yuengling Flight")).toBe(true);
    expect(isWeeklyAdJunkProduct("Michelob Ultra, Twisted Tea, Kona or Yuengling Flight")).toBe(
      true,
    );
    expect(
      isWeeklyAdJunkProduct("LED Cornhole Board Set - Light Up Bean Bag Toss with 6 Bags, by MinnARK"),
    ).toBe(true);
    expect(
      isWeeklyAdJunkProduct("Wonder Nation Baby Gender Neutral Layette Gift Set"),
    ).toBe(true);
    expect(
      isWeeklyAdJunkProduct("Graco Pack 'n Play Playard Anywhere Dreamer Portable Playpen, Pristine, Blue"),
    ).toBe(true);
    const moreGmLeftovers = [
      "GCI Outdoor Legz Up Lounger Folding Reclining Camping Chair with Adjustable Leg Rest, Heathered Loden",
      "GCI Outdoor Kickback Insulated Rocker Low Profile Rocking Camping Chair with Cup Holder, Berry",
      "Roundhill Furniture Leland Fabric Upholstered Counter Height Wingback Stools, Set of 2, Blue",
      "Teamson Kids Deluxe Glow 2-in-1 Wooden Vanity Desk with LED 3-Mirror, Storage, Touch Sensor & Stool, White",
      "GCI Outdoor Freestyle Rocker Folding Rocking Camping Chair with Cup Holder, Black",
      "edx 5 Drawer Fabric Dresser for Bedroom, Chest of Drawer Organizer Storage Cabinet for Closet, Entryway, Grey",
      "My Texas House Cambria Outdoor Steel End Table, Black",
      "Baby Trend Lil Snooze Deluxe II Nursery Center Playard in Forest Party Grey",
      "VTech VM5267 Video Baby Monitor with 5\" Display and Remote Pan & Tilt Camera",
      "Easy Spirit Women's Geanna Comfort Loafer",
      "Sesame Street 6 Bin Design and Store Toy Organizer by Delta Children - Durable Engineered Wood, Solid Wood and Fabric Construction, Multi Color",
      "MD Sports Foldable Ladder Toss Game, Red, Green and Black",
      "Ultimate 6-in-1 Sports Set, Multi-Game Pack, Outdoor Play, for All Ages, by MinnARK",
      "LED Jumbo 4-in-a-Row, Indoor and Outdoor Table Game, for All Ages, by MinnARK",
      "Bluey Round Foldable Saucer Chair, Blue",
      'Furinno 11003WH 3 - Tier Open Shelf Bookcase, White Color - 12" W x 31.5" H x 9.3" D',
      "Marvel Spider-Man Kids Bean Bag Chair - Blue Polyester",
      "TAL 24oz Stainless Steel Hudson Paracord Handle Water Bottle, Pink",
      "Avia Women's Sport Loafers",
      "Eastsport Clear Stadium Cross Body, Black",
      "Keystone",
      "Natural Light, Busch or Keystone",
    ];
    for (const title of moreGmLeftovers) {
      expect(isWeeklyAdJunkProduct(title), title).toBe(true);
    }
    const ownerQueuePharmacyDrinksPaper = [
      "Advil 300-ct. or Advil PM 120-ct.",
      "Any 1 Adult Zyrtec",
      "Tampax Pearl or Radiant Tampons",
      "Angel Soft Bath Tissue",
      "Charmin Essentials Bathroom Tissue",
      "Kleenex Facial Tissues",
      "Softsoap Hand Soap",
      "Dove Men Plus Care Deodorant",
      "Downy Fabric Softener",
      "12-Pack White Claw Hard Seltzer",
      "12-Pack Truly Hard Seltzer",
      "12-Pack Twisted Tea Hard Iced Tea",
      "Sierra Nevada, New Belgium or Sam Adams",
      "Smirnoff, Jack Daniel's or Cayman Jack",
      "Busch Light, Natural Light, Pabst or Miller High Life",
      "High Noon, Nütrl or Surfside",
      "Yes Way Rosé",
      "Apothic, Bogle or Alamos Malbec",
      "8-Pack Pepsi Products",
      "7UP Products",
      "Gatorade Thirst Quencher",
      "Red Bull Energy Drink",
      "Alani Nu Energy Drink",
      "40-Pack Kroger Purified Water",
      "Dasani Water",
      "Sanpellegrino or Essentia Water",
      "221 B.C. Organic Kombucha",
      "Kroger Coffee Pods",
      "Starbucks K-Cup Coffee",
      "General Mills Giant Size Cereal",
      "Nature Valley Granola Bars",
      "Quest Protein Bars",
      "Premier Protein Shake",
      "Oscar Mayer Fun Pack Lunchables",
      "Chex Mix or Gardetto's Snack Mix",
      "Pringles",
      "Tostitos",
      "Pepperidge Farm Goldfish",
      "Bloom Haus Dozen Rose Bunch",
      "Classic Dozen Roses",
      "GreenWise Bouquet",
      "Tea Cup Orchid",
      "C&C Fleece Pullover",
      "Dickies Heavyweight Tees",
      "Fruit of the Loom All Day Comfort Women's Socks, Sizes 4-12, 6-Pack",
      "Aerosoles Women's Lucca Footbed Buckle Clog",
      "Bentgo Meal Prep Container Set",
      "Chefman All Purpose Griddle or 1.5-Liter Deep Fryer",
      "Crock-Pot Manual 4.5-Quart Stainless Steel Cooker",
      "Martha Stewart Everyday Elverton 32-Piece Non-Stick Aluminum Cookware Set, Pots and Pans with Utensils, White",
      "Coleman Steel Pro Max 14' x 33\" Round Metal Frame Above Ground Pool Set",
      "Barbie + Float Life by Funboy Splash Pad, 64\" Diameter, Children Ages 6+",
      "Spalding 54-Inch Portable Basketball Hoop with Shatter-Proof Polycarbonate Backboard, Adjustable ExactaHeight System & Pro Slam Rim-Outdoor Play",
      "Nespresso Vertuo Pop Coffee and Espresso Maker by De'Longhi, Liquorice Black",
      "George Foreman 2‑Serving Electric Indoor Grill, Non‑Stick Panini Press, Compact Slim Design, Easy‑Clean Drip Tray, Black",
      "Everyday Living Plastic Hangers",
      "Philips LED Light Bulbs",
      "Foster Grant Sunglasses",
      "Bic Multi-Purpose Lighter",
      "Publix Glass Cleaner",
      "Resolve Carpet Cleaner",
      "Zep Home Pro Miracle Foaming Grout Cleaner and Protectant, Morning Dew Scent",
      "Great Value Dry Sweeping Cloth Refills",
      "Scrub Daddy Scrub Mommy Non-Scratch Cleaning Sponges",
      "Smart Living Sponges",
      "Brutus Bone Broth Made for Dogs",
      "Delectables Treats for Cats",
      "Pup-Peroni Dog Snacks",
      "Nylabone Natural Nubz Dog Chews",
      "Hot Wheels Car",
      "Kingsford Original or Match Light Charcoal",
      "Royal Oak Hardwood Lump Charcoal",
      "Digiorno Rising Crust Pizza",
      "Totino's Party Pizza",
      "Hot Pockets Stuffed Sandwiches",
      "Similac Infant Formula",
      "Pampers Baby Wipes, 52 to 72-ct. pkg.",
      "STARBUCKS ICED COFFEE",
    ];
    for (const title of ownerQueuePharmacyDrinksPaper) {
      expect(isWeeklyAdJunkProduct(title), title).toBe(true);
    }
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
    expect(
      isWeeklyAdJunkProduct("Eggo Blueberry Waffles, Breakfast Food, 12.3 oz, 10 Count (Frozen)"),
    ).toBe(false);
    expect(isWeeklyAdJunkProduct("Great Value Ziti, 16 oz")).toBe(false);
    expect(isWeeklyAdJunkProduct("SARTORI CHEDDARS")).toBe(false);
    expect(isWeeklyAdJunkProduct("Seedless Watermelons")).toBe(false);
    expect(isWeeklyAdJunkProduct("Whiting Fillets")).toBe(false);
    expect(isWeeklyAdJunkProduct("Dole Salad Kits")).toBe(false);
    expect(isWeeklyAdJunkProduct("Hidden Valley Ranch Dressing")).toBe(false);
    expect(isWeeklyAdJunkProduct("Rao's Homemade Sauce")).toBe(false);
    expect(isWeeklyAdJunkProduct("Boneless Chuck Roast")).toBe(false);
    expect(isWeeklyAdJunkProduct("GreenWise Chicken Drumsticks or Bone-In Thighs, USDA Grade A, Raised Without Antibiotics")).toBe(
      false,
    );
    expect(isWeeklyAdJunkProduct("Publix Caesar Salad Bowl")).toBe(false);
    expect(isWeeklyAdJunkProduct("Tree-Ripened Peaches or Nectarines")).toBe(false);
    expect(isWeeklyAdJunkProduct("Cauliflower")).toBe(false);
    expect(isWeeklyAdJunkProduct("King's Hawaiian Dinner Rolls")).toBe(false);
    expect(isWeeklyAdJunkProduct("College Inn Broth")).toBe(false);
    expect(isWeeklyAdJunkProduct("Ground Sirloin")).toBe(false);
    expect(isWeeklyAdJunkProduct("Johnsonville Brats")).toBe(false);
    expect(isWeeklyAdJunkProduct("Oscar Mayer Franks")).toBe(false);
    expect(isWeeklyAdJunkProduct("McCormick Grill Mates Seasoning")).toBe(false);
    expect(isWeeklyAdJunkProduct("Weber Seasoning")).toBe(false);
    expect(isWeeklyAdJunkProduct("Rosina Meatballs")).toBe(false);
    expect(isWeeklyAdJunkProduct("Schweid & Sons Gourmet Burgers")).toBe(false);
    expect(isWeeklyAdJunkProduct("StarKist Solid White Albacore in Water")).toBe(false);
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
