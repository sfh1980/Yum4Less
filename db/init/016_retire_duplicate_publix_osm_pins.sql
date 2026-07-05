-- Retire duplicate Publix OSM pins when an official locator row exists within
-- MAP_OSM_DEDUPE_PROXIMITY_MILES (0.15 mi). Resolves osm-way-789560637 → publix-1626
-- and any other existing Publix OSM/locator pairs in the same radius.

do $$
declare
  pair record;
  migrated_count integer;
begin
  for pair in
    with locator_stores as (
      select id, latitude, longitude
      from stores
      where source_name = 'publix-store-locator'
    ),
    osm_duplicates as (
      select
        osm.id as osm_store_id,
        locator.id as locator_store_id,
        (
          3958.8 * acos(
            least(
              1.0,
              greatest(
                -1.0,
                cos(radians(osm.latitude)) * cos(radians(locator.latitude))
                  * cos(radians(locator.longitude) - radians(osm.longitude))
                  + sin(radians(osm.latitude)) * sin(radians(locator.latitude))
              )
            )
          )
        ) as distance_miles
      from stores osm
      cross join locator_stores locator
      where osm.id like 'osm-%'
        and lower(osm.name) like '%publix%'
    ),
    nearest_locator as (
      select distinct on (osm_store_id)
        osm_store_id,
        locator_store_id
      from osm_duplicates
      where distance_miles <= 0.15
      order by osm_store_id, distance_miles
    )
    select osm_store_id, locator_store_id
    from nearest_locator
  loop
    delete from price_observations target
    using price_observations source
    where source.store_id = pair.osm_store_id
      and target.store_id = pair.locator_store_id
      and target.ingredient_id = source.ingredient_id;

    update price_observations
    set store_id = pair.locator_store_id
    where store_id = pair.osm_store_id;

    get diagnostics migrated_count = row_count;

    delete from stores
    where id = pair.osm_store_id;
  end loop;
end $$;
