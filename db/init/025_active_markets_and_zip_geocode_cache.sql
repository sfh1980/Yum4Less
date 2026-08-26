-- Ingest market registry + durable ZIP geocode cache.
-- Empty on purpose: do not seed 23111 or any home ZIP. Cron uses active rows,
-- or an explicit YUM4LESS_INGEST_ZIPS overlay. Insert a market after migrate:
--   npm run markets:activate -- 23220

create table if not exists active_markets (
  zip_code char(5) primary key
    check (zip_code ~ '^[0-9]{5}$'),
  status text not null default 'active'
    check (status in ('active', 'paused', 'retired')),
  priority integer not null default 100,
  source text not null default 'ops'
    check (source in ('ops', 'organic_usage', 'bootstrap')),
  latitude numeric(9, 6),
  longitude numeric(9, 6),
  ingest_radius_miles numeric(6, 2),
  map_catalog_radius_miles numeric(6, 2),
  notes text,
  activated_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_active_markets_status_priority
  on active_markets (status, priority, zip_code);

create table if not exists zip_geocode_cache (
  zip_code char(5) primary key
    check (zip_code ~ '^[0-9]{5}$'),
  latitude numeric(9, 6) not null,
  longitude numeric(9, 6) not null,
  city text not null,
  state text not null,
  county text,
  timezone text,
  provider text not null
    check (provider in ('geocodio', 'seed')),
  resolved_at timestamptz not null default now()
);

create index if not exists idx_zip_geocode_cache_resolved_at
  on zip_geocode_cache (resolved_at desc);
