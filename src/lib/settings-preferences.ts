import type { MealPreferenceForm } from "@/lib/recommendation-types";
import {
  parseSettingsPreferences,
  type LocationMode,
  type SettingsPreferences,
  type ThemePreference,
} from "@/contracts/shared/settings-preferences";

export type { LocationMode, SettingsPreferences, ThemePreference };
export { parseSettingsPreferences };

export const SETTINGS_PREFERENCES_STORAGE_KEY = "yum4less.settings-preferences.v1";

/** Exact coordinates are session-only — never keep them in long-term prefs. */
export function stripExactCoordinates(
  prefs: SettingsPreferences,
): SettingsPreferences {
  const { latitude: _latitude, longitude: _longitude, ...rest } = prefs;
  return rest;
}

function hasPersistedLocation(prefs: SettingsPreferences): boolean {
  const hasZip =
    typeof prefs.zipCode === "string" && prefs.zipCode.trim().length > 0;
  // Geolocation mode may complete without a ZIP; coords are not persisted.
  return hasZip || prefs.locationMode === "geolocation";
}

export function isSettingsPreferencesComplete(
  prefs: SettingsPreferences | null | undefined,
): boolean {
  if (!prefs?.setupComplete) {
    return false;
  }

  if (prefs.radiusMiles === undefined || !hasPersistedLocation(prefs)) {
    return false;
  }

  if (!prefs.shoppingStyle) {
    return false;
  }

  if (!prefs.selectedStoreIds || prefs.selectedStoreIds.length === 0) {
    return false;
  }

  if (prefs.shoppingStyle === "single-store" && prefs.selectedStoreIds.length !== 1) {
    return false;
  }

  return true;
}

export function readSettingsPreferences(): SettingsPreferences | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(SETTINGS_PREFERENCES_STORAGE_KEY);
    if (!raw) {
      return null;
    }

    const parsed = parseSettingsPreferences(JSON.parse(raw));
    return parsed ? stripExactCoordinates(parsed) : null;
  } catch {
    return null;
  }
}

export function writeSettingsPreferences(prefs: SettingsPreferences): void {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(
    SETTINGS_PREFERENCES_STORAGE_KEY,
    JSON.stringify(stripExactCoordinates(prefs)),
  );
}

export function clearSettingsPreferences(): void {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem(SETTINGS_PREFERENCES_STORAGE_KEY);
}

export function buildSettingsPreferencesPatch(input: {
  zipCode?: string;
  radiusMiles?: number;
  shoppingStyle?: MealPreferenceForm["shoppingStyle"];
  selectedStoreIds?: string[];
  theme?: ThemePreference;
  locationMode?: LocationMode;
  latitude?: number;
  longitude?: number;
  /** When true, recompute setupComplete from merged fields (explicit Save settings). */
  markSetupComplete?: boolean;
}): SettingsPreferences {
  const existing = readSettingsPreferences() ?? {};
  const merged: SettingsPreferences = stripExactCoordinates({
    ...existing,
    ...input,
  });

  // Explicit empty ZIP clears a prior stored value (e.g. form default then geolocation-only).
  if (input.zipCode !== undefined && input.zipCode.trim() === "") {
    delete merged.zipCode;
  }

  const hasLocation =
    typeof merged.radiusMiles === "number" && hasPersistedLocation(merged);
  const hasStores =
    Array.isArray(merged.selectedStoreIds) && merged.selectedStoreIds.length > 0;
  const storeCountValid =
    merged.shoppingStyle === "single-store"
      ? merged.selectedStoreIds?.length === 1
      : (merged.selectedStoreIds?.length ?? 0) >= 1;

  if (input.markSetupComplete) {
    merged.setupComplete = Boolean(
      hasLocation && merged.shoppingStyle && hasStores && storeCountValid,
    );
  } else {
    merged.setupComplete = existing.setupComplete ?? false;
  }

  return merged;
}
