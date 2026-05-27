const WEEKLY_AD_MATCH_REJECT_PATTERNS: Record<string, RegExp[]> = {
  "baby-potatoes": [/chips/i, /crisps/i, /snack/i],
  butter: [/peanut butter/i, /almond butter/i, /cashew butter/i],
  lemon: [/lemonade/i],
  lime: [/limeade/i],
  spaghetti: [/noodle soup/i],
  "chicken-thighs": [/breast/i, /tenderloin/i, /wing/i, /drumstick/i],
  "chicken-breast": [/thigh/i, /drumstick/i, /wing/i],
  "ground-beef": [/broth/i, /stock/i, /jerky/i, /corned beef/i, /beef patty/i],
  "ground-turkey": [/broth/i, /stock/i, /jerky/i, /turkey bacon/i, /turkey breast whole/i],
  eggs: [/egg nog/i, /egg noodle/i, /easter/i, /chocolate/i, /substitute/i],
  "yellow-onion": [
    /onion ring/i,
    /onion powder/i,
    /french onion/i,
    /green onion/i,
    /scallion/i,
  ],
  garlic: [/garlic bread/i, /garlic powder/i, /garlic salt/i],
  "canned-tomatoes": [/tomato paste/i, /ketchup/i, /pizza sauce/i, /pasta sauce/i, /marinara/i],
  carrots: [/carrot cake/i, /baby food/i, /juice/i],
  "cheddar-cheese": [/mac and cheese/i, /cracker/i, /spread/i],
  "whole-milk": [
    /almond milk/i,
    /oat milk/i,
    /coconut milk/i,
    /soy milk/i,
    /chocolate milk/i,
    /evaporated/i,
    /condensed/i,
  ],
  "green-beans": [/coffee/i, /jelly/i, /bean bag chair/i],
  "pasta-sauce": [/pizza sauce/i],
  "chicken-broth": [/gravy/i, /beef broth/i, /beef stock/i, /vegetable broth/i],
  "pinto-beans": [/refried beans/i, /bean dip/i],
  chickpeas: [/hummus/i, /falafel/i],
  "flour-tortillas": [/tortilla chips/i, /tostada/i, /hard shell/i],
  "penne-pasta": [/mac and cheese/i, /noodle soup/i, /spaghetti/i],
  "roma-tomatoes": [
    /tomato paste/i,
    /ketchup/i,
    /pizza sauce/i,
    /pasta sauce/i,
    /marinara/i,
    /diced tomatoes/i,
    /crushed tomatoes/i,
    /sun-dried/i,
  ],
  zucchini: [/zucchini bread/i, /zucchini noodles/i],
  mushrooms: [/mushroom soup/i, /mushroom gravy/i, /stuffed mushroom/i],
  "italian-sausage": [
    /breakfast sausage/i,
    /smoked sausage/i,
    /kielbasa/i,
    /bratwurst/i,
    /sausage patty/i,
  ],
  "sour-cream": [/onion dip/i, /potato chip/i, /sour cream and onion/i],
  mozzarella: [/string cheese/i, /cheese stick snack/i],
};

export function shouldRejectWeeklyAdIngredientMatch(input: {
  ingredientId: string;
  productName: string;
}) {
  const patterns = WEEKLY_AD_MATCH_REJECT_PATTERNS[input.ingredientId] ?? [];
  return patterns.some((pattern) => pattern.test(input.productName));
}
