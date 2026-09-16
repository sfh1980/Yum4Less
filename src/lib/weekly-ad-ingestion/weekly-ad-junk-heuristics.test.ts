import { describe, expect, it } from "vitest";
import {
  flyerLineLooksLikeJunk,
  isWeeklyAdJunkProduct,
  looksLikeNonFoodMerchandise,
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
    const leftoverQueue20260910 = [
      "Each",
      "THE HALLOWEEN COLLECTION LED Hanging Ghost",
      'THE HALLOWEEN COLLECTION 36" Posable Skeleton',
      "Disney Halloween Plush",
      "SOHL Furniture Rectangular Storage Ottoman",
      "Crane Ladies' or Men's Rain Jacket",
      "Serra Ladies' Game Day Pajamas",
      "Pokémon Booster Pack",
      "Ambiano Digital Food Dehydrator",
      "Boulder Parchment Paper",
      "Boulder Press & Seal Gallon Bags",
      "Benton's 100 Calorie Snack Packs",
      "Bake Shop Mini or Large Croissants",
      "Breakfast Best Breakfast Bowl",
      "Elevation Protein Energy Bars",
      "Choeur Chocolate Assortment",
      "Fusia Takeout Box",
      "Park Street Deli Asian Meal Kit",
      "Reggano Cheesy Skillet Dinner",
      "Mama Cozzi's Pizza Kitchen Deep Dish Pizza Singles 4-Pack",
      "Polar Seltzer",
      "PurAqua Sparkling Frost Water",
      "Bodyarmor",
      "Alani Energy",
      "Celsius Original or Vibe",
      "4 Mega Rolls Angel Soft",
      "Always Radiant or Infinity Flexfoam Pads",
      "Tena Moderate 20-ct., UltraThin 30-ct. or Heavy Absorbency 14-ct. Pads",
      "Allegra Adult 24-Hour Tablets",
      "CareOne Acetaminophen",
      "Alka-Seltzer Cold 20–36-ct., Coricidin HBP 16–24-ct. or 12-oz or Afrin 15–30-mL",
      "8-Pack Guinness Draught Stout",
      "Mike's Hard Lemonade",
      "J. Lohr, Stella Rosa or Clos du Bois",
      "La Marca or Whitehaven",
      "Betty Crocker or Mott's Fruit Snacks",
      "El Monterey Taquitos",
      "Lance Crackers",
      "Always My Baby Training Pants",
      "Beech-Nut Organics Baby Food",
      "Any 2 Gerber 2nd Foods Tubs",
      "Intex Pink Transparent Lounge Float",
      "Play Day Hopscotch Rings, 20 Pieces",
      "Fitflop Women's Rally e01 Multi-Knit Trainers",
      "Scoop Women's Day Lace Trim Top",
      "Serra Ladies' Game Day Top",
      "Dip® Tee",
      "Rubbermaid Food Storage Set",
      "Melii Harvest Meal Prep or Snackle",
      "Kind Bars",
      "RXBars",
      "Clif ZBars",
      "Smucker's Uncrustables",
      "Caulipower Pizza",
      "Any 1 Danimals Smoothie",
      "Ensure Nutrition Shake",
      "Powerade",
      "HAWAIIAN PUNCH",
      "Big K",
      "Gold Peak Tea",
      "Glacéau Smartwater",
      "4 Inch Mini Roses",
      "6 INCH ASSORTED FALL MUMS",
      "Glad Tall Kitchen Bags",
      "Heathy Choice Power or Max Bowls, or Dolly Parton's Entrées",
      "Dr. Praeger's Entrées",
      "Chef's Cupboard Protein Ramen Cup",
      "Millville Protein Crunchy Granola",
      "Friendly Farms Kefir",
      "Simply Fruit Drink or Ade",
      "Any Medium Fountain Drink",
      "Orgain Organic Protein Powder",
      "Nature Made Melatonin Gummies",
      "Lunch Buddies Crustless PB&J Sandwiches",
      "Little Tikes Hoop it up! Play Center, 3-in-1 Sports 25 Ball Value Pack, Indoor and Outdoor Play for Children 3 to 6 Years Old",
      "GAIN",
      "Food Lion Ground Coffee",
      "Dunkin' Coffee",
      "POWER UP TRAIL MIX",
      "TAKIS",
      "Pillsbury Flaky or Grands! juniors Biscuits",
      "Jell-O Gelatin or Pudding",
      "Food Lion Drinks",
      "Happy Tot or Happy Baby Organic Baby Food",
      "Outshine Bars",
      "Blue Bunny Novelties",
      "BOMB POP",
      "Hi-C or Hawaiian Punch",
      "MINUTE MAID ZERO OR SIMPLY ADES",
      "MiO Water Enhancer",
      "Earth Grown Plant-Based Protein Meal",
      "Simple Truth Protein Bowl",
      "Ryl Tea Single",
    ];
    for (const title of leftoverQueue20260910) {
      expect(isWeeklyAdJunkProduct(title), title).toBe(true);
    }
    const leftoverAfterHeal20260910 = [
      "Benton's Breakfast Biscuits",
      "Mama Cozzi's Pizza Kitchen Pepperoni Cauliflower Deli Pizza",
      "Arizona or Lipton Tea",
      "Armour LunchMakers",
      "Clearly Canadian",
      "Deer Park Water",
      "DeMet's Turtles Minis",
      "Devils Backbone or Starr Hill",
      "Devour Big Bowl",
      "Donut Shop or McCafé Coffee",
      "Earth's Best Organic Veggie Puffs",
      "Edwards Pies",
      "Entenmann's Little Bites Muffins",
      "Evian or Fiji Water",
      "FROLLIES",
      "Fruit Bites or Braided Strudel",
      "GHOST OR BLOOM ENERGY",
      "Jet Dry",
      "Jumex Nectar",
      "Kellogg's Multipacks",
      "Kinder Bueno Frozen Dessert or Cones",
      "King Arthur Gluten Free Baking Mixes",
      "Lavazza Coffee",
      "Lindt Excellence Bar",
      "Lindy's Italian or Swirled Italian Ice",
      "Nature'S Promise Organic Seaweed Snacks",
      "Prep Chef Protein Starter",
      "Snack Pies",
      "Snyder's Pretzel Pieces",
      "Solti Organic Super Shots",
      "Three Notch'd",
      "Trü Frü Frozen Chocolate Covered Fruit",
      "Truvia Packets",
      "UKROP'S CHOCOLATE FUDGE PIE",
      "Wild Mike's Pizza",
      "Bakery Fresh Muffins",
      "Calbee Harvest Snaps",
      "Cherry Pie",
      "Farm Rich Appetizers",
      "Frito-Lay or Nabisco Multipack",
      "Nature Valley Bars",
      "Nestlé Drumstick Cones",
      "Oyster Bay, Josh Whites or Ruffino",
      "Seattle's Best Coffee",
      "Any 1 HappyBaby Yogis 1-oz or HappyTot Bestie Bars 3.7-oz",
      "Any 2 Stacy's or Sabra Items",
      "Any 2 Core Power 26 or 42-g",
      "Azo",
      "Belvita Breakfast Biscuits",
      "Blue Lizard Sun Care Products",
      "Boogie Baby Products",
      "Breathe Right",
      "California Pizza Kitchen Pizza",
      "Centrum",
      "Crest 3DWhitestrips Dental Whitening Kit",
      "Dial Foaming Hand Wash",
      "Donuts, 6-Count",
      "El Monterey Burritos",
      "Eveready Readyflex LED Floating Lantern",
      "Febreze Trash Odor Fighter Starter Kit",
      "Gatorlyte Electrolyte Beverage",
      "Harry's Razor Handle",
      "Hefty Press to Close Bags",
      "Liquid Death Mountain Water",
      "Listerine",
      "Magic Mind Shots",
      "Mr. Clean Clean Freak Multi-Purpose Cleaner",
      "Nabisco Wheat Thins Snacks",
      "Nerds Gummy Clusters",
      "Oral-B Toothbrush, or Floss or Floss Picks",
      "Publix Children's Profen IB",
      "Publix Deli Ultimate Sub",
      "Q-tips",
      "Revlon Colorsilk",
      "Sargento Balanced Breaks Snack",
      "Solo Plastic Cups",
      "Sparkling Ice",
      "State Fair Corn Dogs",
      "Stem Insecticides",
      "Therabreath Oral or Mouth Rinse",
      "Traeger Premium Hardwood Pellets",
      "Tuscanini Pizza",
      "Vitafusion or L'il Critters",
      "Wise Cheez Doodles Corn Snacks",
    ];
    for (const title of leftoverAfterHeal20260910) {
      expect(isWeeklyAdJunkProduct(title), title).toBe(true);
    }
    const leftoverAfterHeal20260913 = [
      "Cottonelle",
      "Dial",
      "Keebler Caddy",
      "Kevin's Meals",
      "Ziploc",
      "Dash of That® Silicone Oven Mitt",
      "GoodCook® Bakeware",
      'GoodCook® Everyday Ceramic Nonstick 3-Quart Sauce Pan or 11" Griddle',
      "Any 2 Happy Family Pouches",
      "Bakerly Crepes",
      "Patak's Meal",
      "Chomp Chomplings Sticks",
      "Del Monte Fruit Cups",
      "Del Monte Fruit Naturals Snacks",
      "Dole Açai Bowl",
      "Gogo Dairy Protein Dairy Snack On The Go",
      "GreenWise Organic Fruit Chews",
      "GreenWise Organic Cranberry Nut Mix",
      "GreenWise Organic Tea",
      "GT's Alive Ancient Mushroom Elixir",
      "Gutzy Fruitpods",
      "Odom's Tennessee Pride Sandwiches",
      "Oh Snap! Snacks",
      "Ritz Cracker Sandwiches",
      "Red Rose 100-ct. or Black Decaf Tea 48-ct.",
      "Scott & Jon's Bowl",
      "Blue Zones Kitchen Bowl",
      "Summ! Items",
      "Super Coffee Protein Enhanced Coffee Shake",
      "Café El Aguila Espresso Coffee",
      "Tazo Tea",
      "Uncle Matt's Organic Superfruit Punch",
      "Publix Sweetener With Sucralose",
      "Chocolate and Almond Bretzel Pastry",
    ];
    for (const title of leftoverAfterHeal20260913) {
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
    expect(isWeeklyAdJunkProduct("Priano Gnocchi")).toBe(false);
    expect(isWeeklyAdJunkProduct("Specially Selected Brioche Burger Buns")).toBe(false);
    expect(isWeeklyAdJunkProduct("Fresh Black Angus Chuck Roast")).toBe(false);
    expect(isWeeklyAdJunkProduct("Park Street Deli Assorted Fresh Guacamole")).toBe(false);
    expect(isWeeklyAdJunkProduct("Burman's Assorted BBQ Sauce")).toBe(false);
    expect(isWeeklyAdJunkProduct("Cantaloupe")).toBe(false);
    expect(isWeeklyAdJunkProduct("Simply Nature Organic 90 Second Grains")).toBe(false);
    expect(isWeeklyAdJunkProduct("Almond Breeze or Planet Oat")).toBe(false);
    expect(isWeeklyAdJunkProduct("Beyond Plant-Based Product")).toBe(false);
    expect(isWeeklyAdJunkProduct("GreenWise Organic Spices")).toBe(false);
    expect(isWeeklyAdJunkProduct("Ball Park Hot Dog Buns")).toBe(false);
    expect(isWeeklyAdJunkProduct("Emporium Selection Deli-Sliced Havarti or Gouda")).toBe(
      false,
    );
    expect(isWeeklyAdJunkProduct("Park Street Deli Sirloin Tips in Gravy")).toBe(false);
    expect(isWeeklyAdJunkProduct("Fresh Guajillo Roast")).toBe(false);
    expect(isWeeklyAdJunkProduct("Green Giant Boxed Vegetables")).toBe(false);
    expect(isWeeklyAdJunkProduct("Food Lion Broth")).toBe(false);
    expect(isWeeklyAdJunkProduct("Hanover Beans")).toBe(false);
    expect(isWeeklyAdJunkProduct("Lipton Iced Tea Family Size")).toBe(false);
    expect(isWeeklyAdJunkProduct("Pretzilla Soft Pretzel Burger Buns")).toBe(false);
    expect(isWeeklyAdJunkProduct("Bays English Muffins")).toBe(false);
    expect(
      isWeeklyAdJunkProduct("Newman's Own Pizza or Farm Rich Meatballs"),
    ).toBe(false);
    expect(isWeeklyAdJunkProduct("Sabra Guacamole")).toBe(false);
    expect(isWeeklyAdJunkProduct("Italian Pizza Dough")).toBe(false);
    expect(isWeeklyAdJunkProduct("Simple Mills Gluten Free Pizza Dough")).toBe(false);
    expect(isWeeklyAdJunkProduct("Gorton's Fish Sticks or Fillets")).toBe(false);
    expect(isWeeklyAdJunkProduct("Foster Farms Take Out Crispy Wings")).toBe(false);
    expect(isWeeklyAdJunkProduct("GreenWise Organic Coffee")).toBe(false);
    expect(isWeeklyAdJunkProduct("Thomas' English Muffins")).toBe(false);
    expect(isWeeklyAdJunkProduct("Publix Smoked Ribs")).toBe(false);
    expect(isWeeklyAdJunkProduct("Whole Brisket")).toBe(false);
    expect(isWeeklyAdJunkProduct("Oscar Mayer Meat Wieners")).toBe(false);
    expect(isWeeklyAdJunkProduct("Lipton Cold Brew Tea Family Size")).toBe(false);
    expect(isWeeklyAdJunkProduct("Bear Creek Soup Mix")).toBe(false);
    expect(isWeeklyAdJunkProduct("Everyday Gourmet Quiche")).toBe(false);
    expect(isWeeklyAdJunkProduct("Dockside Classics")).toBe(false);
    expect(isWeeklyAdJunkProduct("Hormel Gatherings Snack Tray Lunch Meats")).toBe(
      false,
    );
    expect(isWeeklyAdJunkProduct("Pretzilla Soft Pretzel Bites")).toBe(false);
    expect(isWeeklyAdJunkProduct("GreenWise Puff Pastry Sheets")).toBe(false);
    expect(isWeeklyAdJunkProduct("Spam")).toBe(false);
    expect(isWeeklyAdJunkProduct("Large Papaya")).toBe(false);
    expect(isWeeklyAdJunkProduct("Sweet Tamarind")).toBe(false);
    expect(isWeeklyAdJunkProduct("Top Sirloin Fillet")).toBe(false);
    expect(isWeeklyAdJunkProduct("Whole Top Sirloin")).toBe(false);
    expect(isWeeklyAdJunkProduct("Mrs. Paul's Frozen Seafood")).toBe(false);
  });

  it("skips 2026-09-16 owner-queue GM, drink, and personal-care leftovers", () => {
    const leftoverOwnerQueue20260916 = [
      'Troy-Bilt 547cc Bronco 46" Gas Riding Lawn Mower, 13A878BTA66',
      "Blackstone Original Outdoor Griddle, 36 Inch 4-Burner Flat Top Grill with Hood, Black",
      "Momcozy Portable Water Warmer & Bottle Warmer MW05, Light Pink",
      "Ozark Trail Stainless Steel Wood-Burning Camp Fire Pit",
      "Delta Children Epic 3 Drawer Dresser with Interlocking Drawers, Chestnut",
      "Beautiful 6 Qt Tilt-Head Stand Mixer with Dough Hook, Flat Beater, Balloon Whisk, Pastry Beater & Slicer/Shredder Set, White Icing by Drew Barrymore",
      "Beautiful 5.3 Qt Stand Mixer, White Icing with Flat Beater, Dough Hook, Balloon Whisk",
      "Delta Children Essex 3 Drawer Dresser with Interlocking Drawers - Greenguard Gold Certified, Bianca White/Natural",
      'Ozark Trail 15" Stainless Steel Collapsible Smokeless Wood-Burning Camp Fire Pit with Carry Bag',
      'Muskoka 19.5" Stainless Steel Smokeless Wood Burning Fire Pit with Protective Cover',
      "Christopher Knight Home Vintage Nightstand with Pattern Carved Drawer, Skirted Bedside Table, Dark Brown",
      "Hatteras Nightstand with 1 Drawer and Open Shelf Storage, Natural – Teamson Home: Deep Drawer and Coastal Modern Style",
      "Ozark Trail 12' x 12' Gray Instant Straight Leg Camping Canopy",
      "Hisense R632 3.1 Channel 380W Soundbar with Wireless Subwoofer with Dolby Atmos, DTS:X, Easy Connect",
      "Delta Children Essex 4-in-1 Convertible Baby Crib - Greenguard Gold Certified, Ebony/Natural",
      "Beautiful 1-Liter Electric Gooseneck Kettle 1200 W, White Icing by Drew Barrymore",
      "Chefman 1L Electric Glass Kettle w/ LED Indicator Light, Automatic Shutoff - Black",
      "Ozark Trail 35°F Rectangular Sleeping Bag with 47% Recycled Polyester and ZIP SHIELD",
      "No Boundaries Women's Faux Leather Moto Shoulder Bag, Doe",
      "PUR 8-Cup Slim Water Filter Pitcher for Fridge, Sandstone, PPT600F",
      "Beautiful 3-Compartment Bamboo Melamine Sardine Serve Tray by Drew Barrymore",
      "Carter's Child of Mine Baby Girl Jumpsuit, One-Piece",
      "Wonder So Soft Modal by Wonder Nation Baby Boys Bodysuit and Pants Set, 2-Piece",
      "Dole Fruit Bowls",
      "C4 Energy",
      "SuperPretzel Snacks",
      "Tastiez Frozen Snacks",
      "Bai WonderWater",
      "Stauffer's Snaps",
      "Guayaki Organic Yerba Mate",
      "Dawn Dishwashing Liquid",
      "Tresemmé Root Touch Up or Styling Products",
      "styling products",
      "tresemm root touch up",
      "Dove Bath Bars",
      "Clairol Nice'N Easy Hair Color",
      "Clairol Frost & Tip Blonde Highlights",
      "Clairol Natural Instincts Hair Color",
      "12-Pack Guaraná Antarctica Soft Drinks",
      "Publix Malta Malt Beverage",
      "Boston Market Home Style Meals",
      "Bertolli Skillet Meals",
      "12-Pack Bitburger Premium Pilsner",
      "Mighty Spark Mini Stick",
    ];
    for (const title of leftoverOwnerQueue20260916) {
      expect(isWeeklyAdJunkProduct(title), title).toBe(true);
    }
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

describe("looksLikeNonFoodMerchandise", () => {
  it("catches unseen SKUs by product class, not the pasted model number", () => {
    expect(
      looksLikeNonFoodMerchandise("Harbor 4 Drawer Nightstand, Oak"),
    ).toBe(true);
    expect(
      looksLikeNonFoodMerchandise("YardMax 420cc Riding Mower, Model ZX9912AB"),
    ).toBe(true);
    expect(
      looksLikeNonFoodMerchandise("Acme 5.1 Channel 600W Home Theater Soundbar"),
    ).toBe(true);
    expect(looksLikeNonFoodMerchandise("Greenguard Gold Kids Crib, White")).toBe(
      true,
    );
    expect(looksLikeNonFoodMerchandise("Harbor Recliner, Gray")).toBe(true);
    expect(looksLikeNonFoodMerchandise("Trailhead 4-Person Camping Tent")).toBe(
      true,
    );
  });

  it("does not treat dinner foods as merchandise", () => {
    expect(looksLikeNonFoodMerchandise("McCormick Grill Mates Seasoning")).toBe(
      false,
    );
    expect(looksLikeNonFoodMerchandise("GreenWise Organic Baby Spinach")).toBe(
      false,
    );
    expect(looksLikeNonFoodMerchandise("Kraft Salad Dressing")).toBe(false);
    expect(looksLikeNonFoodMerchandise("Lipton Iced Tea Family Size")).toBe(
      false,
    );
    expect(looksLikeNonFoodMerchandise("Ball Park Hot Dogs")).toBe(false);
    expect(looksLikeNonFoodMerchandise("Spam")).toBe(false);
    expect(looksLikeNonFoodMerchandise("Large Papaya")).toBe(false);
    expect(looksLikeNonFoodMerchandise("Top Sirloin Fillet")).toBe(false);
    expect(
      looksLikeNonFoodMerchandise("Farmland Chicken Breast Pack ABC99Z"),
    ).toBe(false);
  });
});
