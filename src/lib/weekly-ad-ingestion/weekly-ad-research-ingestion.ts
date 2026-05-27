import { getWeeklyAdChainConfig } from "@/lib/weekly-ad-ingestion/weekly-ad-chain-config";
import type {
  WeeklyAdChain,
  WeeklyAdIngestionClient,
  WeeklyAdIngestionInput,
  WeeklyAdIngestionResult,
} from "@/lib/weekly-ad-ingestion/weekly-ad-ingestion-types";

export function createResearchWeeklyAdIngestionClient(
  chain: WeeklyAdChain,
): WeeklyAdIngestionClient {
  const config = getWeeklyAdChainConfig(chain);

  return {
    chain,
    label: config?.label ?? `${chain} weekly ad ingestion (research)`,
    configured: false,
    researchTargets: config?.researchTargets ?? [],
    ingestWeeklyAd: (input) => ingestResearchWeeklyAd(chain, input),
  };
}

async function ingestResearchWeeklyAd(
  chain: WeeklyAdChain,
  input: WeeklyAdIngestionInput,
): Promise<WeeklyAdIngestionResult> {
  const config = getWeeklyAdChainConfig(chain);

  return {
    chain,
    label: config?.label ?? `${chain} weekly ad ingestion (research)`,
    status: "research",
    provenance: "not-configured",
    retrievalMode: "none",
    configured: false,
    fallbackUsed: false,
    offers: [],
    message: `${config?.label ?? chain} is registered for ${input.storeName} (${input.zipCode}) but live scraping is not wired yet.`,
    fetchedAt: new Date().toISOString(),
    termsNote:
      config?.termsNote ??
      "Weekly-ad scraping for this chain is still in research and does not feed ranked pricing yet.",
  };
}
