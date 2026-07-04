import type { ThemePreference } from "@/lib/settings-preferences";

export type ResolvedTheme = "light" | "dark";

export function resolveThemePreference(preference: ThemePreference): ResolvedTheme {
  if (preference === "light") {
    return "light";
  }

  if (preference === "dark") {
    return "dark";
  }

  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return "light";
  }

  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function applyResolvedTheme(resolved: ResolvedTheme): void {
  if (typeof document === "undefined") {
    return;
  }

  document.documentElement.dataset.theme = resolved;
}

export function syncThemeFromPreference(preference: ThemePreference): ResolvedTheme {
  const resolved = resolveThemePreference(preference);
  applyResolvedTheme(resolved);
  return resolved;
}
