"use client";

import { useEffect } from "react";
import { readSettingsPreferences } from "@/lib/settings-preferences";
import { syncThemeFromPreference } from "@/lib/resolve-theme";

type ThemeSyncProps = {
  /** Live preference from meal planner form; overrides localStorage when provided. */
  themePreference?: "light" | "dark" | "system";
};

export function ThemeSync({ themePreference }: ThemeSyncProps) {
  useEffect(() => {
    function sync() {
      const preference =
        themePreference ?? readSettingsPreferences()?.theme ?? "light";
      syncThemeFromPreference(preference);
    }

    sync();

    if (typeof window.matchMedia !== "function") {
      return;
    }

    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onMediaChange = () => {
      const preference =
        themePreference ?? readSettingsPreferences()?.theme ?? "light";
      if (preference === "system") {
        syncThemeFromPreference(preference);
      }
    };

    media.addEventListener("change", onMediaChange);
    return () => media.removeEventListener("change", onMediaChange);
  }, [themePreference]);

  return null;
}
