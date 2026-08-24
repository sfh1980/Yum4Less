"use client";

import { type AppTab } from "@/components/meal-planner/app-tab";
import { BottomNavIcon } from "@/components/meal-planner/bottom-nav-icon";

type BottomNavProps = {
  activeTab: AppTab;
  onTabChange: (tab: AppTab) => void;
};

const TABS: { id: AppTab; label: string }[] = [
  { id: "home", label: "Home" },
  { id: "deals", label: "Deals" },
  { id: "cook", label: "Cook" },
  { id: "saved", label: "Saved" },
  { id: "feedback", label: "Feedback" },
  { id: "settings", label: "Settings" },
];

export function BottomNav({ activeTab, onTabChange }: BottomNavProps) {
  return (
    <nav className="bottom-nav" aria-label="Main">
      <ul className="bottom-nav-list">
        {TABS.map((tab) => (
          <li key={tab.id} className="bottom-nav-item">
            <button
              type="button"
              className={`bottom-nav-button${activeTab === tab.id ? " bottom-nav-button--active" : ""}`}
              aria-label={tab.label}
              aria-current={activeTab === tab.id ? "page" : undefined}
              onClick={() => onTabChange(tab.id)}
            >
              <BottomNavIcon tab={tab.id} />
              <span className="bottom-nav-button-label">{tab.label}</span>
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );
}
