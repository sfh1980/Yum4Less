-- Census "touches" saved an empty neighbor list for ZIP codes that do have neighbors.
-- The morning job keeps a saved list. Clear only the empty ones so the next add refetches.

update zip_geocode_cache
set touching_zips = null,
    touching_zips_fetched_at = null
where touching_zips is not null
  and cardinality(touching_zips) = 0;
