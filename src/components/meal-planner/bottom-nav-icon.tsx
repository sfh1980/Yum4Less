import { type AppTab } from "@/components/meal-planner/app-tab";

type BottomNavIconProps = {
  tab: AppTab;
};

const ICONS: Record<AppTab, string[]> = {
  home: [
    "M5 12l-2 0l9-9l9 9l-2 0",
    "M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7",
    "M9 21v-6a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v6",
  ],
  deals: [
    "M7.5 7.5h.01",
    "M3 6v5.172a2 2 0 0 0 .586 1.414l7.71 7.71a2.41 2.41 0 0 0 3.408 0l5.592-5.592a2.41 2.41 0 0 0 0-3.408l-7.71-7.71a2 2 0 0 0-1.414-.586h-5.172a3 3 0 0 0-3 3z",
  ],
  cook: [
    "M19 3v12h-5c-.023-3.681.184-7.406 5-12z",
    "M19 15v6h-1v-3",
    "M9 3v16a1 1 0 0 0 1 1h3V3",
    "M8 3h8",
  ],
  saved: ["M18 7v14l-6-4-6 4V7a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4z"],
  feedback: [
    "M8 9h8",
    "M8 13h6",
    "M12 20l-3-3H7a3 3 0 0 1-3-3V8a3 3 0 0 1 3-3h10a3 3 0 0 1 3 3v6a3 3 0 0 1-3 3h-2z",
  ],
  settings: [
    "M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 0 0 2.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 0 0 1.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 0 0-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 0 0-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 0 0-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 0 0-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 0 0 1.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z",
    "M9 12a3 3 0 1 0 6 0a3 3 0 0 0-6 0",
  ],
};

/** Tabler-equivalent outline icons as inline SVG — no extra icon font. */
export function BottomNavIcon({ tab }: BottomNavIconProps) {
  return (
    <svg
      aria-hidden="true"
      className="bottom-nav-button-icon"
      fill="none"
      height={16}
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.75}
      viewBox="0 0 24 24"
      width={16}
    >
      {ICONS[tab].map((d) => (
        <path d={d} key={d} />
      ))}
    </svg>
  );
}
