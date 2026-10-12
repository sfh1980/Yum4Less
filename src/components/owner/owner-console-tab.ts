export const OWNER_CONSOLE_TABS = [
  { id: "reviews", label: "Ingredient review" },
  { id: "feedback", label: "User feedback" },
  { id: "analytics", label: "Analytics" },
  { id: "coverage", label: "Coverage" },
  { id: "markets", label: "Markets" },
  { id: "after-update", label: "After update" },
  { id: "morning", label: "This morning" },
] as const;

export type OwnerConsoleTab = (typeof OWNER_CONSOLE_TABS)[number]["id"];

export const DEFAULT_OWNER_CONSOLE_TAB: OwnerConsoleTab = "reviews";
