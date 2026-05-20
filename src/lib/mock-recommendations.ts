import type {
  MockPriceObservation,
  MockRecipeRecord,
  MockStore,
} from "@/lib/mock-market-data";
import type { ResolvedZipLocation } from "@/lib/geocoding";
import {
  getMarketDataSnapshot,
  type MarketDataSource,
} from "@/lib/market-repository";

export type MealPreferenceForm = {
  zipCode: string;
  radiusMiles: number;
  budget: number;
  maxIngredients: number;
  dinnersWanted: number;
  shoppingStyle: "single-store" | "multi-store";
  dietaryFocus: "anything" | "vegetarian" | "vegan" | "quick";
};

export type RecipeDifficulty = "easy" | "medium";

export type NearbyStoreSummary = {
  id: string;
  name: string;
  kind: MockStore["kind"];
  distanceMiles: number;
};

export type MarketSummary = {
  searchedZipCode: string;
  locationLabel: string;
  radiusMiles: number;
  nearbyStores: NearbyStoreSummary[];
  lookupSource: ResolvedZipLocation["source"];
  providerConfigured: boolean;
  dataSource: MarketDataSource;
  message: string;
};

export type ShoppingPlanItem = {
  ingredient: string;
  quantityNote: string;
  storeName: string;
  price: number;
  freshnessDaysAgo: number;
  saleLabel?: string;
};

export type StorePlan = {
  storeName: string;
  subtotal: number;
  itemCount: number;
};

export type ScoreBreakdown = {
  total: number;
  price: number;
  convenience: number;
  freshness: number;
  fit: number;
};

export type MealRecommendation = {
  title: string;
  summary: string;
  estimatedTotal: number;
  storeCount: number;
  matchedIngredients: number;
  cookTimeMinutes: number;
  difficulty: RecipeDifficulty;
  primaryStore: string;
  ingredientHighlights: string[];
  instructions: string[];
  shoppingPlan: ShoppingPlanItem[];
  storePlan: StorePlan[];
  score: ScoreBreakdown;
  confidenceLabel: string;
  tags: string[];
  freshnessLabel: string;
  explanation: string;
};

export type RecommendationExperience = {
  market: MarketSummary;
  recommendations: MealRecommendation[];
};

type Candidate = {
  recipe: MockRecipeRecord;
  shoppingPlan: ShoppingPlanItem[];
  estimatedTotal: number;
  score: ScoreBreakdown;
  freshnessLabel: string;
  confidenceLabel: string;
};

export async function getRecommendationExperience(
  preferences: MealPreferenceForm,
  location: ResolvedZipLocation,
  providerConfigured: boolean,
): Promise<RecommendationExperience> {
  const { snapshot, source } = await getMarketDataSnapshot();
  const nearbyStores = getNearbyStores(
    snapshot.stores,
    location,
    preferences.radiusMiles,
  );
  const market = buildMarketSummary(
    preferences,
    nearbyStores,
    location,
    providerConfigured,
    source,
  );

  if (nearbyStores.length === 0) {
    return {
      market,
      recommendations: [],
    };
  }

  const candidates = snapshot.recipes
    .filter((recipe) => byDietaryFocus(recipe, preferences.dietaryFocus))
    .map((recipe) =>
      buildCandidate(recipe, nearbyStores, preferences, snapshot.priceObservations),
    )
    .filter((candidate): candidate is Candidate => candidate !== null)
    .filter((candidate) => candidate.estimatedTotal <= preferences.budget)
    .filter(
      (candidate) =>
        candidate.shoppingPlan.length <= preferences.maxIngredients,
    )
    .sort((left, right) => right.score.total - left.score.total);

  return {
    market,
    recommendations: candidates
      .slice(0, preferences.dinnersWanted)
      .map(toRecommendation),
  };
}

function byDietaryFocus(
  recipe: MockRecipeRecord,
  dietaryFocus: MealPreferenceForm["dietaryFocus"],
) {
  if (dietaryFocus === "anything") {
    return true;
  }

  return recipe.dietaryTags.includes(dietaryFocus);
}

function getNearbyStores(
  stores: MockStore[],
  location: ResolvedZipLocation,
  radiusMiles: number,
): NearbyStoreSummary[] {
  return stores
    .map((store) => ({
      id: store.id,
      name: store.name,
      kind: store.kind,
      distanceMiles: roundDistanceMiles(
        getDistanceMiles(
          location.latitude,
          location.longitude,
          store.latitude,
          store.longitude,
        ),
      ),
    }))
    .filter((store) => store.distanceMiles <= radiusMiles)
    .sort((left, right) => left.distanceMiles - right.distanceMiles);
}

function buildMarketSummary(
  preferences: MealPreferenceForm,
  nearbyStores: NearbyStoreSummary[],
  location: ResolvedZipLocation,
  providerConfigured: boolean,
  dataSource: MarketDataSource,
): MarketSummary {
  const sourceLabel =
    dataSource === "database" ? "local PostgreSQL data" : "seeded in-memory data";
  let message = `Showing ${nearbyStores.length} nearby store(s) within ${preferences.radiusMiles} miles of ${location.city}, ${location.state} using ${sourceLabel}.`;
  if (nearbyStores.length === 0) {
    message = providerConfigured
      ? `We resolved ZIP ${location.zipCode} to ${location.city}, ${location.state}, but no stores from ${sourceLabel} fall inside the current radius. Try a larger radius or a ZIP closer to the local MVP market.`
      : `We resolved ZIP ${location.zipCode} using the local fallback set, but no stores from ${sourceLabel} fall inside the current radius. Add GEOCODIO_API_KEY for live ZIP support outside the seeded local market, or try a larger radius.`;
  }

  return {
    searchedZipCode: preferences.zipCode,
    locationLabel: `${location.city}, ${location.state}`,
    radiusMiles: preferences.radiusMiles,
    nearbyStores,
    lookupSource: location.source,
    providerConfigured,
    dataSource,
    message,
  };
}

function buildCandidate(
  recipe: MockRecipeRecord,
  nearbyStores: NearbyStoreSummary[],
  preferences: MealPreferenceForm,
  priceObservations: MockPriceObservation[],
): Candidate | null {
  const shoppingPlan =
    preferences.shoppingStyle === "single-store"
      ? buildSingleStorePlan(recipe, nearbyStores, priceObservations)
      : buildMultiStorePlan(recipe, nearbyStores, priceObservations);

  if (shoppingPlan.length === 0) {
    return null;
  }

  const estimatedTotal = roundCurrency(
    shoppingPlan.reduce((sum, item) => sum + item.price, 0),
  );

  return {
    recipe,
    shoppingPlan,
    estimatedTotal,
    score: scoreCandidate({
      recipe,
      shoppingPlan,
      preferences,
      estimatedTotal,
    }),
    freshnessLabel: getFreshnessLabel(shoppingPlan),
    confidenceLabel: getConfidenceLabel(shoppingPlan),
  };
}

function buildSingleStorePlan(
  recipe: MockRecipeRecord,
  nearbyStores: NearbyStoreSummary[],
  priceObservations: MockPriceObservation[],
): ShoppingPlanItem[] {
  const candidatePlans = nearbyStores
    .map((store) => {
      const observations = recipe.ingredients.map((ingredient) =>
        getObservationForStore(
          priceObservations,
          store.id,
          ingredient.ingredientId,
        ),
      );
      if (observations.some((observation) => observation === undefined)) {
        return null;
      }

      return recipe.ingredients.map((ingredient, index) =>
        toShoppingPlanItem(
          ingredient.displayName,
          ingredient.quantityNote,
          observations[index]!,
          store.name,
        ),
      );
    })
    .filter((plan): plan is ShoppingPlanItem[] => plan !== null);

  if (candidatePlans.length === 0) {
    return [];
  }

  return candidatePlans.sort(
    (left, right) =>
      left.reduce((sum, item) => sum + item.price, 0) -
      right.reduce((sum, item) => sum + item.price, 0),
  )[0]!;
}

function buildMultiStorePlan(
  recipe: MockRecipeRecord,
  nearbyStores: NearbyStoreSummary[],
  priceObservations: MockPriceObservation[],
): ShoppingPlanItem[] {
  const plan: ShoppingPlanItem[] = [];

  for (const ingredient of recipe.ingredients) {
    const bestObservation = nearbyStores
      .map((store) => ({
        store,
        observation: getObservationForStore(
          priceObservations,
          store.id,
          ingredient.ingredientId,
        ),
      }))
      .filter(
        (
          candidate,
        ): candidate is { store: NearbyStoreSummary; observation: MockPriceObservation } =>
          candidate.observation !== undefined,
      )
      .sort((left, right) => left.observation.price - right.observation.price)[0];

    if (!bestObservation) {
      return [];
    }

    plan.push(
      toShoppingPlanItem(
        ingredient.displayName,
        ingredient.quantityNote,
        bestObservation.observation,
        bestObservation.store.name,
      ),
    );
  }

  return plan;
}

function getObservationForStore(
  priceObservations: MockPriceObservation[],
  storeId: string,
  ingredientId: string,
) {
  return priceObservations.find(
    (observation) =>
      observation.storeId === storeId &&
      observation.ingredientId === ingredientId &&
      observation.inStock,
  );
}

function toShoppingPlanItem(
  ingredient: string,
  quantityNote: string,
  observation: MockPriceObservation,
  storeName: string,
): ShoppingPlanItem {
  return {
    ingredient,
    quantityNote,
    storeName,
    price: observation.price,
    freshnessDaysAgo: observation.freshnessDaysAgo,
    saleLabel: observation.saleLabel,
  };
}

function scoreCandidate({
  recipe,
  shoppingPlan,
  preferences,
  estimatedTotal,
}: {
  recipe: MockRecipeRecord;
  shoppingPlan: ShoppingPlanItem[];
  preferences: MealPreferenceForm;
  estimatedTotal: number;
}): ScoreBreakdown {
  const storeCount = new Set(shoppingPlan.map((item) => item.storeName)).size;
  const averageFreshnessDays =
    shoppingPlan.reduce((sum, item) => sum + item.freshnessDaysAgo, 0) /
    shoppingPlan.length;
  const dietaryBoost =
    preferences.dietaryFocus !== "anything" &&
    recipe.dietaryTags.includes(preferences.dietaryFocus)
      ? 4
      : 0;

  const price = clamp(
    Math.round(((preferences.budget - estimatedTotal) / preferences.budget) * 40 + 18),
    0,
    40,
  );
  const convenience = clamp(
    30 - (storeCount - 1) * 10 - Math.max(0, recipe.cookTimeMinutes - 25),
    0,
    30,
  );
  const freshness = clamp(Math.round(20 - averageFreshnessDays * 3), 4, 20);
  const fit = clamp(
    10 + (preferences.maxIngredients - recipe.ingredients.length) * 2 + dietaryBoost,
    0,
    20,
  );

  return {
    total: price + convenience + freshness + fit,
    price,
    convenience,
    freshness,
    fit,
  };
}

function toRecommendation(candidate: Candidate): MealRecommendation {
  const storePlan = Array.from(
    candidate.shoppingPlan.reduce((map, item) => {
      const entry = map.get(item.storeName) ?? {
        storeName: item.storeName,
        subtotal: 0,
        itemCount: 0,
      };
      entry.subtotal += item.price;
      entry.itemCount += 1;
      map.set(item.storeName, entry);
      return map;
    }, new Map<string, StorePlan>()),
  )
    .map(([, plan]) => ({
      ...plan,
      subtotal: roundCurrency(plan.subtotal),
    }))
    .sort((left, right) => right.subtotal - left.subtotal);

  return {
    title: candidate.recipe.title,
    summary: candidate.recipe.summary,
    estimatedTotal: candidate.estimatedTotal,
    storeCount: storePlan.length,
    matchedIngredients: candidate.shoppingPlan.length,
    cookTimeMinutes: candidate.recipe.cookTimeMinutes,
    difficulty: candidate.recipe.difficulty,
    primaryStore: storePlan[0]?.storeName ?? "Mock store",
    ingredientHighlights: candidate.recipe.ingredients
      .slice(0, 3)
      .map((ingredient) => ingredient.displayName.toLowerCase()),
    instructions: candidate.recipe.steps,
    shoppingPlan: candidate.shoppingPlan,
    storePlan,
    score: candidate.score,
    confidenceLabel: candidate.confidenceLabel,
    tags: candidate.recipe.tags,
    freshnessLabel: candidate.freshnessLabel,
    explanation: buildExplanation(candidate, storePlan.length),
  };
}

function buildExplanation(candidate: Candidate, storeCount: number) {
  const budgetNote =
    candidate.score.price >= 30
      ? "the total stays comfortably under the current budget"
      : "the meal still fits the current budget";
  const storeNote =
    storeCount === 1
      ? "it can be shopped as a one-store trip"
      : "it balances savings across multiple nearby stores";
  const freshnessNote =
    candidate.score.freshness >= 16
      ? "The current price observations are relatively fresh."
      : "Some price observations are older, so treat the total as more directional.";

  return `${candidate.recipe.title} ranks well because ${budgetNote} and ${storeNote}. ${freshnessNote}`;
}

function getFreshnessLabel(shoppingPlan: ShoppingPlanItem[]) {
  const averageDays =
    shoppingPlan.reduce((sum, item) => sum + item.freshnessDaysAgo, 0) /
    shoppingPlan.length;

  if (averageDays <= 2) {
    return "Fresh pricing snapshot";
  }
  if (averageDays <= 3.5) {
    return "Recent pricing snapshot";
  }
  return "Older pricing snapshot";
}

function getConfidenceLabel(shoppingPlan: ShoppingPlanItem[]) {
  const storeCount = new Set(shoppingPlan.map((item) => item.storeName)).size;
  if (storeCount === 1) {
    return "Single-store estimate";
  }
  return "Multi-store estimate";
}

function roundCurrency(value: number) {
  return Math.round(value * 100) / 100;
}

function roundDistanceMiles(value: number) {
  return Math.round(value * 10) / 10;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function getDistanceMiles(
  startLatitude: number,
  startLongitude: number,
  endLatitude: number,
  endLongitude: number,
) {
  const earthRadiusMiles = 3958.8;
  const latitudeDelta = degreesToRadians(endLatitude - startLatitude);
  const longitudeDelta = degreesToRadians(endLongitude - startLongitude);
  const startLatitudeRadians = degreesToRadians(startLatitude);
  const endLatitudeRadians = degreesToRadians(endLatitude);

  const a =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(startLatitudeRadians) *
      Math.cos(endLatitudeRadians) *
      Math.sin(longitudeDelta / 2) ** 2;

  return earthRadiusMiles * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function degreesToRadians(value: number) {
  return (value * Math.PI) / 180;
}
