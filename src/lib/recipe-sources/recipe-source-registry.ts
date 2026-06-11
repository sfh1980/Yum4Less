import type { RecipeSourceEntry } from "@/lib/recipe-sources/recipe-source-types";

/**
 * Research-backed registry for external recipe providers.
 * Only `internal-library` is active in the MVP; others are documented gates.
 */
export const RECIPE_SOURCE_RESEARCH: RecipeSourceEntry[] = [
  {
    id: "internal-library",
    label: "Internal recipe library",
    availability: "active",
    mvpRecommendation: "primary",
    summary:
      "Curated Postgres dinner recipes around ZIP 23111 with ingredient IDs aligned to local store pricing.",
    trustNotes: [
      "Best control for ingredient matching and shopping-plan trust labels.",
      "No third-party attribution or caching rules apply.",
    ],
    requiredEnvVars: [],
  },
  {
    id: "themealdb",
    label: "TheMealDB",
    availability: "active",
    mvpRecommendation: "secondary",
    summary:
      "Public recipe catalog imported when meals overlap local weekly-ad sale ingredients. Ingredient strings are normalized but still weaker than the internal library.",
    trustNotes: [
      "Free test key (`1`) is fine for development only.",
      "Commercial or app-store use expects a paid Patreon supporter key and source attribution to TheMealDB.",
      "Imported meals rank only when at least three sale ingredients overlap and a defensible shopping plan exists.",
      "Sale-driven import runs on scheduled ingest; opt-in ranking may refresh stale imports on search (24h cache, bounded per run).",
    ],
    termsUrl: "https://www.themealdb.com/terms_of_use.php",
    requiredEnvVars: ["THEMEALDB_API_KEY"],
  },
  {
    id: "spoonacular",
    label: "Spoonacular",
    availability: "blocked-terms",
    mvpRecommendation: "later",
    summary:
      "Rich search, filters, and nutrition metadata, but strict caching and anti-competition terms.",
    trustNotes: [
      "Most response fields may be cached for at most 1 hour; longer retention requires deleting and refetching.",
      "Recipe IDs, titles, and image URLs may be stored indefinitely.",
      "Must credit original recipe sources the same way Spoonacular does (site name + link).",
      "Cannot build an experience that competes with Spoonacular or republishes transformed/scraped API data without written permission.",
      "Not a drop-in for Yum4Less local pricing trust without a separate normalization and attribution layer.",
    ],
    termsUrl: "https://spoonacular.com/food-api/terms",
    requiredEnvVars: ["SPOONACULAR_API_KEY"],
  },
  {
    id: "edamam",
    label: "Edamam Recipe Search",
    availability: "blocked-commercial",
    mvpRecommendation: "not-approved",
    summary:
      "Strong nutrition and metadata, but the free tier is personal/non-profit only and commercial tiers start at paid plans.",
    trustNotes: [
      "Free API tier is not approved for commercial Yum4Less use without explicit Edamam authorization.",
      "Paid tiers start around $9/month (Basic) with tighter content/licensing rules on lower tiers.",
      "No automated bulk scraping; requests must be end-user driven.",
      "Caching and archival restrictions vary by plan; assume minimal caching until a paid plan is reviewed.",
      "Would still require ingredient normalization before local price matching.",
    ],
    termsUrl: "https://www.edamam.com/terms/api/",
    requiredEnvVars: ["EDAMAM_APP_ID", "EDAMAM_APP_KEY"],
  },
];

export function getRecipeSourceEntry(id: RecipeSourceEntry["id"]) {
  return RECIPE_SOURCE_RESEARCH.find((entry) => entry.id === id);
}

export function listSelectableRecipeSources() {
  return RECIPE_SOURCE_RESEARCH;
}

export function isRecipeSourceActive(id: RecipeSourceEntry["id"]) {
  return getRecipeSourceEntry(id)?.availability === "active";
}

export function getDefaultRecipeSource(): RecipeSourceEntry["id"] {
  return "internal-library";
}

export function buildRecipeSourceResearchSummary() {
  const blocked = RECIPE_SOURCE_RESEARCH.filter(
    (entry) => entry.availability !== "active",
  );

  return `MVP ranks from the internal library and sale-matched TheMealDB imports. ${blocked.length} external provider(s) remain blocked until licensing and matching gates are implemented.`;
}

export type InactiveRecipeSourceShopperNotice = {
  title: string;
  body: string;
};

/** Layman copy for the main UI when a non-active recipe source is selected. */
export function buildInactiveRecipeSourceShopperNotice(
  id: RecipeSourceEntry["id"],
): InactiveRecipeSourceShopperNotice {
  const entry = getRecipeSourceEntry(id);
  const label = entry?.label ?? "That recipe source";

  return {
    title: `${label} is not available yet`,
    body: "Yum4Less only ranks dinners from the internal recipe library right now. Choose Internal recipe library in your search settings, or pick another source when we add it.",
  };
}
