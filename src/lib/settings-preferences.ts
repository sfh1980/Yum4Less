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

export function isSettingsPreferencesComplete(
  prefs: SettingsPreferences | null | undefined,
): boolean {
  if (!prefs?.setupComplete) {
    return false;
  }

  if (!prefs.zipCode?.trim() || prefs.radiusMiles === undefined) {
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

    return parseSettingsPreferences(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function writeSettingsPreferences(prefs: SettingsPreferences): void {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(SETTINGS_PREFERENCES_STORAGE_KEY, JSON.stringify(prefs));
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
  const merged: SettingsPreferences = {
    ...existing,
    ...input,
  };

  const hasLocation =
    typeof merged.zipCode === "string" &&
    merged.zipCode.trim().length > 0 &&
    typeof merged.radiusMiles === "number";
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
