export type FlowStep = "welcome" | "ingredients" | "pantry" | "rank" | "results";

export function getInitialFlowStep(): FlowStep {
  return "welcome";
}
