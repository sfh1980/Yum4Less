create table if not exists provider_store_search_snapshots (
  id bigserial primary key,
  provider text not null,
  status text not null check (status in ('available', 'not-configured', 'fallback', 'error')),
  provenance text not null check (provenance in ('official-api', 'fallback-local', 'not-configured')),
  configured boolean not null,
  fallback_used boolean not null default false,
  search_zip_code text,
  search_latitude numeric(9, 6) not null,
  search_longitude numeric(9, 6) not null,
  radius_miles integer not null check (radius_miles > 0),
  store_count integer not null default 0 check (store_count >= 0),
  message text not null,
  fetched_at timestamptz not null,
  captured_at timestamptz not null default now(),
  stores_json jsonb not null default '[]'::jsonb
);

create index if not exists idx_provider_store_search_snapshots_provider_captured
  on provider_store_search_snapshots (provider, captured_at desc);
