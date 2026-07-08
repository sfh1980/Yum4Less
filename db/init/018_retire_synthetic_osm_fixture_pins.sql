-- Retire leftover synthetic OSM fixture pins that shared the live Overpass
-- id namespace (osm-node-90000*). Fixture upserts now use fixture-osm-* +
-- yum4less-map-fixture; owner/dev DBs must not retain rehearsal rows as
-- live-looking storefronts.
--
-- Price observations are dropped with the synthetic store rows (not migrated
-- into live osm-* or ranked ids). Clear ranked Aldi source_store_id values
-- that still point at the old fake pin ids.

-- Prefer verified bootstrap slug; fall back to ZIP-market catalog row for Aldi.
do $$
declare
  target_store_id text;
begin
  select id into target_store_id
  from stores
  where id = 'aldi-mechanicsville'
  limit 1;

  if target_store_id is null then
    select id into target_store_id
    from stores
    where id = 'aldi-23111'
    limit 1;
  end if;

  if target_store_id is not null then
    delete from price_observations target
    using price_observations source
    where source.store_id = 'osm-node-900007'
      and target.store_id = target_store_id
      and target.ingredient_id = source.ingredient_id;

    update price_observations
    set store_id = target_store_id
    where store_id = 'osm-node-900007';
  end if;
end $$;

-- Drop any remaining price_observations bound to the synthetic osm-node-90000* band.
delete from price_observations
where store_id ~ '^osm-(node|way)-90000[0-9]+$';

-- Clear ranked Aldi links that still cite synthetic OSM fixture ids.
update stores
set source_store_id = null
where source_store_id ~ '^osm-(node|way)-90000[0-9]+$'
   or source_store_id like 'fixture-osm-%';

-- Remove synthetic pins from the live osm-* namespace (and any leftover fixture rows
-- if an owner DB was accidentally written under the new fixture identity).
delete from stores
where id ~ '^osm-(node|way)-90000[0-9]+$'
   or id like 'fixture-osm-%'
   or source_name = 'yum4less-map-fixture';

-- Repair live OSM rows whose source_name was overwritten by historical
-- weekly-ad touchStoreVerification (location provenance must remain forever).
update stores
set source_name = 'openstreetmap-overpass'
where id ~ '^osm-(node|way)-[0-9]+$'
  and id !~ '^osm-(node|way)-90000[0-9]+$'
  and (
    source_name like '%-weekly-ad-scrape'
    or source_name is null
  );
