-- Cache the ZIP codes whose Census outline touches an active ZIP.
-- The morning job reads this list. The shopper's 8-mile circle does not.

alter table zip_geocode_cache
  add column if not exists touching_zips text[];

alter table zip_geocode_cache
  add column if not exists touching_zips_fetched_at timestamptz;
