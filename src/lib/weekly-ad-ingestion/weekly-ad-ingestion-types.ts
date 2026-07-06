import type { StoreChain } from "@/lib/provider-rollout";

export type WeeklyAdChain = Extract<
  StoreChain,
  | "kroger"
  | "publix"
  | "walmart"
  | "aldi"
  | "food-lion"
  | "lidl"
  | "dollar-general"
>;

export type WeeklyAdIngestionStatus =
  | "research"
  | "not-configured"
  | "blocked-terms"
  | "live"
  | "cached"
  | "error";

export type WeeklyAdRawOffer = {
  productName: string;
  price: number;
  saleLabel?: string;
  validThrough?: string;
};

export type WeeklyAdOffer = {
  chain: WeeklyAdChain;
  storeId: string;
  ingredientId?: string;
  productName: string;
  price: number;
  saleLabel?: string;
  validThrough?: string;
  sourceUrl: string;
  observedAt: string;
  confidenceScore: number;
  matchConfidence?: number;
};

export type WeeklyAdIngestionResult = {
  chain: WeeklyAdChain;
  label: string;
  status: WeeklyAdIngestionStatus;
  provenance: "weekly-ad-scrape" | "weekly-ad-partner-feed" | "not-configured";
  retrievalMode: "none" | "live" | "cached";
  configured: boolean;
  fallbackUsed: boolean;
  offers: WeeklyAdOffer[];
  message: string;
  fetchedAt: string;
  termsNote: string;
};

export type WeeklyAdIngestionInput = {
  chain: WeeklyAdChain;
  storeId: string;
  storeName: string;
  zipCode: string;
  trackedIngredientIds: string[];
};

export type WeeklyAdIngestionClient = {
  chain: WeeklyAdChain;
  label: string;
  configured: boolean;
  researchTargets: string[];
  ingestWeeklyAd(input: WeeklyAdIngestionInput): Promise<WeeklyAdIngestionResult>;
};

export type WeeklyAdOfferSyncSummary = {
  chain: WeeklyAdChain;
  storeId: string;
  syncedCount: number;
  skippedCount: number;
  failedCount: number;
  retrievalMode: WeeklyAdIngestionResult["retrievalMode"];
  message: string;
};

/**
 * All-time weekly-ad scrape row inventory per store — not a freshness or health signal.
 * Compare with `weeklyAdPromotionReadiness` when diagnosing stale vs missing ingest.
 */
export type WeeklyAdIngestionStatusSummary = {
  chain: WeeklyAdChain;
  storeId: string;
  sourceName: string;
  observationCount: number;
  lastCapturedAt?: string;
  message: string;
};

export function getWeeklyAdSourceName(chain: WeeklyAdChain): string {
  return `${chain}-weekly-ad-scrape`;
}
