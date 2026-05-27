export type RecipeSourceId =
  | "internal-library"
  | "themealdb"
  | "spoonacular"
  | "edamam";

export type RecipeSourceAvailability =
  | "active"
  | "research-only"
  | "blocked-terms"
  | "blocked-commercial";

export type RecipeSourceEntry = {
  id: RecipeSourceId;
  label: string;
  availability: RecipeSourceAvailability;
  mvpRecommendation: "primary" | "dev-only" | "later" | "not-approved";
  summary: string;
  trustNotes: string[];
  termsUrl?: string;
  requiredEnvVars: string[];
};

export type RecipeSourceSelection = RecipeSourceId;
