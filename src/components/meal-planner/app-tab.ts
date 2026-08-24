import {
  isSettingsPreferencesComplete,
  readSettingsPreferences,
} from "@/lib/settings-preferences";

export type AppTab = "home" | "deals" | "cook" | "saved" | "feedback" | "settings";

/** Stable tab for SSR and the first client paint — must match server HTML. */
export const SSR_DEFAULT_APP_TAB: AppTab = "settings";

export function resolveAppTabFromPreferences(): AppTab {
  return isSettingsPreferencesComplete(readSettingsPreferences()) ? "home" : "settings";
}

/**
 * Whether the tab's real feature is available (not the locked-message page).
 * Feedback and Settings are always usable. Home/Deals/Saved need setup.
 * Cook still needs ranked recipes after setup.
 */
export function isAppTabContentReady(
  tab: AppTab,
  options: { settingsComplete: boolean; cookEnabled: boolean },
): boolean {
  if (tab === "settings" || tab === "feedback") {
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

/** Bottom-nav buttons stay tappable; locked tabs open a message page. */
export function isAppTabEnabled(
  _tab: AppTab,
  _options: { settingsComplete: boolean; cookEnabled: boolean },
): boolean {
  return true;
}
