"use client";

import type { ThemePreference } from "@/lib/settings-preferences";
import { resolveThemePreference } from "@/lib/resolve-theme";

type ThemeToggleProps = {
  theme: ThemePreference;
  onToggle: () => void;
};

export function ThemeToggle({ theme, onToggle }: ThemeToggleProps) {
  const resolved = resolveThemePreference(theme);
  const nextLabel = resolved === "light" ? "Switch to dark theme" : "Switch to light theme";

  return (
    <button
      type="button"
      className="theme-toggle"
      aria-label={nextLabel}
      aria-pressed={resolved === "dark"}
      onClick={onToggle}
    >
      <span aria-hidden="true">{resolved === "light" ? "☾" : "☀"}</span>
    </button>
  );
}
