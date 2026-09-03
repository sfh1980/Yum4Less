export const DENSITY_CLASSES = ["packed", "urban", "suburban", "rural"] as const;

export type DensityClass = (typeof DENSITY_CLASSES)[number];

/** Grocery pin count inside 8 miles of the ZIP geocode. Tune later. */
export const DENSITY_CLASSIFY_RADIUS_MILES = 8;

export const DENSITY_MILE_BUFFER = 1;

export const DENSITY_CLASS_BASE_MILES: Record<DensityClass, number> = {
  packed: 5,
  urban: 8,
  suburban: 15,
  rural: 25,
};

/** First night / missing class — urban 8+1. Kept for density math; admission uses the ZIP-outline cap. */
export const BOOTSTRAP_INGEST_MILES =
  DENSITY_CLASS_BASE_MILES.urban + DENSITY_MILE_BUFFER;

/**
 * Nightly ingest and Owner Check share this mile cap around the ZIP geocode.
 * The Census ZIP outline is the tighter clip when it loads. Rural density
 * miles (25+1) — wide enough for giant ZCTAs, not unbounded.
 */
export const INGEST_ZCTA_SAFETY_CAP_MILES =
  DENSITY_CLASS_BASE_MILES.rural + DENSITY_MILE_BUFFER;

export const DENSITY_GROCERY_COUNT_MIN: Record<DensityClass, number> = {
  packed: 12,
  urban: 6,
  suburban: 3,
  rural: 0,
};

export function ingestMilesForClass(densityClass: DensityClass): number {
  return DENSITY_CLASS_BASE_MILES[densityClass] + DENSITY_MILE_BUFFER;
}

export function classifyDensityFromGroceryCount(
  groceryCountInClassifyRadius: number,
): DensityClass {
  const count = Number.isFinite(groceryCountInClassifyRadius)
    ? groceryCountInClassifyRadius
    : 0;
  if (count >= DENSITY_GROCERY_COUNT_MIN.packed) {
    return "packed";
  }
  if (count >= DENSITY_GROCERY_COUNT_MIN.urban) {
    return "urban";
  }
  if (count >= DENSITY_GROCERY_COUNT_MIN.suburban) {
    return "suburban";
  }
  return "rural";
}

/** Auto-widen only. Never shrink saved miles without an owner override. */
export function pickPersistedIngestMiles(input: {
  savedMiles: number | null | undefined;
  computedMiles: number;
}): number {
  const computed = input.computedMiles;
  if (
    input.savedMiles == null ||
    !Number.isFinite(input.savedMiles) ||
    input.savedMiles <= 0
  ) {
    return computed;
  }
  return Math.max(input.savedMiles, computed);
}
