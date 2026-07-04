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
