"use client";

import {
  isAppTabEnabled,
  type AppTab,
} from "@/components/meal-planner/app-tab";

type BottomNavProps = {
  activeTab: AppTab;
  settingsComplete: boolean;
  cookEnabled: boolean;
  onTabChange: (tab: AppTab) => void;
};

const TABS: { id: AppTab; label: string }[] = [
  { id: "home", label: "Home" },
  { id: "deals", label: "Deals" },
  { id: "cook", label: "Cook" },
  { id: "saved", label: "Saved" },
  { id: "settings", label: "Settings" },
];

function disabledTabHint(
  tab: AppTab,
  options: { settingsComplete: boolean; cookEnabled: boolean },
): string | undefined {
  if (tab === "settings" || isAppTabEnabled(tab, options)) {
    return undefined;
  }

  if (!options.settingsComplete) {
    return "Finish setup to unlock this";
  }

  if (tab === "cook") {
    return "Suggest recipes on Home first";
  }

  return undefined;
}

export function BottomNav({
  activeTab,
  settingsComplete,
  cookEnabled,
  onTabChange,
}: BottomNavProps) {
  return (
    <nav className="bottom-nav" aria-label="Main">
      <ul className="bottom-nav-list">
        {TABS.map((tab) => {
          const disabled = !isAppTabEnabled(tab.id, {
            settingsComplete,
            cookEnabled,
          });
          const hint = disabledTabHint(tab.id, {
            settingsComplete,
            cookEnabled,
          });
          const hintId = `bottom-nav-hint-${tab.id}`;

          return (
            <li key={tab.id} className="bottom-nav-item">
              <button
                type="button"
                className={`bottom-nav-button${activeTab === tab.id ? " bottom-nav-button--active" : ""}`}
                aria-label={tab.label}
                aria-current={activeTab === tab.id ? "page" : undefined}
                disabled={disabled}
                aria-disabled={disabled || undefined}
                title={hint}
                aria-describedby={hint ? hintId : undefined}
                onClick={() => {
                  if (!disabled) {
                    onTabChange(tab.id);
                  }
                }}
              >
                <span className="bottom-nav-button-label" aria-hidden="true">
                  {tab.label}
                </span>
                {hint ? (
                  <span id={hintId} className="bottom-nav-button-hint">
                    {hint}
                  </span>
                ) : null}
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
