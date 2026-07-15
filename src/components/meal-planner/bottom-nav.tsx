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

          return (
            <li key={tab.id} className="bottom-nav-item">
              <button
                type="button"
                className={`bottom-nav-button${activeTab === tab.id ? " bottom-nav-button--active" : ""}`}
                aria-current={activeTab === tab.id ? "page" : undefined}
                disabled={disabled}
                aria-disabled={disabled || undefined}
                onClick={() => {
                  if (!disabled) {
                    onTabChange(tab.id);
                  }
                }}
              >
                {tab.label}
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
