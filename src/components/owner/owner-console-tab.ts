export const OWNER_CONSOLE_TABS = [
  { id: "reviews", label: "Ingredient review" },
  { id: "feedback", label: "User feedback" },
  { id: "analytics", label: "Analytics" },
  { id: "coverage", label: "Coverage" },
] as const;

export type OwnerConsoleTab = (typeof OWNER_CONSOLE_TABS)[number]["id"];

export const DEFAULT_OWNER_CONSOLE_TAB: OwnerConsoleTab = "reviews";
