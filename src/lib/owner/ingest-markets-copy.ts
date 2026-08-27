export const INGEST_OVERLAY_NOTICE =
  "Cron uses this table only when ingest YUM4LESS_INGEST_ZIPS is unset. Remove that overlay after you add markets, or the next ingest run will ignore these rows.";

export const MISSING_ACTIVE_MARKETS_MESSAGE =
  "Ingest markets could not be loaded. Apply db/init/025 if active_markets is missing.";

export type OwnerMarketStorePreview = {
  name: string;
  city: string;
  state: string;
  kind: string;
};
