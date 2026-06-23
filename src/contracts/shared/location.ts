import { z } from "zod";
import { API_LIMITS } from "@/lib/api-request";
import { isValidCoordinatePair, isValidZipCode } from "@/lib/api-request";

export const radiusMilesSchema = z
  .number()
  .int()
  .min(API_LIMITS.radiusMiles.min)
  .max(API_LIMITS.radiusMiles.max);

export type LocationRequestFields = {
  zipCode: string;
  latitude?: number;
  longitude?: number;
};

export function parseLocationRequestFields(
  body: Record<string, unknown>,
): LocationRequestFields | undefined {
  const hasCoordinates = isValidCoordinatePair(body);
  const zipRaw = typeof body.zipCode === "string" ? body.zipCode.trim() : "";

  if (!hasCoordinates && !isValidZipCode(zipRaw)) {
    return undefined;
  }

  return {
    zipCode: hasCoordinates && !isValidZipCode(zipRaw) ? "" : zipRaw,
    ...(hasCoordinates
      ? {
          latitude: body.latitude as number,
          longitude: body.longitude as number,
        }
      : {}),
  };
}
