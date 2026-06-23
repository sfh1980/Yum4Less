import {
  parseLocationRequestFields,
  radiusMilesSchema,
  type LocationRequestFields,
} from "@/contracts/shared/location";

export type MarketSearchRequest = LocationRequestFields & {
  radiusMiles: number;
};

export function parseMarketSearchRequest(
  body: unknown,
): MarketSearchRequest | undefined {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return undefined;
  }

  const record = body as Record<string, unknown>;
  const radiusResult = radiusMilesSchema.safeParse(record.radiusMiles);
  if (!radiusResult.success) {
    return undefined;
  }

  const location = parseLocationRequestFields(record);
  if (!location) {
    return undefined;
  }

  return {
    ...location,
    radiusMiles: radiusResult.data,
  };
}
