-- Market admission: density class + ingest miles, cached ZCTA outline,
-- ingest job queue, and weekly-ad flyer content hashes.
-- Apply with ingest `db:migrate`. Watchtower does not run this.

alter table active_markets
  add column if not exists density_class text
    check (
      density_class is null
      or density_class in ('packed', 'urban', 'suburban', 'rural')
    );

alter table active_markets
  add column if not exists ingest_miles numeric(6, 2);

alter table zip_geocode_cache
  add column if not exists zcta_geojson jsonb;

alter table zip_geocode_cache
  add column if not exists zcta_fetched_at timestamptz;

create table if not exists ingest_jobs (
  id text primary key,
  kind text not null
    check (
      kind in (
        'map-catalog',
        'weekly-ad',
        'snap-ensure',
        'provider-sync',
        'themealdb-from-sales',
        'ranked-price-freshness'
      )
    ),
  job_key text not null,
  run_date date not null,
  status text not null default 'queued'
    check (status in ('queued', 'running', 'succeeded', 'failed', 'skipped')),
  priority integer not null default 100,
  attempts integer not null default 0,
  last_error text,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  finished_at timestamptz
);

create unique index if not exists ingest_jobs_kind_key_day
  on ingest_jobs (kind, job_key, run_date);

create index if not exists ingest_jobs_drain
  on ingest_jobs (status, priority, created_at);

create table if not exists weekly_ad_flyer_hashes (
  chain text not null primary key,
  content_hash text not null,
  offer_count integer not null default 0,
  recorded_at timestamptz not null default now()
);
