export const INGEST_OVERLAY_NOTICE =
  "Cron uses this table only when ingest YUM4LESS_INGEST_ZIPS is unset. Remove that overlay after you add markets, or the next ingest run will ignore these rows.";

export const MISSING_ACTIVE_MARKETS_MESSAGE =
  "Ingest markets could not be loaded. Apply db/init/025 if active_markets is missing.";

export const NO_RANKED_V1_CHAIN_PREVIEW_NOTICE =
  "No Kroger, Aldi, Publix, or Food Lion in this first look. Activating still books the ZIP for map/catalog; ranked dinner estimates stay map-only here until those banners appear.";

export type OwnerMarketStorePreview = {
  name: string;
  city: string;
  state: string;
  kind: string;
};
