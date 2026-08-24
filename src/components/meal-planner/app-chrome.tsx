"use client";

import type { ThemePreference } from "@/lib/settings-preferences";
import { ThemeToggle } from "@/components/meal-planner/theme-toggle";

type AppChromeProps = {
  showBack: boolean;
  onBack?: () => void;
  theme: ThemePreference;
  onToggleTheme: () => void;
};

export function AppChrome({
  showBack,
  onBack,
  theme,
  onToggleTheme,
}: AppChromeProps) {
  return (
    <header className="app-chrome">
      {showBack ? (
        <button
          type="button"
          className="app-chrome-back"
          aria-label="Back"
          onClick={onBack}
        >
          <span aria-hidden="true">←</span>
        </button>
      ) : (
        <span className="app-chrome-spacer" />
      )}
      <ThemeToggle theme={theme} onToggle={onToggleTheme} />
    </header>
  );
}
