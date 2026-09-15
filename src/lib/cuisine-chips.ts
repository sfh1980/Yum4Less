/**
 * Curated R11 cuisine chips (shopper filter). Recipe assignments live in Postgres
 * `cuisine_tags`; this module is UX/behavior config (same class as dietary focus).
 */

export const CUISINE_CHIP_IDS = [
  "american",
  "italian",
  "mexican",
  "chinese",
  "thai",
  "japanese",
  "greek",
  "indian",
  "korean",
  "vietnamese",
] as const;

export type CuisineChipId = (typeof CUISINE_CHIP_IDS)[number];

export const CUISINE_CHIP_LABELS: Record<CuisineChipId, string> = {
  american: "American",
  italian: "Italian",
  mexican: "Mexican",
  chinese: "Chinese",
  thai: "Thai",
  japanese: "Japanese",
  greek: "Greek",
  indian: "Indian",
  korean: "Korean",
  vietnamese: "Vietnamese",
};

/** Hide a chip until this many rankable dinners carry that cuisine tag. */
export const CUISINE_CHIP_MIN_DINNER_COUNT = 2;

const CUISINE_CHIP_ID_SET = new Set<string>(CUISINE_CHIP_IDS);

/** Normalize TheMealDB `strArea` (or summary "Cuisine: X") into a curated chip id. */
export function mapThemealdbAreaToCuisineChip(
  area: string | null | undefined,
): CuisineChipId | null {
  if (!area) {
    return null;
  }

  const normalized = area.trim().toLowerCase();
  if (!normalized) {
    return null;
  }

  if (
    normalized === "american" ||
    normalized === "united states" ||
    normalized === "usa" ||
    normalized === "us" ||
    normalized === "british" ||
    normalized === "canadian"
  ) {
    return "american";
  }

  if (normalized === "italian") return "italian";
  if (normalized === "mexican") return "mexican";
  if (normalized === "chinese") return "chinese";
  if (normalized === "thai") return "thai";
  if (normalized === "japanese") return "japanese";
  if (normalized === "greek") return "greek";
  if (normalized === "indian") return "indian";
  if (normalized === "korean" || normalized === "south korean") return "korean";
  if (normalized === "vietnamese") return "vietnamese";

  return null;
}

export function isCuisineChipId(value: string): value is CuisineChipId {
  return CUISINE_CHIP_ID_SET.has(value);
}

export function normalizeCuisineTags(tags: string[]): CuisineChipId[] {
  const seen = new Set<CuisineChipId>();
  const result: CuisineChipId[] = [];
  for (const tag of tags) {
    if (!isCuisineChipId(tag) || seen.has(tag)) {
      continue;
    }
    seen.add(tag);
    result.push(tag);
  }
  return result;
}

export function parseSelectedCuisineIds(value: unknown): CuisineChipId[] | undefined {
  if (value === undefined || value === null) {
    return [];
  }

  if (!Array.isArray(value)) {
    return undefined;
  }

  if (value.length === 0) {
    return [];
  }

  const ids: CuisineChipId[] = [];
  const seen = new Set<CuisineChipId>();

  for (const entry of value) {
    if (typeof entry !== "string" || !isCuisineChipId(entry) || seen.has(entry)) {
      if (typeof entry !== "string" || !isCuisineChipId(entry)) {
        return undefined;
      }
      continue;
    }
    seen.add(entry);
    ids.push(entry);
  }

  return ids;
}

export type CuisineFacetCounts = Partial<Record<CuisineChipId, number>>;

export function countCuisineFacets(
  recipes: Array<{ cuisineTags: readonly CuisineChipId[] }>,
): CuisineFacetCounts {
  const counts: CuisineFacetCounts = {};
  for (const recipe of recipes) {
    for (const tag of recipe.cuisineTags) {
      counts[tag] = (counts[tag] ?? 0) + 1;
    }
  }
  return counts;
}

/** Curated chips that meet the min dinner threshold, in display order. */
export function visibleCuisineChips(
  counts: CuisineFacetCounts,
  minCount: number = CUISINE_CHIP_MIN_DINNER_COUNT,
): CuisineChipId[] {
  return CUISINE_CHIP_IDS.filter((id) => (counts[id] ?? 0) >= minCount);
}

export function recipeMatchesSelectedCuisines(
  recipe: { cuisineTags: readonly CuisineChipId[] },
  selectedCuisineIds: readonly CuisineChipId[],
): boolean {
  if (selectedCuisineIds.length === 0) {
    return true;
  }

  return selectedCuisineIds.some((id) => recipe.cuisineTags.includes(id));
}

/** Parse `Cuisine: Italian.` from imported TheMealDB summary prose (backfill helper). */
export function cuisineChipFromSummary(
  summary: string | null | undefined,
): CuisineChipId | null {
  if (!summary) {
    return null;
  }

  const match = summary.match(/Cuisine:\s*([^.]+)\./i);
  if (!match?.[1]) {
    return null;
  }

  return mapThemealdbAreaToCuisineChip(match[1]);
}
