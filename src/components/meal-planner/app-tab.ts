import {
  isSettingsPreferencesComplete,
  readSettingsPreferences,
} from "@/lib/settings-preferences";

export type AppTab = "home" | "deals" | "cook" | "saved" | "settings";

/** Stable tab for SSR and the first client paint — must match server HTML. */
export const SSR_DEFAULT_APP_TAB: AppTab = "settings";

export function resolveAppTabFromPreferences(): AppTab {
  return isSettingsPreferencesComplete(readSettingsPreferences()) ? "home" : "settings";
}

/**
 * Settings-first gate: until setup is complete, only Settings is navigable.
 * After setup, Cook stays disabled until ranked recipes exist.
 */
export function isAppTabEnabled(
  tab: AppTab,
  options: { settingsComplete: boolean; cookEnabled: boolean },
): boolean {
  if (tab === "settings") {
    return true;
  }

  if (!options.settingsComplete) {
    return false;
  }

  if (tab === "cook") {
    return options.cookEnabled;
  }

  return true;
}
