-- Retire ZIP-market Aldi twin aldi-23111 when bootstrap slug aldi-mechanicsville
-- already represents the same storefront. Prevents Settings/map showing two
-- ranked Aldi catalog pins at identical coordinates.
--
-- Idempotent: safe on DBs that never had aldi-23111 or already deleted it.
-- Requires slug aldi-mechanicsville (CI/bootstrap). If only the ZIP twin exists,
-- leave it — do not invent a rename path that fights PK/FK constraints.
-- Observations: drop exact ingredient duplicates on the slug first, then reassign.

do $$
declare
  slug_id constant text := 'aldi-mechanicsville';
  twin_id constant text := 'aldi-23111';
  twin_exists boolean;
  slug_exists boolean;
begin
  select exists(select 1 from stores where id = twin_id) into twin_exists;
  select exists(select 1 from stores where id = slug_id) into slug_exists;

  if not twin_exists or not slug_exists then
    return;
  end if;

  -- Drop exact ingredient duplicates on slug before reassignment (unique key risk).
  delete from price_observations target
  using price_observations source
  where source.store_id = twin_id
    and target.store_id = slug_id
    and target.ingredient_id = source.ingredient_id;

  update price_observations
  set store_id = slug_id
  where store_id = twin_id;

  -- Prefer fresher twin coords / live OSM source_store_id onto the slug when useful.
  update stores as slug
  set
    latitude = twin.latitude,
    longitude = twin.longitude,
    source_store_id = coalesce(
      nullif(trim(twin.source_store_id), ''),
      slug.source_store_id
    ),
    city = coalesce(nullif(trim(twin.city), ''), slug.city),
    state = coalesce(nullif(trim(twin.state), ''), slug.state),
    last_verified_at = greatest(slug.last_verified_at, twin.last_verified_at)
  from stores as twin
  where slug.id = slug_id
    and twin.id = twin_id
    and (
      slug.source_store_id is null
      or trim(slug.source_store_id) = ''
      or slug.source_store_id like 'fixture-osm-%'
      or slug.source_store_id ~ '^osm-(node|way)-90000[0-9]+$'
      or twin.source_store_id = 'osm-node-6531578976'
      or abs(slug.latitude - twin.latitude) > 0.00001
      or abs(slug.longitude - twin.longitude) > 0.00001
    );

  delete from stores where id = twin_id;
end $$;
