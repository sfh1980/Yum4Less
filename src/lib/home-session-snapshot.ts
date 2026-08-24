import type { AppTab } from "@/components/meal-planner/app-tab";
import type { FlowStep } from "@/components/meal-planner/flow-step";
import type {
  MarketSearchState,
  RecommendationState,
} from "@/components/meal-planner/types";

const STORAGE_KEY = "yum4less.home-session.v1";
const SNAPSHOT_VERSION = 2;

const FLOW_STEPS: ReadonlySet<FlowStep> = new Set([
  "welcome-budget",
  "welcome-dietary",
  "ingredients",
  "pantry",
  "results",
]);

const APP_TABS: ReadonlySet<AppTab> = new Set([
  "home",
  "deals",
  "cook",
  "saved",
  "feedback",
  "settings",
]);

export type HomeSessionSnapshot = {
  version: 1 | typeof SNAPSHOT_VERSION;
  flowStep: FlowStep;
  marketSearchState: MarketSearchState;
  recommendationState: RecommendationState;
};

export type AppReturnSnapshot = {
  version: typeof SNAPSHOT_VERSION;
  splashFinished: boolean;
  activeTab: AppTab;
  flowStep: FlowStep;
  marketSearchState?: MarketSearchState;
  recommendationState?: RecommendationState;
};

function canUseSessionStorage(): boolean {
  return typeof window !== "undefined" && typeof window.sessionStorage !== "undefined";
}

function isAppTab(value: unknown): value is AppTab {
  return typeof value === "string" && APP_TABS.has(value as AppTab);
}

function isFlowStep(value: unknown): value is FlowStep {
  return typeof value === "string" && FLOW_STEPS.has(value as FlowStep);
}

function isReadyDinners(
  marketSearchState: MarketSearchState | undefined,
  recommendationState: RecommendationState | undefined,
): boolean {
  return (
    marketSearchState?.status === "ready" &&
    Boolean(marketSearchState.market) &&
    recommendationState?.status === "ready"
  );
}

function persistSnapshot(snapshot: AppReturnSnapshot): void {
  if (!canUseSessionStorage()) {
    return;
  }

  try {
    const payload: AppReturnSnapshot = {
      version: SNAPSHOT_VERSION,
      splashFinished: snapshot.splashFinished,
      activeTab: snapshot.activeTab,
      flowStep: snapshot.flowStep,
    };
    if (snapshot.marketSearchState) {
      payload.marketSearchState = snapshot.marketSearchState;
    }
    if (snapshot.recommendationState) {
      payload.recommendationState = snapshot.recommendationState;
    }
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // Quota or private-mode failures should not break ranking.
  }
}

export function writeAppReturnSnapshot(
  partial: Partial<Omit<AppReturnSnapshot, "version">>,
): void {
  const existing = readAppReturnSnapshot();
  persistSnapshot({
    version: SNAPSHOT_VERSION,
    splashFinished: partial.splashFinished ?? existing?.splashFinished ?? false,
    activeTab: partial.activeTab ?? existing?.activeTab ?? "settings",
    flowStep: partial.flowStep ?? existing?.flowStep ?? "welcome-budget",
    marketSearchState:
      "marketSearchState" in partial
        ? partial.marketSearchState
        : existing?.marketSearchState,
    recommendationState:
      "recommendationState" in partial
        ? partial.recommendationState
        : existing?.recommendationState,
  });
}

export function writeHomeSessionSnapshot(snapshot: Omit<HomeSessionSnapshot, "version">): void {
  writeAppReturnSnapshot({
    splashFinished: true,
    flowStep: snapshot.flowStep,
    marketSearchState: snapshot.marketSearchState,
    recommendationState: snapshot.recommendationState,
  });
}

export function readAppReturnSnapshot(): AppReturnSnapshot | null {
  if (!canUseSessionStorage()) {
    return null;
  }

  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as {
      version?: number;
      splashFinished?: boolean;
      activeTab?: unknown;
      flowStep?: unknown;
      marketSearchState?: MarketSearchState;
      recommendationState?: RecommendationState;
    };
    if (parsed.version === 1) {
      if (!isFlowStep(parsed.flowStep)) {
        return null;
      }
      if (!isReadyDinners(parsed.marketSearchState, parsed.recommendationState)) {
        return null;
      }
      return {
        version: SNAPSHOT_VERSION,
        splashFinished: true,
        activeTab: "home",
        flowStep: parsed.flowStep,
        marketSearchState: parsed.marketSearchState,
        recommendationState: parsed.recommendationState,
      };
    }
    if (parsed.version !== SNAPSHOT_VERSION) {
      return null;
    }
    if (!isAppTab(parsed.activeTab) || !isFlowStep(parsed.flowStep)) {
      return null;
    }
    return {
      version: SNAPSHOT_VERSION,
      splashFinished: parsed.splashFinished === true,
      activeTab: parsed.activeTab,
      flowStep: parsed.flowStep,
      ...(parsed.marketSearchState
        ? { marketSearchState: parsed.marketSearchState }
        : {}),
      ...(parsed.recommendationState
        ? { recommendationState: parsed.recommendationState }
        : {}),
    };
  } catch {
    return null;
  }
}

export function readHomeSessionSnapshot(): HomeSessionSnapshot | null {
  const snapshot = readAppReturnSnapshot();
  if (
    !snapshot ||
    !isReadyDinners(snapshot.marketSearchState, snapshot.recommendationState)
  ) {
    return null;
  }

  return {
    version: snapshot.version,
    flowStep: snapshot.flowStep,
    marketSearchState: snapshot.marketSearchState!,
    recommendationState: snapshot.recommendationState!,
  };
}

export function clearHomeSessionDinners(): void {
  if (!readAppReturnSnapshot()) {
    return;
  }

  writeAppReturnSnapshot({
    marketSearchState: undefined,
    recommendationState: undefined,
  });
}

export function clearHomeSessionSnapshot(): void {
  if (!canUseSessionStorage()) {
    return;
  }

  try {
    window.sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // Ignore.
  }
}

/** Restore after client-side Back from FAQ/Terms. Skip on full reload (splash → budget). */
export function shouldRestoreHomeSessionSnapshot(): boolean {
  if (typeof performance === "undefined") {
    return false;
  }

  const entries = performance.getEntriesByType("navigation");
  const timing = entries[0] as PerformanceNavigationTiming | undefined;
  if (timing?.type === "reload") {
    return false;
  }

  const legacy = (performance as Performance & { navigation?: { type?: number } })
    .navigation;
  if (legacy?.type === 1) {
    return false;
  }

  return true;
}
