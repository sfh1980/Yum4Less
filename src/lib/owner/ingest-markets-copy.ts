export const INGEST_OVERLAY_NOTICE =
  "Cron uses this table only when ingest YUM4LESS_INGEST_ZIPS is unset. Remove that overlay after you add markets, or the next ingest run will ignore these rows.";

export const MISSING_ACTIVE_MARKETS_MESSAGE =
  "Ingest markets could not be loaded. Apply db/init/025 if active_markets is missing.";

export const NO_RANKED_V1_CHAIN_PREVIEW_NOTICE =
  "No Kroger, Aldi, Publix, Food Lion, or Walmart in this first look. Activating still books the ZIP for map/catalog. Dollar General can collect directional weekly-ad sales; dinner estimates from Dollar General only apply when none of those supermarket banners are nearby and coverage floors pass.";

export type OwnerMarketStorePreview = {
  name: string;
  city: string;
  state: string;
  kind: string;
  localityIsApproximate?: boolean;
  group?: "will-ingest" | "food-only" | "needs-you";
  inIngestFence?: boolean;
};

export type OwnerMarketAdmission = {
  densityClass: "packed" | "urban" | "suburban" | "rural";
  groceryCountIn8Mi: number;
  ingestMiles: number;
  omittedCount: number;
  headline: string;
  zctaWarning?: string;
};
