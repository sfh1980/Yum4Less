import type { CatalogIngredient } from "@/lib/ingredient-category";

export type IngredientCatalogResolveResult =
  | { kind: "match"; ingredient: CatalogIngredient }
  | { kind: "suggestions"; suggestions: CatalogIngredient[] }
  | { kind: "none" };

function normalizeQuery(query: string): string {
  return query.trim().toLowerCase();
}

function isSubsequenceMatch(text: string, query: string): boolean {
  if (query.length === 0) {
    return false;
  }

  let queryIndex = 0;
  for (let textIndex = 0; textIndex < text.length && queryIndex < query.length; textIndex++) {
    if (text[textIndex] === query[queryIndex]) {
      queryIndex += 1;
    }
  }

  return queryIndex === query.length;
}

function levenshteinDistance(left: string, right: string): number {
  const rows = left.length + 1;
  const cols = right.length + 1;
  const matrix = Array.from({ length: rows }, () => Array<number>(cols).fill(0));

  for (let row = 0; row < rows; row += 1) {
    matrix[row]![0] = row;
  }
  for (let col = 0; col < cols; col += 1) {
    matrix[0]![col] = col;
  }

  for (let row = 1; row < rows; row += 1) {
    for (let col = 1; col < cols; col += 1) {
      const cost = left[row - 1] === right[col - 1] ? 0 : 1;
      matrix[row]![col] = Math.min(
        matrix[row - 1]![col]! + 1,
        matrix[row]![col - 1]! + 1,
        matrix[row - 1]![col - 1]! + cost,
      );
    }
  }

  return matrix[left.length]![right.length]!;
}

function fuzzyWordMatch(word: string, normalizedQuery: string): boolean {
  if (word.includes(normalizedQuery)) {
    return true;
  }
  if (isSubsequenceMatch(word, normalizedQuery)) {
    return true;
  }

  const prefixLength = Math.min(word.length, normalizedQuery.length + 1);
  const prefix = word.slice(0, prefixLength);
  const distance = levenshteinDistance(normalizedQuery, prefix);
  const maxDistance = normalizedQuery.length <= 3 ? 1 : 2;
  return distance <= maxDistance;
}

function ingredientMatchScore(ingredient: CatalogIngredient, normalizedQuery: string): number {
  const normalizedName = ingredient.name.toLowerCase();
  const normalizedId = ingredient.id.toLowerCase();
  const nameWords = normalizedName.split(/[\s-]+/);

  if (normalizedName === normalizedQuery || normalizedId === normalizedQuery) {
    return 100;
  }
  if (normalizedName.startsWith(normalizedQuery) || normalizedId.startsWith(normalizedQuery)) {
    return 80;
  }
  if (normalizedName.includes(normalizedQuery) || normalizedId.includes(normalizedQuery)) {
    return 60;
  }
  if (isSubsequenceMatch(normalizedName, normalizedQuery)) {
    return 40;
  }
  if (isSubsequenceMatch(normalizedId.replace(/-/g, " "), normalizedQuery)) {
    return 30;
  }
  if (nameWords.some((word) => fuzzyWordMatch(word, normalizedQuery))) {
    return 35;
  }
  if (normalizedId.split("-").some((word) => fuzzyWordMatch(word, normalizedQuery))) {
    return 35;
  }

  return 0;
}

export function rankIngredientCatalogMatches(
  catalog: CatalogIngredient[],
  query: string,
  limit = 8,
): CatalogIngredient[] {
  const normalized = normalizeQuery(query);
  if (!normalized) {
    return [];
  }

  return catalog
    .map((ingredient) => ({
      ingredient,
      score: ingredientMatchScore(ingredient, normalized),
    }))
    .filter((entry) => entry.score > 0)
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }
      return left.ingredient.name.localeCompare(right.ingredient.name);
    })
    .slice(0, limit)
    .map((entry) => entry.ingredient);
}

export function filterIngredientCatalog(
  catalog: CatalogIngredient[],
  query: string,
  limit = 8,
): CatalogIngredient[] {
  return rankIngredientCatalogMatches(catalog, query, limit);
}

export function resolveIngredientFromCatalogQuery(
  catalog: CatalogIngredient[],
  query: string,
): IngredientCatalogResolveResult {
  const normalized = normalizeQuery(query);
  if (!normalized) {
    return { kind: "none" };
  }

  const ranked = rankIngredientCatalogMatches(catalog, normalized, 5);
  if (ranked.length === 0) {
    return { kind: "none" };
  }

  const topScore = ingredientMatchScore(ranked[0]!, normalized);
  if (topScore >= 80) {
    return { kind: "match", ingredient: ranked[0]! };
  }

  return { kind: "suggestions", suggestions: ranked };
}
