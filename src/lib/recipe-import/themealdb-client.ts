import type {
  ThemealdbFilterResponse,
  ThemealdbLookupMeal,
  ThemealdbLookupResponse,
  ThemealdbParsedIngredientLine,
} from "@/lib/recipe-import/themealdb-types";
import { THEMEALDB_API_BASE } from "@/lib/recipe-import/themealdb-types";

export type ThemealdbFetchFn = (
  url: string,
  init?: RequestInit,
) => Promise<Response>;

export type ThemealdbClientOptions = {
  apiKey?: string;
  fetchFn?: ThemealdbFetchFn;
  /** Minimum delay between outbound requests within one import run. */
  rateLimitMs?: number;
};

export class ThemealdbClient {
  private readonly apiKey: string;
  private readonly fetchFn: ThemealdbFetchFn;
  private readonly rateLimitMs: number;
  private readonly cache = new Map<string, unknown>();
  private lastRequestAt = 0;

  constructor(options: ThemealdbClientOptions = {}) {
    this.apiKey = options.apiKey ?? process.env.THEMEALDB_API_KEY ?? "1";
    this.fetchFn = options.fetchFn ?? fetch;
    this.rateLimitMs = options.rateLimitMs ?? 100;
  }

  async filterByIngredient(ingredient: string) {
    const normalized = ingredient.trim().toLowerCase();
    const cacheKey = `filter:${normalized}`;
    const cached = this.cache.get(cacheKey);
    if (cached) {
      return cached as ThemealdbFilterResponse;
    }

    const url = `${THEMEALDB_API_BASE}/${this.apiKey}/filter.php?i=${encodeURIComponent(normalized)}`;
    const response = await this.throttledFetch(url);
    if (!response.ok) {
      throw new Error(`TheMealDB filter failed (${response.status}) for "${ingredient}"`);
    }

    const body = (await response.json()) as ThemealdbFilterResponse;
    this.cache.set(cacheKey, body);
    return body;
  }

  async lookupMeal(idMeal: string) {
    const cacheKey = `lookup:${idMeal}`;
    const cached = this.cache.get(cacheKey);
    if (cached) {
      return cached as ThemealdbLookupResponse;
    }

    const url = `${THEMEALDB_API_BASE}/${this.apiKey}/lookup.php?i=${encodeURIComponent(idMeal)}`;
    const response = await this.throttledFetch(url);
    if (!response.ok) {
      throw new Error(`TheMealDB lookup failed (${response.status}) for meal ${idMeal}`);
    }

    const body = (await response.json()) as ThemealdbLookupResponse;
    this.cache.set(cacheKey, body);
    return body;
  }

  private async throttledFetch(url: string) {
    const now = Date.now();
    const waitMs = Math.max(0, this.rateLimitMs - (now - this.lastRequestAt));
    if (waitMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, waitMs));
    }
    this.lastRequestAt = Date.now();
    return this.fetchFn(url);
  }
}

export function parseThemealdbIngredientLines(
  meal: ThemealdbLookupMeal,
): ThemealdbParsedIngredientLine[] {
  const lines: ThemealdbParsedIngredientLine[] = [];

  for (let index = 1; index <= 20; index += 1) {
    const ingredient = meal[`strIngredient${index}`]?.trim();
    if (!ingredient) {
      continue;
    }

    const measure = meal[`strMeasure${index}`]?.trim() ?? "";
    lines.push({ displayName: ingredient, measure });
  }

  return lines;
}

export function parseThemealdbInstructions(meal: ThemealdbLookupMeal): string[] {
  const raw = meal.strInstructions?.trim();
  if (!raw) {
    return [];
  }

  return raw
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

export function parseThemealdbTags(meal: ThemealdbLookupMeal): string[] {
  if (!meal.strTags) {
    return [];
  }

  return meal.strTags
    .split(",")
    .map((tag) => tag.trim())
    .filter((tag) => tag.length > 0);
}

export function inferThemealdbDifficulty(
  cookTimeMinutes: number,
): "easy" | "medium" {
  return cookTimeMinutes <= 45 ? "easy" : "medium";
}

export function estimateThemealdbCookTimeMinutes(meal: ThemealdbLookupMeal): number {
  const instructionLength = meal.strInstructions?.length ?? 0;
  const ingredientCount = parseThemealdbIngredientLines(meal).length;
  const base = 25 + ingredientCount * 3 + Math.min(30, Math.floor(instructionLength / 120));
  return Math.min(90, Math.max(20, base));
}

export function slugifyThemealdbRecipeId(idMeal: string, title: string): string {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return `themealdb-${idMeal}-${slug || "meal"}`;
}
