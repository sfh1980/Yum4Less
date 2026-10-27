-- Flyer provenance for weekly-ad prices. Nullable so the image already running
-- can keep inserting rows that do not know these columns.
-- weekly_ad_flyer_hashes stays keyed by chain. The running upsert is
-- "on conflict (chain)". A primary-key change waits for the code that writes flyer_key.

alter table price_observations
  add column if not exists source_flyer_key text,
  add column if not exists source_flyer_kind text;

alter table weekly_ad_flyer_hashes
  add column if not exists flyer_key text;
