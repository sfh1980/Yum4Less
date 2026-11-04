import {
  isWeeklyAdChain,
  WEEKLY_AD_CHAINS,
} from "@/lib/weekly-ad-ingestion/weekly-ad-chain-registry";
import type { WeeklyAdChain } from "@/lib/weekly-ad-ingestion/weekly-ad-ingestion-types";

/**
 * Direct weekly-ad entry for one banner.
 * The scheduled command and ingest_jobs are not involved.
 */

export function readWeeklyAdOnlyChain(
  argv: readonly string[],
): WeeklyAdChain | undefined {
  let value: string | undefined;
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index] ?? "";
    if (arg === "--chain") {
      const next = argv[index + 1];
      if (next === undefined || next.startsWith("--")) {
        throw new Error(weeklyAdOnlyChainUsage());
      }
      value = next;
      break;
    }
    if (arg.startsWith("--chain=")) {
      value = arg.slice("--chain=".length);
      break;
    }
  }
  if (value === undefined) {
    return undefined;
  }
  const normalized = value.trim().toLowerCase();
  if (!isWeeklyAdChain(normalized)) {
    throw new Error(weeklyAdOnlyChainUsage());
  }
  return normalized;
}

export function storesForWeeklyAdOnlyChain<T extends { chain: string }>(
  stores: readonly T[],
  onlyChain: WeeklyAdChain | undefined,
): T[] {
  if (!onlyChain) {
    return [...stores];
  }
  return stores.filter((store) => store.chain === onlyChain);
}

function weeklyAdOnlyChainUsage(): string {
  return `Weekly-ad --chain accepts one of: ${WEEKLY_AD_CHAINS.join(", ")}.`;
}
