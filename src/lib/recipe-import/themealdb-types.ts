/** TheMealDB API response shapes (v1 free tier). */

export type ThemealdbFilterMeal = {
  idMeal: string;
  strMeal: string;
  strMealThumb: string;
};

export type ThemealdbFilterResponse = {
  meals: ThemealdbFilterMeal[] | null;
};

export type ThemealdbLookupMeal = {
  idMeal: string;
  strMeal: string;
  strCategory: string | null;
  strArea: string | null;
  strInstructions: string | null;
  strTags: string | null;
  strMealThumb: string | null;
  [key: `strIngredient${number}`]: string | null | undefined;
  [key: `strMeasure${number}`]: string | null | undefined;
};

export type ThemealdbLookupResponse = {
  meals: ThemealdbLookupMeal[] | null;
};

export type ThemealdbParsedIngredientLine = {
  displayName: string;
  measure: string;
};

export type ThemealdbImportSkipReason =
  | "duplicate"
  | "below-sale-overlap"
  | "below-mappable-ratio"
  | "lookup-failed"
  | "no-ingredients"
  | "cap-reached";

export type ThemealdbImportReport = {
  saleIngredientCount: number;
  apiFilterCalls: number;
  candidateMealCount: number;
  importedCount: number;
  skipped: Array<{ idMeal: string; strMeal: string; reason: ThemealdbImportSkipReason }>;
  imported: Array<{ id: string; title: string; idMeal: string }>;
  aliasSavedCount: number;
  newIngredientCount: number;
};

export const THEMEALDB_SOURCE_NAME = "themealdb";

export const MIN_SALE_INGREDIENT_MATCHES = 3;
export const MIN_MAPPABLE_LINE_RATIO = 0.5;
export const DEFAULT_THEMEALDB_IMPORT_MAX_PER_RUN = 15;
export const AUTO_ALIAS_CONFIDENCE_THRESHOLD = 0.75;
export const THEMEALDB_API_BASE = "https://www.themealdb.com/api/json/v1";
