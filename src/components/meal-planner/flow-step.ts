export type FlowStep = "welcome" | "ingredients" | "rank" | "results";

export function getInitialFlowStep(): FlowStep {
  return "welcome";
}
