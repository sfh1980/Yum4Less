export const ONBOARDING_STEPS = [
  "splash",
  "choose-location",
  "zip-input",
  "zip-pin",
  "radius",
  "shopping-style",
  "stores",
] as const;

export type OnboardingStep = (typeof ONBOARDING_STEPS)[number];

/** Required setup items counted in locked-tab copy. */
export const SETUP_ITEM_COUNT = 4;

const PERSISTABLE_STEPS = [
  "choose-location",
  "zip-input",
  "zip-pin",
  "radius",
  "shopping-style",
  "stores",
] as const satisfies readonly OnboardingStep[];

export type PersistableOnboardingStep = (typeof PERSISTABLE_STEPS)[number];

export const GPS_UNAVAILABLE_NOTICE =
  "GPS isn't available. Continue with a ZIP code and place a pin on the map.";

export function isOnboardingStep(value: unknown): value is OnboardingStep {
  return (
    typeof value === "string" &&
    (ONBOARDING_STEPS as readonly string[]).includes(value)
  );
}

export function isPersistableOnboardingStep(
  value: unknown,
): value is PersistableOnboardingStep {
  return (
    typeof value === "string" &&
    (PERSISTABLE_STEPS as readonly string[]).includes(value)
  );
}

export function parseOnboardingStep(value: unknown): OnboardingStep | undefined {
  return isOnboardingStep(value) ? value : undefined;
}

/**
 * Remaining required setup items (location, radius, shopping style, store pick)
 * based on the current wizard screen. Splash is not a setup item.
 */
export function remainingSetupStepCount(
  step: OnboardingStep,
  setupComplete: boolean,
): number {
  if (setupComplete) {
    return 0;
  }

  switch (step) {
    case "splash":
    case "choose-location":
    case "zip-input":
    case "zip-pin":
      return 4;
    case "radius":
      return 3;
    case "shopping-style":
      return 2;
    case "stores":
      return 1;
  }
}

export function formatLockedTabMessage(remainingSteps: number): string {
  if (remainingSteps <= 0) {
    return "Finish setup before this page can operate.";
  }

  if (remainingSteps === 1) {
    return "1 step needed before this works";
  }

  return `${remainingSteps} steps needed before this works`;
}

export function previousOnboardingStep(
  step: OnboardingStep,
  locationMode: "geolocation" | "zip" | undefined,
): OnboardingStep | null {
  switch (step) {
    case "splash":
    case "choose-location":
      return null;
    case "zip-input":
      return "choose-location";
    case "zip-pin":
      return "zip-input";
    case "radius":
      return locationMode === "geolocation" ? "choose-location" : "zip-pin";
    case "shopping-style":
      return "radius";
    case "stores":
      return "shopping-style";
  }
}

export function resolveResumeOnboardingStep(
  savedStep: unknown,
  locationMode: "geolocation" | "zip" | undefined,
): PersistableOnboardingStep {
  if (!isPersistableOnboardingStep(savedStep)) {
    return "choose-location";
  }

  if (
    locationMode === "geolocation" &&
    (savedStep === "zip-input" || savedStep === "zip-pin")
  ) {
    return "choose-location";
  }

  if (
    locationMode !== "geolocation" &&
    savedStep === "radius" &&
    locationMode !== "zip"
  ) {
    return "choose-location";
  }

  return savedStep;
}
