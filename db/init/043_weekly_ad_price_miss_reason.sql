-- Why a weekly-ad chain last wrote no current rows.
-- The morning note reads this when the chain has no fresh prices.
-- Nullable. A later successful remember() clears it.

alter table weekly_ad_flyer_hashes
  add column if not exists price_miss_reason text;
