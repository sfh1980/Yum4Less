import { WEEKLY_AD_CHAINS } from "@/lib/weekly-ad-ingestion/weekly-ad-chain-registry";
import type { OwnerChainToolLine } from "@/lib/owner/ingest-markets-copy";

/**
 * Adapter capability for Owner Check — which locators and flyer paths we
 * already wrote. Not a roster of which banners are ranked in a ZIP.
 */
const OFFICIAL_LIST_CHAIN_IDS = new Set(["kroger", "publix", "target", "whole-foods"]);

const CHAIN_LABELS: Record<string, string> = {
  kroger: "Kroger family",
  publix: "Publix",
  walmart: "Walmart",
  aldi: "Aldi",
  "food-lion": "Food Lion",
  lidl: "Lidl",
  "dollar-general": "Dollar General",
  target: "Target",
  "whole-foods": "Whole Foods",
};

export function listOwnerChainTools(): OwnerChainToolLine[] {
  return WEEKLY_AD_CHAINS.map((chainId) => ({
    chainId,
    label: CHAIN_LABELS[chainId] ?? chainId,
    officialList: OFFICIAL_LIST_CHAIN_IDS.has(chainId),
    flyer: true,
  }));
}

export function formatOwnerChainToolLine(tool: OwnerChainToolLine): string {
  const parts: string[] = [];
  if (tool.officialList) {
    parts.push("official list");
  }
  if (tool.flyer) {
    parts.push("flyer");
  }
  if (parts.length === 0) {
    parts.push("none");
  }
  return `${tool.label}: ${parts.join(" + ")}`;
}
