export type StoreKind = "grocery" | "big-box" | "specialty" | "dollar-market";

export type MockStore = {
  id: string;
  name: string;
  kind: StoreKind;
  city: string;
  state: string;
  latitude: number;
  longitude: number;
};

export type MockIngredient = {
  id: string;
  name: string;
  category: "protein" | "produce" | "pantry" | "dairy";
};

export type MockRecipeIngredient = {
  ingredientId: string;
  displayName: string;
  quantityNote: string;
};

export type MockRecipeRecord = {
  id: string;
  title: string;
  summary: string;
  cookTimeMinutes: number;
  difficulty: "easy" | "medium";
  tags: string[];
  dietaryTags: Array<"vegetarian" | "vegan" | "quick">;
  ingredients: MockRecipeIngredient[];
  steps: string[];
};

export type MockPriceObservation = {
  storeId: string;
  ingredientId: string;
  price: number;
  saleLabel?: string;
  freshnessDaysAgo: number;
  inStock: boolean;
  priceSource?: string;
  matchConfidence?: number;
};

export const mockStores: MockStore[] = [
  {
    id: "kroger-mechanicsville",
    name: "Kroger",
    kind: "grocery",
    city: "Mechanicsville",
    state: "VA",
    latitude: 37.6153,
    longitude: -77.3491,
  },
  {
    id: "food-lion-mechanicsville",
    name: "Food Lion",
    kind: "grocery",
    city: "Mechanicsville",
    state: "VA",
    latitude: 37.6095,
    longitude: -77.3736,
  },
  {
    id: "publix-atlee",
    name: "Publix",
    kind: "grocery",
    city: "Mechanicsville",
    state: "VA",
    latitude: 37.6458,
    longitude: -77.3989,
  },
  {
    id: "aldi-mechanicsville",
    name: "Aldi",
    kind: "grocery",
    city: "Mechanicsville",
    state: "VA",
    latitude: 37.6362,
    longitude: -77.3606,
  },
  {
    id: "walmart-rocketts",
    name: "Walmart Supercenter",
    kind: "big-box",
    city: "Richmond",
    state: "VA",
    latitude: 37.5275,
    longitude: -77.3523,
  },
  {
    id: "lidl-laburnum",
    name: "Lidl",
    kind: "grocery",
    city: "Richmond",
    state: "VA",
    latitude: 37.5426,
    longitude: -77.3588,
  },
  {
    id: "trader-joes-short-pump",
    name: "Trader Joe's",
    kind: "specialty",
    city: "Richmond",
    state: "VA",
    latitude: 37.6506,
    longitude: -77.618,
  },
  {
    id: "dollar-general-market-highland",
    name: "Dollar General Market",
    kind: "dollar-market",
    city: "Highland Springs",
    state: "VA",
    latitude: 37.5458,
    longitude: -77.3278,
  },
];

export const mockIngredients: MockIngredient[] = [
  { id: "chicken-thighs", name: "Chicken thighs", category: "protein" },
  { id: "baby-potatoes", name: "Baby potatoes", category: "produce" },
  { id: "broccoli", name: "Broccoli", category: "produce" },
  { id: "lemon", name: "Lemon", category: "produce" },
  { id: "olive-oil", name: "Olive oil", category: "pantry" },
  { id: "black-beans", name: "Black beans", category: "pantry" },
  { id: "corn-tortillas", name: "Corn tortillas", category: "pantry" },
  { id: "cabbage", name: "Green cabbage", category: "produce" },
  { id: "lime", name: "Lime", category: "produce" },
  { id: "spaghetti", name: "Spaghetti", category: "pantry" },
  { id: "spinach", name: "Spinach", category: "produce" },
  { id: "parmesan", name: "Parmesan", category: "dairy" },
  { id: "butter", name: "Butter", category: "dairy" },
  { id: "tofu", name: "Extra-firm tofu", category: "protein" },
  { id: "jasmine-rice", name: "Jasmine rice", category: "pantry" },
  { id: "bell-peppers", name: "Bell peppers", category: "produce" },
  { id: "soy-sauce", name: "Soy sauce", category: "pantry" },
  { id: "green-onion", name: "Green onion", category: "produce" },
  { id: "ground-beef", name: "Ground beef", category: "protein" },
  { id: "chicken-breast", name: "Chicken breast", category: "protein" },
  { id: "ground-turkey", name: "Ground turkey", category: "protein" },
  { id: "yellow-onion", name: "Yellow onion", category: "produce" },
  { id: "garlic", name: "Garlic", category: "pantry" },
  { id: "carrots", name: "Carrots", category: "produce" },
  { id: "green-beans", name: "Green beans", category: "produce" },
  { id: "eggs", name: "Eggs", category: "dairy" },
  { id: "cheddar-cheese", name: "Cheddar cheese", category: "dairy" },
  { id: "whole-milk", name: "Whole milk", category: "dairy" },
  { id: "pasta-sauce", name: "Pasta sauce", category: "pantry" },
  { id: "canned-tomatoes", name: "Canned tomatoes", category: "pantry" },
  { id: "chicken-broth", name: "Chicken broth", category: "pantry" },
  { id: "pinto-beans", name: "Pinto beans", category: "pantry" },
  { id: "chickpeas", name: "Chickpeas", category: "pantry" },
  { id: "flour-tortillas", name: "Flour tortillas", category: "pantry" },
  { id: "penne-pasta", name: "Penne pasta", category: "pantry" },
  { id: "roma-tomatoes", name: "Roma tomatoes", category: "produce" },
  { id: "zucchini", name: "Zucchini", category: "produce" },
  { id: "mushrooms", name: "Mushrooms", category: "produce" },
  { id: "italian-sausage", name: "Italian sausage", category: "protein" },
  { id: "sour-cream", name: "Sour cream", category: "dairy" },
  { id: "mozzarella", name: "Mozzarella", category: "dairy" },
];

export const mockRecipes: MockRecipeRecord[] = [
  {
    id: "sheet-pan-lemon-chicken",
    title: "Sheet Pan Lemon Chicken and Vegetables",
    summary:
      "A low-mess sheet pan dinner that keeps prep simple while still feeling like a full weeknight meal.",
    cookTimeMinutes: 35,
    difficulty: "easy",
    tags: ["quick", "family", "single-store friendly"],
    dietaryTags: [],
    ingredients: [
      { ingredientId: "chicken-thighs", displayName: "Chicken thighs", quantityNote: "1.5 lb" },
      { ingredientId: "baby-potatoes", displayName: "Baby potatoes", quantityNote: "1 bag" },
      { ingredientId: "broccoli", displayName: "Broccoli florets", quantityNote: "2 heads" },
      { ingredientId: "lemon", displayName: "Lemon", quantityNote: "1" },
      { ingredientId: "olive-oil", displayName: "Olive oil", quantityNote: "1 bottle" },
    ],
    steps: [
      "Roast the potatoes first so they get a head start before the chicken goes in.",
      "Toss chicken and broccoli with lemon and oil, then finish everything on one pan.",
      "Serve straight from the pan for an easy cleanup night.",
    ],
  },
  {
    id: "black-bean-tacos",
    title: "Black Bean Tacos with Lime Slaw",
    summary:
      "A flexible taco night option with pantry-friendly beans and a fresh slaw that still stays budget aware.",
    cookTimeMinutes: 25,
    difficulty: "easy",
    tags: ["vegetarian", "budget", "multi-store savings"],
    dietaryTags: ["vegetarian", "quick"],
    ingredients: [
      { ingredientId: "black-beans", displayName: "Black beans", quantityNote: "2 cans" },
      { ingredientId: "corn-tortillas", displayName: "Corn tortillas", quantityNote: "1 pack" },
      { ingredientId: "cabbage", displayName: "Cabbage", quantityNote: "1/2 head" },
      { ingredientId: "lime", displayName: "Lime", quantityNote: "2" },
      { ingredientId: "olive-oil", displayName: "Olive oil", quantityNote: "1 bottle" },
    ],
    steps: [
      "Warm the beans with pantry seasoning while the tortillas heat in a dry skillet.",
      "Toss shredded cabbage with lime and oil for a quick slaw.",
      "Layer beans and slaw into tortillas and serve immediately.",
    ],
  },
  {
    id: "garlic-butter-pasta",
    title: "Garlic Butter Pasta with Spinach",
    summary:
      "A pantry-heavy pasta dinner that works well when the user needs something fast, low-cost, and familiar.",
    cookTimeMinutes: 20,
    difficulty: "easy",
    tags: ["quick", "vegetarian", "pantry-heavy"],
    dietaryTags: ["vegetarian", "quick"],
    ingredients: [
      { ingredientId: "spaghetti", displayName: "Spaghetti", quantityNote: "1 box" },
      { ingredientId: "spinach", displayName: "Spinach", quantityNote: "1 bag" },
      { ingredientId: "parmesan", displayName: "Parmesan", quantityNote: "1 wedge" },
      { ingredientId: "butter", displayName: "Butter", quantityNote: "1 stick" },
      { ingredientId: "olive-oil", displayName: "Olive oil", quantityNote: "1 bottle" },
    ],
    steps: [
      "Cook the pasta and reserve a little pasta water before draining.",
      "Melt butter with oil, wilt the spinach, and toss with hot pasta.",
      "Finish with parmesan and enough pasta water to make the sauce glossy.",
    ],
  },
  {
    id: "crispy-tofu-rice-bowls",
    title: "Crispy Tofu Rice Bowls",
    summary:
      "A produce-forward bowl with tofu, rice, and vegetables that offers a stronger vegan option with a little more shopping complexity.",
    cookTimeMinutes: 30,
    difficulty: "medium",
    tags: ["vegan", "meal-prep", "produce-heavy"],
    dietaryTags: ["vegan", "quick"],
    ingredients: [
      { ingredientId: "tofu", displayName: "Extra-firm tofu", quantityNote: "2 blocks" },
      { ingredientId: "jasmine-rice", displayName: "Jasmine rice", quantityNote: "1 bag" },
      { ingredientId: "bell-peppers", displayName: "Bell peppers", quantityNote: "3" },
      { ingredientId: "soy-sauce", displayName: "Soy sauce", quantityNote: "1 bottle" },
      { ingredientId: "green-onion", displayName: "Green onion", quantityNote: "1 bunch" },
      { ingredientId: "olive-oil", displayName: "Olive oil", quantityNote: "1 bottle" },
    ],
    steps: [
      "Cook the rice first so the tofu and vegetables can finish while it rests.",
      "Pan-crisp tofu, then stir-fry peppers and green onion with a soy-based sauce.",
      "Build bowls with rice, vegetables, and tofu for a meal-prep friendly dinner.",
    ],
  },
  {
    id: "weeknight-beef-chili",
    title: "Weeknight Beef and Bean Chili",
    summary:
      "A one-pot chili built from ground beef, beans, and pantry staples that stays budget-friendly for busy weeknights.",
    cookTimeMinutes: 40,
    difficulty: "easy",
    tags: ["quick", "family", "budget", "single-store friendly"],
    dietaryTags: [],
    ingredients: [
      { ingredientId: "ground-beef", displayName: "Ground beef", quantityNote: "1 lb" },
      { ingredientId: "pinto-beans", displayName: "Pinto beans", quantityNote: "2 cans" },
      { ingredientId: "canned-tomatoes", displayName: "Canned tomatoes", quantityNote: "2 cans" },
      { ingredientId: "yellow-onion", displayName: "Yellow onion", quantityNote: "1" },
      { ingredientId: "chicken-broth", displayName: "Chicken broth", quantityNote: "2 cups" },
      { ingredientId: "sour-cream", displayName: "Sour cream", quantityNote: "1 tub" },
    ],
    steps: [
      "Brown the ground beef with diced onion until no longer pink.",
      "Stir in canned tomatoes, pinto beans, and chicken broth; simmer until flavors meld.",
      "Serve with optional sour cream once the chili thickens slightly.",
    ],
  },
  {
    id: "italian-sausage-penne",
    title: "Italian Sausage Penne Skillet",
    summary:
      "A skillet pasta dinner that pairs browned sausage with penne, sauce, and melted mozzarella.",
    cookTimeMinutes: 30,
    difficulty: "easy",
    tags: ["quick", "family", "single-store friendly"],
    dietaryTags: [],
    ingredients: [
      { ingredientId: "italian-sausage", displayName: "Italian sausage", quantityNote: "1 lb" },
      { ingredientId: "penne-pasta", displayName: "Penne pasta", quantityNote: "1 box" },
      { ingredientId: "pasta-sauce", displayName: "Pasta sauce", quantityNote: "1 jar" },
      { ingredientId: "mozzarella", displayName: "Mozzarella", quantityNote: "8 oz" },
    ],
    steps: [
      "Brown Italian sausage in a skillet and drain excess fat if needed.",
      "Cook penne until al dente, then toss with pasta sauce and sausage.",
      "Top with mozzarella and cover briefly until the cheese melts.",
    ],
  },
];

export const mockPriceObservations: MockPriceObservation[] = [
  { storeId: "kroger-mechanicsville", ingredientId: "chicken-thighs", price: 6.49, saleLabel: "Weekly deal", freshnessDaysAgo: 1, inStock: true },
  { storeId: "kroger-mechanicsville", ingredientId: "baby-potatoes", price: 2.79, freshnessDaysAgo: 1, inStock: true },
  { storeId: "kroger-mechanicsville", ingredientId: "broccoli", price: 2.39, freshnessDaysAgo: 2, inStock: true },
  { storeId: "kroger-mechanicsville", ingredientId: "lemon", price: 0.89, freshnessDaysAgo: 2, inStock: true },
  { storeId: "kroger-mechanicsville", ingredientId: "olive-oil", price: 2.84, freshnessDaysAgo: 3, inStock: true },
  { storeId: "kroger-mechanicsville", ingredientId: "black-beans", price: 1.09, freshnessDaysAgo: 3, inStock: true },
  { storeId: "kroger-mechanicsville", ingredientId: "corn-tortillas", price: 2.29, freshnessDaysAgo: 4, inStock: true },
  { storeId: "kroger-mechanicsville", ingredientId: "cabbage", price: 2.19, freshnessDaysAgo: 2, inStock: true },
  { storeId: "kroger-mechanicsville", ingredientId: "lime", price: 0.59, freshnessDaysAgo: 2, inStock: true },
  { storeId: "kroger-mechanicsville", ingredientId: "spaghetti", price: 1.59, freshnessDaysAgo: 2, inStock: true },
  { storeId: "kroger-mechanicsville", ingredientId: "spinach", price: 2.49, freshnessDaysAgo: 1, inStock: true },
  { storeId: "kroger-mechanicsville", ingredientId: "parmesan", price: 3.59, freshnessDaysAgo: 3, inStock: true },
  { storeId: "kroger-mechanicsville", ingredientId: "butter", price: 2.79, freshnessDaysAgo: 2, inStock: true },

  { storeId: "food-lion-mechanicsville", ingredientId: "chicken-thighs", price: 6.29, saleLabel: "Weekly special", freshnessDaysAgo: 1, inStock: true },
  { storeId: "food-lion-mechanicsville", ingredientId: "broccoli", price: 2.19, freshnessDaysAgo: 2, inStock: true },
  { storeId: "food-lion-mechanicsville", ingredientId: "baby-potatoes", price: 2.59, freshnessDaysAgo: 2, inStock: true },
  { storeId: "food-lion-mechanicsville", ingredientId: "black-beans", price: 0.99, freshnessDaysAgo: 3, inStock: true },
  { storeId: "food-lion-mechanicsville", ingredientId: "spinach", price: 2.29, freshnessDaysAgo: 1, inStock: true },

  { storeId: "publix-atlee", ingredientId: "chicken-thighs", price: 6.79, saleLabel: "Weekly ad", freshnessDaysAgo: 1, inStock: true },
  { storeId: "publix-atlee", ingredientId: "broccoli", price: 2.49, freshnessDaysAgo: 2, inStock: true },
  { storeId: "publix-atlee", ingredientId: "lemon", price: 0.79, freshnessDaysAgo: 2, inStock: true },
  { storeId: "publix-atlee", ingredientId: "butter", price: 2.89, freshnessDaysAgo: 2, inStock: true },
  { storeId: "publix-atlee", ingredientId: "parmesan", price: 3.49, freshnessDaysAgo: 3, inStock: true },

  { storeId: "aldi-mechanicsville", ingredientId: "black-beans", price: 0.89, saleLabel: "Pantry value", freshnessDaysAgo: 2, inStock: true },
  { storeId: "aldi-mechanicsville", ingredientId: "corn-tortillas", price: 1.79, freshnessDaysAgo: 3, inStock: true },
  { storeId: "aldi-mechanicsville", ingredientId: "cabbage", price: 1.69, freshnessDaysAgo: 2, inStock: true },
  { storeId: "aldi-mechanicsville", ingredientId: "lime", price: 0.45, freshnessDaysAgo: 2, inStock: true },
  { storeId: "aldi-mechanicsville", ingredientId: "olive-oil", price: 2.49, freshnessDaysAgo: 4, inStock: true },
  { storeId: "aldi-mechanicsville", ingredientId: "baby-potatoes", price: 2.39, freshnessDaysAgo: 3, inStock: true },

  { storeId: "walmart-rocketts", ingredientId: "black-beans", price: 0.98, freshnessDaysAgo: 4, inStock: true },
  { storeId: "walmart-rocketts", ingredientId: "corn-tortillas", price: 1.98, freshnessDaysAgo: 4, inStock: true },
  { storeId: "walmart-rocketts", ingredientId: "cabbage", price: 1.88, freshnessDaysAgo: 3, inStock: true },
  { storeId: "walmart-rocketts", ingredientId: "lime", price: 0.5, freshnessDaysAgo: 3, inStock: true },
  { storeId: "walmart-rocketts", ingredientId: "olive-oil", price: 2.68, freshnessDaysAgo: 4, inStock: true },
  { storeId: "walmart-rocketts", ingredientId: "tofu", price: 2.38, freshnessDaysAgo: 3, inStock: true },
  { storeId: "walmart-rocketts", ingredientId: "jasmine-rice", price: 2.72, freshnessDaysAgo: 4, inStock: true },
  { storeId: "walmart-rocketts", ingredientId: "bell-peppers", price: 2.88, freshnessDaysAgo: 2, inStock: true },
  { storeId: "walmart-rocketts", ingredientId: "soy-sauce", price: 2.18, freshnessDaysAgo: 5, inStock: true },
  { storeId: "walmart-rocketts", ingredientId: "green-onion", price: 0.98, freshnessDaysAgo: 2, inStock: true },

  { storeId: "lidl-laburnum", ingredientId: "spaghetti", price: 1.09, freshnessDaysAgo: 2, inStock: true },
  { storeId: "lidl-laburnum", ingredientId: "spinach", price: 1.89, freshnessDaysAgo: 1, inStock: true },
  { storeId: "lidl-laburnum", ingredientId: "parmesan", price: 3.09, freshnessDaysAgo: 3, inStock: true },
  { storeId: "lidl-laburnum", ingredientId: "butter", price: 2.39, freshnessDaysAgo: 2, inStock: true },
  { storeId: "lidl-laburnum", ingredientId: "olive-oil", price: 2.35, freshnessDaysAgo: 4, inStock: true },
  { storeId: "lidl-laburnum", ingredientId: "baby-potatoes", price: 2.29, freshnessDaysAgo: 3, inStock: true },

  { storeId: "trader-joes-short-pump", ingredientId: "tofu", price: 1.99, saleLabel: "Store favorite", freshnessDaysAgo: 1, inStock: true },
  { storeId: "trader-joes-short-pump", ingredientId: "jasmine-rice", price: 2.29, freshnessDaysAgo: 2, inStock: true },
  { storeId: "trader-joes-short-pump", ingredientId: "bell-peppers", price: 2.49, freshnessDaysAgo: 1, inStock: true },
  { storeId: "trader-joes-short-pump", ingredientId: "soy-sauce", price: 1.99, freshnessDaysAgo: 3, inStock: true },
  { storeId: "trader-joes-short-pump", ingredientId: "green-onion", price: 0.89, freshnessDaysAgo: 1, inStock: true },
  { storeId: "trader-joes-short-pump", ingredientId: "olive-oil", price: 2.99, freshnessDaysAgo: 3, inStock: true },

  { storeId: "dollar-general-market-highland", ingredientId: "spaghetti", price: 1.25, freshnessDaysAgo: 5, inStock: true },
  { storeId: "dollar-general-market-highland", ingredientId: "black-beans", price: 1.15, freshnessDaysAgo: 5, inStock: true },
  { storeId: "dollar-general-market-highland", ingredientId: "corn-tortillas", price: 2.15, freshnessDaysAgo: 5, inStock: false },
  { storeId: "dollar-general-market-highland", ingredientId: "olive-oil", price: 2.75, freshnessDaysAgo: 5, inStock: true },
];
