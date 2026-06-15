-- Phase C: USDA SNAP retailer locator reference rows (map context only; not ranked pricing).

create table if not exists snap_retailer_locations (
  id text primary key,
  retailer_name text not null,
  retailer_type text not null,
  address_line1 text,
  city text not null,
  state text not null,
  zip_code text,
  latitude numeric(9, 6) not null,
  longitude numeric(9, 6) not null,
  snapshot_date date not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_snap_retailer_locations_state
  on snap_retailer_locations (state);

create index if not exists idx_snap_retailer_locations_zip
  on snap_retailer_locations (zip_code);

create index if not exists idx_snap_retailer_locations_coords
  on snap_retailer_locations (latitude, longitude);
