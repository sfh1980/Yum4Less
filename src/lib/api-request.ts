export const API_LIMITS = {
  radiusMiles: { min: 1, max: 25 },
  budget: { min: 5, max: 250 },
  maxIngredients: { min: 3, max: 20 },
  dinnersWanted: { min: 1, max: 12 },
  shoppingRouteStops: { max: 8 },
} as const;

export async function parseJsonBody(request: Request): Promise<
  | { ok: true; body: unknown }
  | { ok: false; error: string }
> {
  try {
    return { ok: true, body: await request.json() };
  } catch {
    return { ok: false, error: "Request body must be valid JSON." };
  }
}

export function isValidZipCode(value: unknown): value is string {
  return typeof value === "string" && /^\d{5}$/.test(value.trim());
}

export function clampInteger(
  value: unknown,
  bounds: { min: number; max: number },
): number | undefined {
  if (typeof value !== "number" || !Number.isInteger(value)) {
    return undefined;
  }

  if (value < bounds.min || value > bounds.max) {
    return undefined;
  }

  return value;
}

export function clampNumber(
  value: unknown,
  bounds: { min: number; max: number },
): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return undefined;
  }

  if (value < bounds.min || value > bounds.max) {
    return undefined;
  }

  return value;
}

export function isValidCoordinatePair(input: {
  latitude?: unknown;
  longitude?: unknown;
}) {
  if (typeof input.latitude !== "number" || typeof input.longitude !== "number") {
    return false;
  }

  return (
    Number.isFinite(input.latitude) &&
    Number.isFinite(input.longitude) &&
    input.latitude >= -90 &&
    input.latitude <= 90 &&
    input.longitude >= -180 &&
    input.longitude <= 180
  );
}
