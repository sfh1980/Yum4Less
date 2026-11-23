-- Map pins from the grocery OpenStreetMap file. Not part of the nightly store walk.
-- Rollback: drop table if exists osm_grocery_places;

create table if not exists osm_grocery_places (
  id text primary key,
  osm_type text not null check (osm_type in ('node', 'way')),
  osm_id bigint not null,
  name text not null,
  kind text not null check (kind in ('grocery', 'big-box', 'specialty', 'dollar-market')),
  city text not null default '',
  state text not null default '',
  latitude numeric(9, 6) not null,
  longitude numeric(9, 6) not null,
  shop_tag text not null,
  source_name text not null default 'osm-extract',
  file_timestamp timestamptz,
  consecutive_misses integer not null default 0 check (consecutive_misses >= 0),
  closed_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (osm_type, osm_id)
);

-- Radius search filters latitude first, then longitude, on open rows only.
create index if not exists osm_grocery_places_open_latitude
  on osm_grocery_places (latitude)
  where closed_at is null;
