export type AnalyticsSinkKind = "memory" | "postgres" | "stdout";

export function isAnalyticsEnabled() {
  return process.env.YUM4LESS_ENABLE_ANALYTICS === "1";
}

export function getAnalyticsSinkKind(): AnalyticsSinkKind {
  const configured = process.env.YUM4LESS_ANALYTICS_SINK;
  if (configured === "postgres" || configured === "stdout" || configured === "memory") {
    return configured;
  }

  return process.env.NODE_ENV === "production" ? "stdout" : "memory";
}
