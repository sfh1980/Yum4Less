import { type AppTab } from "@/components/meal-planner/app-tab";

type BottomNavIconProps = {
  tab: AppTab;
};

type IconSpec = {
  fillRule?: "evenodd";
  paths: string[];
};

/** Filled glyphs matching V3 Mock1 shopping-list tab icons. Colors live in CSS tokens. */
const ICONS: Record<AppTab, IconSpec> = {
  home: {
    paths: [
      "M12 3.1 3.2 11H5v8.2A1.8 1.8 0 0 0 6.8 21h3.4v-5.2h3.6V21h3.4A1.8 1.8 0 0 0 19 19.2V11h1.8L12 3.1Z",
    ],
  },
  deals: {
    fillRule: "evenodd",
    paths: [
      "M4.2 6.2A2.2 2.2 0 0 1 6.4 4h5.1c.4 0 .8.16 1.1.46l8 8.1a2.4 2.4 0 0 1 0 3.38l-5.3 5.32a2.4 2.4 0 0 1-3.38 0l-8.1-8.1A1.6 1.6 0 0 1 4 11.1V6.2Zm4.4 1.1a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3Z",
    ],
  },
  cook: {
    paths: [
      "M8.2 2.8h1.7c.3 1.8.4 3.7.2 5.5.7.4 1.1 1.1 1.1 2.1V21h-4.1v-10.6c0-1 .4-1.7 1.1-2.1-.2-1.8-.1-3.7.2-5.5Zm-1.5 0h1.1c-.2 1.6-.3 3.2-.2 4.8H6.9c.1-1.6.2-3.2.2-4.8Zm2.8 0h1.1c.2 1.6.3 3.2.2 4.8h-1.1c.1-1.6 0-3.2-.2-4.8Z",
      "M16.2 2.8c2.4 3.6 2.6 8.2.4 12.1V21h-2.2v-6.1c-2.2-3.9-2-8.5.4-12.1h1.4Z",
    ],
  },
  saved: {
    paths: [
      "M7.2 3.2A2.2 2.2 0 0 1 9.4 1h5.2A2.2 2.2 0 0 1 16.8 3.2V21l-4.8-3.2L7.2 21V3.2Z",
    ],
  },
  feedback: {
    paths: [
      "M6.2 4.2h11.6A3.8 3.8 0 0 1 21.6 8v6.2a3.8 3.8 0 0 1-3.8 3.8h-5.1L8.2 21.4v-3.4H6.2A3.8 3.8 0 0 1 2.4 14.2V8A3.8 3.8 0 0 1 6.2 4.2Z",
    ],
  },
  settings: {
    fillRule: "evenodd",
    paths: [
      "M10.33 4.32c.42-1.76 2.92-1.76 3.35 0a1.72 1.72 0 0 0 2.57 1.06c1.54-.94 3.31.83 2.37 2.37a1.72 1.72 0 0 0 1.06 2.57c1.76.43 1.76 2.93 0 3.35a1.72 1.72 0 0 0-1.06 2.57c.94 1.54-.83 3.31-2.37 2.37a1.72 1.72 0 0 0-2.57 1.07c-.43 1.75-2.93 1.75-3.35 0a1.72 1.72 0 0 0-2.57-1.07c-1.54.94-3.31-.83-2.37-2.37a1.72 1.72 0 0 0-1.07-2.57c-1.75-.42-1.75-2.92 0-3.35a1.72 1.72 0 0 0 1.07-2.57c-.94-1.54.83-3.31 2.37-2.37.99.61 2.29.07 2.57-1.06ZM12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z",
    ],
  },
};

export function BottomNavIcon({ tab }: BottomNavIconProps) {
  const icon = ICONS[tab];
  return (
    <svg
      aria-hidden="true"
      className={`bottom-nav-button-icon bottom-nav-button-icon--${tab}`}
      data-tab-icon={tab}
      fill="currentColor"
      height={20}
      viewBox="0 0 24 24"
      width={20}
    >
      {icon.paths.map((d) => (
        <path d={d} fillRule={icon.fillRule} key={d} />
      ))}
    </svg>
  );
}
