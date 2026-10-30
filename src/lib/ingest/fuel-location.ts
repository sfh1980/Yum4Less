/**
 * Fuel-only places are not grocery pins.
 * Department ids win. OSM place tags are next. The word "fuel" in a name
 * applies only when those signals are absent.
 */

export const KROGER_FUEL_DEPARTMENT_IDS = ["10", "92", "93", "95", "96"] as const;
export const KROGER_GROCERY_DEPARTMENT_IDS = ["01", "02", "04", "05", "87", "88"] as const;

const FUEL_PLACE_TAGS = new Set(["gas_station", "fueling_station"]);

function normalizeDepartmentId(value: string): string {
  const trimmed = value.trim();
  if (!/^\d+$/.test(trimmed)) {
    return trimmed.toLowerCase();
  }
  return trimmed.padStart(2, "0");
}

export function isKrogerFuelOnlyDepartmentList(
  departmentIds: readonly string[],
): boolean {
  const ids = new Set(departmentIds.map(normalizeDepartmentId));
  const hasFuel = KROGER_FUEL_DEPARTMENT_IDS.some((id) => ids.has(id));
  const hasGrocery = KROGER_GROCERY_DEPARTMENT_IDS.some((id) => ids.has(id));
  return hasFuel && !hasGrocery;
}

export function isFuelPlaceTag(value: string | null | undefined): boolean {
  const normalized = value?.trim().toLowerCase() ?? "";
  return FUEL_PLACE_TAGS.has(normalized);
}

export function nameHasFuelWord(name: string | null | undefined): boolean {
  return /\bfuel\b/i.test(name?.trim() ?? "");
}

export function shouldSkipFuelLocation(input: {
  departmentIds?: readonly string[] | null;
  osmShop?: string | null;
  osmAmenity?: string | null;
  name?: string | null;
}): boolean {
  const departmentIds = (input.departmentIds ?? [])
    .map((id) => id.trim())
    .filter((id) => id.length > 0);
  if (departmentIds.length > 0) {
    return isKrogerFuelOnlyDepartmentList(departmentIds);
  }
  if (isFuelPlaceTag(input.osmShop) || isFuelPlaceTag(input.osmAmenity)) {
    return true;
  }
  const hasPlaceTag =
    (input.osmShop?.trim().length ?? 0) > 0 || (input.osmAmenity?.trim().length ?? 0) > 0;
  if (hasPlaceTag) {
    return false;
  }
  return nameHasFuelWord(input.name);
}
