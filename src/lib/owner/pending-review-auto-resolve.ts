import type { IngredientCategory } from "@/lib/ingredient-category";
import { titleCaseIngredientName } from "@/lib/ingredient-id";

export type PendingReviewPlan =
  | {
      action: "yes";
      ingredientId: string;
      ingredientName: string;
      category: IngredientCategory;
      reason: string;
    }
  | { action: "no"; reason: string }
  | { action: "skip"; reason: string };

type YesRule = {
  test: RegExp;
  ingredientId: string;
  ingredientName: string;
  category: IngredientCategory;
  reason: string;
};

/** If the preferred id is missing, reuse a non-brand synonym already in the catalog. */
const ID_FALLBACKS: Record<string, string[]> = {
  peaches: ["peach"],
  cherries: ["cherry"],
  blueberries: ["blueberry"],
  raspberries: ["raspberry"],
  blackberries: ["blackberry"],
  pears: ["pear"],
  plums: ["plum"],
  figs: ["fig"],
  dates: ["medjool-dates"],
  kiwi: ["kiwifruit"],
};

function haystack(rawProductName: string, normalizedLabel?: string): string {
  return `${rawProductName} ${normalizedLabel ?? ""}`
    .toLowerCase()
    .replace(/['’]/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function yes(
  ingredientId: string,
  ingredientName: string,
  category: IngredientCategory,
  reason: string,
): Extract<PendingReviewPlan, { action: "yes" }> {
  return {
    action: "yes",
    ingredientId,
    ingredientName,
    category,
    reason,
  };
}

const NO_RULES: { test: RegExp; reason: string }[] = [
  { test: /\bthomas'? products\b/, reason: "brand line, not a food" },
  { test: /\bpublix vegetables\b/, reason: "too vague" },
  { test: /\bfresh family pack\b/, reason: "too vague" },
  { test: /\bbeyond plant-based product\b/, reason: "too vague" },
  { test: /\bany 1 malk\b/, reason: "brand line, grain unknown" },
  { test: /\ball 16-oz varieties of hot soup\b/, reason: "prepared soup line" },
  { test: /\bnewman'?s own pizza or farm rich\b/, reason: "two foods on one line" },
  { test: /\bghirardelli sauce\b/, reason: "dessert sauce" },
  { test: /\borganic coffee\b|\bcoffee\b/, reason: "coffee is not a dinner ingredient" },
  { test: /\bramen\b/, reason: "ramen cups/soup are skip-list leftovers" },
  { test: /\bbeano'?s condiments\b/, reason: "too vague" },
  { test: /\bgourmet garden stir-in paste\b/, reason: "too vague" },
];

const SKIP_RULES: { test: RegExp; reason: string }[] = [
  { test: /\bplant-based\b|\bplantspired\b/, reason: "plant-based analogue, not the animal food" },
  { test: /\bmushroom burger\b/, reason: "plant burger, not ground beef" },
  { test: /\bpeach watermelon mix\b/, reason: "mixed fruit pack" },
  { test: /\bside dishes?\b|\bamerican classics sides\b|\bside dish\b/, reason: "prepared side, flavor unknown" },
  { test: /\bmeat lasagna\b/, reason: "prepared meal" },
  { test: /\brib meal deal\b/, reason: "combo meal" },
  { test: /\borganic spices\b/, reason: "spice line, not one food" },
  { test: /\bsalad topper\b/, reason: "topping mix" },
  { test: /\bfive layer dip\b|\bveggie dip\b|\bsmoked dip\b|\bmrs\.? peter'?s dips\b|\belote dip\b/, reason: "dip flavor unknown" },
  { test: /\bmae ploy sauce\b|\bmaya kaimal sauce\b|\byo mama'?s sauce\b|\bchick-fil-a sauce\b/, reason: "sauce flavor unknown" },
  { test: /\brao'?s slow simmered soup\b/, reason: "prepared soup" },
  { test: /\bfromage ami chutney\b/, reason: "condiment line" },
];

const YES_RULES: YesRule[] = [
  { test: /\bsteak house dressing\b|\bsalad dressing\b|\branch salad dressing\b|\bdressing & dip\b|\bsqueeze bottle dressing\b|\bclassic ranch\b|\bken'?s steak house/, ingredientId: "salad-dressing", ingredientName: "Salad dressing", category: "pantry", reason: "bottled dressing" },
  { test: /\ba\.?1\.?\b|\ba1 steak sauce\b|\bchimichurri steak sauce\b|\bsteak sauce\b/, ingredientId: "steak-sauce", ingredientName: "Steak sauce", category: "pantry", reason: "steak sauce" },
  { test: /\bbbq sauce\b|\bbarbeque sauce\b|\bbarbecue sauce\b/, ingredientId: "barbeque-sauce", ingredientName: "Barbeque sauce", category: "pantry", reason: "bbq sauce" },
  { test: /\bpizza sauce\b/, ingredientId: "pasta-sauce", ingredientName: "Pasta sauce", category: "pantry", reason: "pizza sauce maps to pasta sauce" },
  { test: /\btaco sauce\b/, ingredientId: "taco-sauce", ingredientName: "Taco sauce", category: "pantry", reason: "taco sauce" },
  { test: /\bpizza dough\b/, ingredientId: "pizza-dough", ingredientName: "Pizza dough", category: "pantry", reason: "pizza dough" },
  { test: /\bgnocchi\b/, ingredientId: "gnocchi", ingredientName: "Gnocchi", category: "pantry", reason: "gnocchi" },
  { test: /\benglish muffins?\b/, ingredientId: "english-muffin", ingredientName: "English muffin", category: "pantry", reason: "english muffin" },
  { test: /\bbagels?\b/, ingredientId: "bagels", ingredientName: "Bagels", category: "pantry", reason: "bagels" },
  { test: /\bhot dog buns\b|\bburger buns\b|\bbrioche buns\b|\bpretzel burger buns\b|\bpretzel bites\b/, ingredientId: "buns", ingredientName: "Buns", category: "pantry", reason: "buns" },
  { test: /\bdinner rolls\b|\bslider rolls\b|\bartesano rolls\b/, ingredientId: "dinner-rolls", ingredientName: "Dinner rolls", category: "pantry", reason: "rolls" },
  { test: /\bwaffles?\b|\beggo\b/, ingredientId: "waffles", ingredientName: "Waffles", category: "frozen", reason: "waffles" },
  { test: /\bsandwich thins\b/, ingredientId: "bread-loaf", ingredientName: "Sandwich bread", category: "pantry", reason: "sandwich thins" },
  { test: /\bnaan\b/, ingredientId: "naan", ingredientName: "Naan", category: "pantry", reason: "naan" },
  { test: /\broti\b/, ingredientId: "roti", ingredientName: "Roti", category: "pantry", reason: "roti" },
  { test: /\bpuff pastry\b/, ingredientId: "puff-pastry", ingredientName: "Puff pastry", category: "frozen", reason: "puff pastry" },
  { test: /\bcoleslaw\b/, ingredientId: "cabbage", ingredientName: "Green cabbage", category: "produce", reason: "coleslaw is cabbage" },
  { test: /\bromaine\b|\bsalad blend/, ingredientId: "lettuce", ingredientName: "Lettuce", category: "produce", reason: "leaf salad" },
  { test: /\bsalad bowls?\b|\bsalad kits?\b|\bchopped salads?\b|\bcaesar salad\b|\bchopped ranch salad\b|\bgarden salad\b|\bchef salad\b|\bfresh attitude salads\b/, ingredientId: "lettuce", ingredientName: "Lettuce", category: "produce", reason: "salad kit/bowl" },
  { test: /\bcedar'?s salad\b/, ingredientId: "lettuce", ingredientName: "Lettuce", category: "produce", reason: "salad" },
  { test: /\bwhiting\b/, ingredientId: "white-fish", ingredientName: "White fish", category: "protein", reason: "whiting is white fish" },
  { test: /\bcrab classic/, ingredientId: "imitation-crab", ingredientName: "Imitation crab", category: "protein", reason: "imitation crab" },
  { test: /\bsnow crab\b/, ingredientId: "crab", ingredientName: "Crab", category: "protein", reason: "snow crab" },
  { test: /\bfish sticks or fillets\b|\bfish sticks\b/, ingredientId: "fish-fillet", ingredientName: "Fish fillet", category: "protein", reason: "fish fillet" },
  { test: /\bscallops\b/, ingredientId: "scallops", ingredientName: "Scallops", category: "protein", reason: "scallops" },
  { test: /\bswordfish\b/, ingredientId: "swordfish", ingredientName: "Swordfish", category: "protein", reason: "swordfish" },
  { test: /\bdrumsticks or bone-in thighs\b|\bchicken drumsticks\b/, ingredientId: "chicken-thighs", ingredientName: "Chicken thighs", category: "protein", reason: "chicken dark meat" },
  { test: /\bwings\b/, ingredientId: "chicken-wings", ingredientName: "Chicken wings", category: "protein", reason: "wings" },
  { test: /\bbrisket\b/, ingredientId: "beef-brisket", ingredientName: "Beef brisket", category: "protein", reason: "brisket" },
  { test: /\bground round\b|\bground sirloin\b|\bsmash(?:ed)? burgers\b|\bbeefsteak burger\b|\bmeatloaf burgers\b|\bsteak burgers\b|\bgourmet blend burgers\b/, ingredientId: "ground-beef", ingredientName: "Ground beef", category: "protein", reason: "ground beef / burgers" },
  { test: /\bsirloin tip steaks?\b|\bsirloin tri-tip steaks\b/, ingredientId: "sirloin-steak", ingredientName: "Sirloin steak", category: "protein", reason: "sirloin steak" },
  { test: /\broast\b|\bwhole new york strip\b|\bwhole sirloin tip\b/, ingredientId: "beef-roast", ingredientName: "Beef roast", category: "protein", reason: "beef roast" },
  { test: /\bsteaks?\b/, ingredientId: "beef-steak", ingredientName: "Beef steak", category: "protein", reason: "beef steak" },
  { test: /\bpetite tender\b/, ingredientId: "beef-steak", ingredientName: "Beef steak", category: "protein", reason: "beef steak" },
  { test: /\bmeatballs\b/, ingredientId: "meatballs", ingredientName: "Meatballs", category: "protein", reason: "meatballs" },
  { test: /\bbrats\b/, ingredientId: "bratwurst", ingredientName: "Bratwurst", category: "protein", reason: "brats" },
  { test: /\blit'?l smokies\b/, ingredientId: "smoked-sausage", ingredientName: "Smoked sausage", category: "protein", reason: "smoked sausage" },
  { test: /\bturkey breast\b/, ingredientId: "turkey-breast", ingredientName: "Turkey breast", category: "protein", reason: "turkey breast" },
  { test: /\bbologna\b/, ingredientId: "bologna", ingredientName: "Bologna", category: "protein", reason: "bologna" },
  { test: /\bpepperoni\b/, ingredientId: "pepperoni", ingredientName: "Pepperoni", category: "protein", reason: "pepperoni" },
  { test: /\bprosciutto\b|\bsalami\b|\bcharcuterie\b|\bfine meats trio\b|\bvolpi nuggets\b/, ingredientId: "cured-meat", ingredientName: "Cured meat", category: "protein", reason: "cured meat" },
  { test: /\blunch meats\b/, ingredientId: "sliced-deli-meat", ingredientName: "Sliced deli meat", category: "protein", reason: "lunch meat" },
  { test: /\bsmoked ribs\b/, ingredientId: "pork-ribs", ingredientName: "Pork ribs", category: "protein", reason: "ribs" },
  { test: /\bpotstickers\b/, ingredientId: "potstickers", ingredientName: "Potstickers", category: "frozen", reason: "potstickers" },
  { test: /\bpeaches?\b|\bnectarines?\b/, ingredientId: "peaches", ingredientName: "Peaches", category: "produce", reason: "peaches" },
  { test: /\bkiwi\b/, ingredientId: "kiwi", ingredientName: "Kiwi", category: "produce", reason: "kiwi" },
  { test: /\bwatermelon\b/, ingredientId: "watermelon", ingredientName: "Watermelon", category: "produce", reason: "watermelon" },
  { test: /\bmango\b/, ingredientId: "mango", ingredientName: "Mango", category: "produce", reason: "mango" },
  { test: /\bcherries\b/, ingredientId: "cherries", ingredientName: "Cherries", category: "produce", reason: "cherries" },
  { test: /\bblueberries\b/, ingredientId: "blueberries", ingredientName: "Blueberries", category: "produce", reason: "blueberries" },
  { test: /\bblackberries or red raspberries\b/, ingredientId: "mixed-berries", ingredientName: "Mixed berries", category: "produce", reason: "berry or-pack" },
  { test: /\braspberries\b/, ingredientId: "raspberries", ingredientName: "Raspberries", category: "produce", reason: "raspberries" },
  { test: /\bpears?\b/, ingredientId: "pears", ingredientName: "Pears", category: "produce", reason: "pears" },
  { test: /\bplums?\b/, ingredientId: "plums", ingredientName: "Plums", category: "produce", reason: "plums" },
  { test: /\bfigs\b/, ingredientId: "figs", ingredientName: "Figs", category: "produce", reason: "figs" },
  { test: /\bdates\b/, ingredientId: "dates", ingredientName: "Dates", category: "pantry", reason: "dates" },
  { test: /\bdragon fruit\b/, ingredientId: "dragon-fruit", ingredientName: "Dragon fruit", category: "produce", reason: "dragon fruit" },
  { test: /\bpomegranates\b/, ingredientId: "pomegranate", ingredientName: "Pomegranate", category: "produce", reason: "pomegranate" },
  { test: /\bmandarins\b/, ingredientId: "mandarins", ingredientName: "Mandarins", category: "produce", reason: "mandarins" },
  { test: /\btangelos\b/, ingredientId: "tangelos", ingredientName: "Tangelos", category: "produce", reason: "tangelos" },
  { test: /\bcauliflower\b/, ingredientId: "cauliflower", ingredientName: "Cauliflower", category: "produce", reason: "cauliflower" },
  { test: /\bfrench beans\b/, ingredientId: "green-beans", ingredientName: "Green beans", category: "produce", reason: "green beans" },
  { test: /\bnibblers\b/, ingredientId: "corn-on-the-cob", ingredientName: "Corn on the cob", category: "produce", reason: "mini corn" },
  { test: /\bsweet corn\b|\bbulk sweet corn\b/, ingredientId: "sweetcorn", ingredientName: "Sweetcorn", category: "produce", reason: "sweet corn" },
  { test: /\bboxed vegetables\b|\bvegetable stir fry\b/, ingredientId: "mixed-vegetables", ingredientName: "Mixed vegetables", category: "produce", reason: "vegetable mix" },
  { test: /\bpickles\b/, ingredientId: "pickles", ingredientName: "Pickles", category: "pantry", reason: "pickles" },
  { test: /\byogurt\b|\byoghurt\b/, ingredientId: "plain-yogurt", ingredientName: "Plain yogurt", category: "dairy", reason: "yogurt" },
  { test: /\btzatziki\b/, ingredientId: "tzatziki", ingredientName: "Tzatziki", category: "dairy", reason: "tzatziki" },
  { test: /\bguacamole\b/, ingredientId: "guacamole", ingredientName: "Guacamole", category: "produce", reason: "guacamole" },
  { test: /\bqueso blanco\b/, ingredientId: "queso", ingredientName: "Queso", category: "dairy", reason: "queso" },
  { test: /\bpesto\b/, ingredientId: "pesto", ingredientName: "Pesto", category: "pantry", reason: "pesto" },
  { test: /\bkimchi\b/, ingredientId: "kimchi", ingredientName: "Kimchi", category: "pantry", reason: "kimchi" },
  { test: /\bgreen chiles\b/, ingredientId: "green-chiles", ingredientName: "Green chiles", category: "produce", reason: "green chiles" },
  { test: /\baba ghannouge\b|\bbaba ganoush\b/, ingredientId: "baba-ganoush", ingredientName: "Baba ganoush", category: "pantry", reason: "baba ganoush" },
  { test: /\baioli\b/, ingredientId: "aioli", ingredientName: "Aioli", category: "pantry", reason: "aioli" },
  { test: /\bmatzo ball & soup mix\b|\bsoup mix\b/, ingredientId: "soup-mix", ingredientName: "Soup mix", category: "pantry", reason: "soup mix" },
  { test: /\bbone broth\b/, ingredientId: "bone-broth", ingredientName: "Bone broth", category: "pantry", reason: "bone broth" },
  { test: /\bbroth\b/, ingredientId: "chicken-broth", ingredientName: "Chicken broth", category: "pantry", reason: "broth" },
  { test: /\biced tea\b/, ingredientId: "iced-tea", ingredientName: "Iced tea", category: "pantry", reason: "iced tea" },
  { test: /\bgrill mates\b/, ingredientId: "grill-mates-seasoning", ingredientName: "Grill seasoning", category: "seasoning", reason: "grill mates" },
  { test: /\bweber seasoning\b/, ingredientId: "grill-seasoning", ingredientName: "Grill seasoning", category: "seasoning", reason: "grill seasoning" },
  { test: /\bflaxseed meal\b/, ingredientId: "flaxseed-meal", ingredientName: "Flaxseed meal", category: "baking", reason: "flaxseed" },
  { test: /\bpistachios\b/, ingredientId: "pistachios", ingredientName: "Pistachios", category: "pantry", reason: "pistachios" },
];

function resolveTargetId(preferred: string, existingIds?: Set<string>): string {
  if (!existingIds || existingIds.size === 0) {
    return preferred;
  }
  if (existingIds.has(preferred)) {
    return preferred;
  }
  for (const alt of ID_FALLBACKS[preferred] ?? []) {
    if (existingIds.has(alt)) {
      return alt;
    }
  }
  return preferred;
}

/**
 * Conservative Yes/No/Skip plan for leftover /owner grocery rows.
 * Default is skip. Does not encode brands in new ids.
 */
export function planPendingReviewResolution(
  rawProductName: string,
  options?: { normalizedLabel?: string; existingIds?: Set<string> },
): PendingReviewPlan {
  const text = haystack(rawProductName, options?.normalizedLabel);
  if (!text) {
    return { action: "skip", reason: "empty title" };
  }

  for (const rule of NO_RULES) {
    if (rule.test.test(text)) {
      return { action: "no", reason: rule.reason };
    }
  }
  for (const rule of SKIP_RULES) {
    if (rule.test.test(text)) {
      return { action: "skip", reason: rule.reason };
    }
  }
  for (const rule of YES_RULES) {
    if (rule.test.test(text)) {
      const ingredientId = resolveTargetId(rule.ingredientId, options?.existingIds);
      return yes(
        ingredientId,
        ingredientId === rule.ingredientId
          ? rule.ingredientName
          : titleCaseIngredientName(ingredientId.replace(/-/g, " ")),
        rule.category,
        rule.reason,
      );
    }
  }

  return { action: "skip", reason: "no conservative mapping" };
}
