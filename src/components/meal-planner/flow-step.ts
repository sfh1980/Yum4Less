export type FlowStep = "welcome" | "ingredients" | "pantry" | "results";

export function getInitialFlowStep(): FlowStep {
  return "welcome";
}
