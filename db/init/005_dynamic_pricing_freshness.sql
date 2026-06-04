alter table price_observations
  add column if not exists last_verified_at timestamptz,
  add column if not exists source_kind text,
  add column if not exists valid_through timestamptz;

update price_observations
set
  last_verified_at = coalesce(last_verified_at, observed_at),
  source_kind = coalesce(
    source_kind,
    case
      when source_name in ('kroger-official-api', 'walmart-online-api', 'publix-online-api') then 'official-online'
      when source_name like '%-weekly-ad-scrape' then 'weekly-ad'
      when source_name = 'mock-market-data' then 'sample'
      else 'unknown'
    end
  )
where last_verified_at is null
  or source_kind is null;

create index if not exists idx_price_observations_current_ranked
  on price_observations (
    store_id,
    ingredient_id,
    source_kind,
    (coalesce(last_verified_at, observed_at)) desc,
    observed_at desc
  )
  where source_kind in ('official-online', 'weekly-ad');

create index if not exists idx_price_observations_source_name
  on price_observations (source_name);
