-- One migration for the next ship.
-- valid_from null means the row was stored before start dates were kept.
-- raw_card_count is the Publix savings-card count, separate from offer_count.

alter table price_observations
  add column if not exists valid_from timestamptz;

alter table weekly_ad_flyer_hashes
  add column if not exists raw_card_count integer;
