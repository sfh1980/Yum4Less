create table if not exists provider_product_pricing_snapshots (
  id bigserial primary key,
  provider text not null,
  provider_store_id text not null,
  store_name text not null,
  status text not null check (status in ('available', 'not-configured', 'fallback', 'error')),
  provenance text not null check (provenance in ('official-api', 'fallback-local', 'not-configured')),
  configured boolean not null,
  fallback_used boolean not null default false,
  tracked_ingredient_count integer not null check (tracked_ingredient_count >= 0),
  matched_ingredient_count integer not null check (matched_ingredient_count >= 0),
  message text not null,
  fetched_at timestamptz not null,
  captured_at timestamptz not null default now(),
  items_json jsonb not null default '[]'::jsonb
);

create index if not exists idx_provider_product_pricing_snapshots_latest
  on provider_product_pricing_snapshots (provider, provider_store_id, captured_at desc);
