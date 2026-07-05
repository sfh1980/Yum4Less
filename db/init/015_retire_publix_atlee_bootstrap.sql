-- Retire legacy publix-atlee bootstrap pin (no Publix storefront at Atlee Rd).
-- Canonical Mechanicsville CI / demo anchor: Publix store #1626 Brandy Creek Commons
-- (6603 Mechanicsville Tpke — coords from Publix store locator, 2026-07-05).

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
values (
  'publix-1626',
  'Publix',
  'grocery',
  'Mechanicsville',
  'VA',
  37.610899,
  -77.335779,
  'yum4less-internal-catalog',
  '1626',
  now()
)
on conflict (id) do update set
  name = excluded.name,
  city = excluded.city,
  state = excluded.state,
  latitude = excluded.latitude,
  longitude = excluded.longitude,
  source_store_id = excluded.source_store_id,
  last_verified_at = excluded.last_verified_at;

delete from price_observations target
using price_observations source
where source.store_id = 'publix-atlee'
  and target.store_id = 'publix-1626'
  and target.ingredient_id = source.ingredient_id;

update price_observations
set store_id = 'publix-1626'
where store_id = 'publix-atlee';

delete from stores
where id = 'publix-atlee';
