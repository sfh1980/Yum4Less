-- Retire fake fixture Aldi pin osm-node-900007 previously placed at wrong
-- neighborhood coords (37.6365, -77.3608). Canonical Mechanicsville Aldi is
-- aldi-mechanicsville / OSM 6531578976 at 37.611004, -77.336853.

-- Prefer verified bootstrap slug; fall back to ZIP-market catalog row.
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

  if target_store_id is null then
    delete from stores where id = 'osm-node-900007';
    return;
  end if;

  delete from price_observations target
  using price_observations source
  where source.store_id = 'osm-node-900007'
    and target.store_id = target_store_id
    and target.ingredient_id = source.ingredient_id;

  update price_observations
  set store_id = target_store_id
  where store_id = 'osm-node-900007';

  delete from stores
  where id = 'osm-node-900007';
end $$;
