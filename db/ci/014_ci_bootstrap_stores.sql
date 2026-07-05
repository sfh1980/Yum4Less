-- CI / integration / e2e bootstrap store pins only (not applied on owner db:up).
-- Applied when YUM4LESS_CI_BOOTSTRAP_STORES=1 via scripts/ensure-test-db.mjs.
-- Owner and production catalogs come from ingest (map-catalog, sync:provider-prices, weekly-ad).
insert into stores (
  id,
  name,
  kind,
  city,
  state,
  latitude,
  longitude,
  source_name,
  source_store_id,
  last_verified_at
)
values
  ('kroger-mechanicsville', 'Kroger', 'grocery', 'Mechanicsville', 'VA', 37.615460, -77.329390, 'yum4less-internal-catalog', 'kroger-mechanicsville', now()),
  ('food-lion-mechanicsville', 'Food Lion', 'grocery', 'Mechanicsville', 'VA', 37.610174, -77.341778, 'yum4less-internal-catalog', 'food-lion-mechanicsville', now()),
  ('publix-1626', 'Publix', 'grocery', 'Mechanicsville', 'VA', 37.610899, -77.335779, 'yum4less-internal-catalog', '1626', now()),
  ('aldi-mechanicsville', 'Aldi', 'grocery', 'Mechanicsville', 'VA', 37.636200, -77.360600, 'yum4less-internal-catalog', 'aldi-mechanicsville', now()),
  ('walmart-rocketts', 'Walmart Supercenter', 'big-box', 'Mechanicsville', 'VA', 37.613604, -77.355424, 'yum4less-internal-catalog', 'walmart-bell-creek', now()),
  ('lidl-laburnum', 'Lidl', 'grocery', 'Richmond', 'VA', 37.542600, -77.358800, 'yum4less-internal-catalog', 'lidl-laburnum', now()),
  ('trader-joes-short-pump', 'Trader Joe''s', 'specialty', 'Richmond', 'VA', 37.650600, -77.618000, 'yum4less-internal-catalog', 'trader-joes-short-pump', now()),
  ('dollar-general-market-highland', 'Dollar General Market', 'dollar-market', 'Highland Springs', 'VA', 37.545800, -77.327800, 'yum4less-internal-catalog', 'dollar-general-market-highland', now())
on conflict (id) do update set
  name = excluded.name,
  city = excluded.city,
  state = excluded.state,
  latitude = excluded.latitude,
  longitude = excluded.longitude,
  last_verified_at = excluded.last_verified_at;
