-- Option A Slice 4: seed Mechanicsville Aldi catalog ↔ OSM twin as one identity.
-- Manual/seeded confirm (not live auto-confirm). Q3: ranked catalog outranks OSM
-- (no official API) — canonical = aldi-mechanicsville.
--
-- Does NOT insert stores rows — only links when both members already exist
-- (ingest / CI bootstrap). Avoids Map/Settings side effects with the identity
-- expand flag still OFF.
-- Idempotent: safe to re-apply.
-- Fixture-validated confidence 0.985 (pointer + name + grocery↔supermarket type
-- + pointer); live-shaped both-grocery would score 1.0 — seed uses 0.985.

insert into store_identities (
  id,
  canonical_store_id,
  display_name,
  kind,
  city,
  state,
  latitude,
  longitude,
  display_source_name,
  last_resolved_at
)
select
  'aldi-mechanicsville',
  'aldi-mechanicsville',
  coalesce(catalog.name, 'Aldi'),
  'grocery',
  coalesce(catalog.city, 'Mechanicsville'),
  coalesce(catalog.state, 'VA'),
  catalog.latitude,
  catalog.longitude,
  coalesce(catalog.source_name, 'aldi-weekly-ad-scrape'),
  now()
from stores catalog
inner join stores osm on osm.id = 'osm-node-6531578976'
where catalog.id = 'aldi-mechanicsville'
  and not exists (
    select 1 from store_identities where id = 'aldi-mechanicsville'
  );

insert into store_identity_aliases (
  identity_id,
  source_system,
  external_id,
  store_id,
  member_role,
  link_status,
  match_method,
  match_confidence,
  notes
)
select
  'aldi-mechanicsville',
  'aldi-weekly-ad-scrape',
  'aldi-mechanicsville',
  'aldi-mechanicsville',
  'canonical',
  'confirmed',
  'seeded',
  0.9850,
  'Option A Slice 4 seeded link; fixture scorer confidence 0.985 (pointer bonus; +0.135 above confirmThreshold)'
where exists (select 1 from store_identities where id = 'aldi-mechanicsville')
  and not exists (
    select 1
    from store_identity_aliases
    where source_system = 'aldi-weekly-ad-scrape'
      and external_id = 'aldi-mechanicsville'
  );

insert into store_identity_aliases (
  identity_id,
  source_system,
  external_id,
  store_id,
  member_role,
  link_status,
  match_method,
  match_confidence,
  notes
)
select
  'aldi-mechanicsville',
  'openstreetmap-overpass',
  'osm-node-6531578976',
  'osm-node-6531578976',
  'alias',
  'confirmed',
  'seeded',
  0.9850,
  'Option A Slice 4 seeded link; OSM map-context alias (not Settings-selectable when catalog Aldi present)'
where exists (select 1 from store_identities where id = 'aldi-mechanicsville')
  and not exists (
    select 1
    from store_identity_aliases
    where source_system = 'openstreetmap-overpass'
      and external_id = 'osm-node-6531578976'
  );
