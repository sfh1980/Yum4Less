import type { WeeklyAdChain } from "@/lib/weekly-ad-ingestion/weekly-ad-ingestion-types";

export const WEEKLY_AD_CHAINS = [
  "kroger",
  "publix",
  "walmart",
  "aldi",
  "food-lion",
  "lidl",
  "dollar-general",
] as const satisfies readonly WeeklyAdChain[];

export function isWeeklyAdChain(chain: string): chain is WeeklyAdChain {
  return (WEEKLY_AD_CHAINS as readonly string[]).includes(chain);
}
