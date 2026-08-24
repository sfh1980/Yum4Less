export type FlowStep =
  | "welcome-budget"
  | "welcome-dietary"
  | "ingredients"
  | "pantry"
  | "results";

export function getInitialFlowStep(): FlowStep {
  return "welcome-budget";
}

export function isWelcomeFlowStep(step: FlowStep): boolean {
  return step === "welcome-budget" || step === "welcome-dietary";
}
