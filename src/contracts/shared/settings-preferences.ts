import { z } from "zod";
import { API_LIMITS } from "@/lib/api-request";
import { shoppingStyleSchema } from "@/contracts/shared/meal-preferences";

export const themePreferenceSchema = z.enum(["light", "dark", "system"]);

export type ThemePreference = z.infer<typeof themePreferenceSchema>;

export const locationModeSchema = z.enum(["geolocation", "zip"]);

export type LocationMode = z.infer<typeof locationModeSchema>;

const settingsStoreIdSchema = z
  .string()
  .trim()
  .min(1)
  .max(80)
  .regex(/^[a-z0-9-]+$/);

/** Client-side Settings persistence (localStorage). */
export const settingsPreferencesSchema = z.object({
  zipCode: z
    .string()
    .trim()
    .regex(/^\d{5}$/, "ZIP must be five digits")
    .optional(),
  radiusMiles: z
    .number()
    .int()
    .min(API_LIMITS.radiusMiles.min)
    .max(API_LIMITS.radiusMiles.max)
    .optional(),
  shoppingStyle: shoppingStyleSchema.optional(),
  // Persist all selected ranking stores; route-stop limits are enforced only by
  // shopping-route validation, not by the meal-planner settings state.
  selectedStoreIds: z.array(settingsStoreIdSchema).optional(),
  theme: themePreferenceSchema.optional(),
  locationMode: locationModeSchema.optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  setupComplete: z.boolean().optional(),
  onboardingStep: z
    .enum([
      "choose-location",
      "zip-input",
      "zip-pin",
      "radius",
      "shopping-style",
      "stores",
    ])
    .optional(),
});

export type SettingsPreferences = z.infer<typeof settingsPreferencesSchema>;

/** Returns validated preferences or null when localStorage JSON is corrupt or invalid. */
export function parseSettingsPreferences(raw: unknown): SettingsPreferences | null {
  const result = settingsPreferencesSchema.safeParse(raw);
  return result.success ? result.data : null;
}
