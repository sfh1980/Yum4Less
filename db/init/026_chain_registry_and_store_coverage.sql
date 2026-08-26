-- Chain membership + store coverage view (Phase B2).
-- Does not insert storefronts. Coverage is derived from stores + price_observations.
-- Extra upcoming banners are registry-only (no adapter, not ranked).

create table if not exists chain_registry (
  chain_id text primary key,
  display_name text not null,
  rollout_stage text not null
    check (rollout_stage in (
      'ranked',
      'map_context',
      'ingest_only',
      'blocked',
      'upcoming'
    )),
  shopper_ranked boolean not null default false,
  settings_selectable boolean not null default false,
  weekly_ad_eligible boolean not null default false,
  promotion_blocked boolean not null default false,
  flipp_merchant_name text,
  primary_store_id_prefixes text[] not null default '{}',
  name_match_fragments text[] not null default '{}',
  location_strategy text not null default 'map_catalog_only',
  sale_discovery_strategy text not null default 'none',
  official_pricing_adapter text,
  weekly_ad_adapter text,
  sort_order integer not null default 100,
  notes text
);

insert into chain_registry (
  chain_id, display_name, rollout_stage, shopper_ranked, settings_selectable,
  weekly_ad_eligible, promotion_blocked, flipp_merchant_name,
  primary_store_id_prefixes, name_match_fragments, location_strategy,
  sale_discovery_strategy, official_pricing_adapter, weekly_ad_adapter,
  sort_order, notes
) values
  (
    'kroger', 'Kroger', 'ranked', true, true, true, false, 'Kroger',
    array['kroger-'],
    array['kroger', 'harris teeter', 'ralphs', 'fred meyer', 'king soopers',
      'smith''s', 'smiths', 'fry''s', 'frys', 'qfc', 'mariano', 'pick n save',
      'metro market', 'jay c', 'food 4 less', 'food4less', 'dillons', 'gerbes',
      'baker''s', 'bakers', 'city market', 'pay less'],
    'kroger_api', 'hybrid', 'kroger-official-api', 'kroger-weekly-ad',
    10, 'v1 ranked. Kroger family banners share this row until split.'
  ),
  (
    'aldi', 'Aldi', 'ranked', true, true, true, false, 'ALDI',
    array['aldi-'], array['aldi'],
    'osm_nearest', 'flipp', null, 'aldi-weekly-ad',
    20, 'v1 ranked.'
  ),
  (
    'publix', 'Publix', 'ranked', true, true, true, false, 'Publix',
    array['publix-'], array['publix'],
    'publix_locator', 'hybrid', null, 'publix-weekly-ad',
    30, 'v1 ranked.'
  ),
  (
    'food-lion', 'Food Lion', 'ranked', true, true, true, false, 'Food Lion',
    array['food-lion-'], array['food lion'],
    'map_catalog_only', 'flipp', null, 'food-lion-weekly-ad',
    40, 'v1 ranked.'
  ),
  (
    'lidl', 'Lidl', 'ingest_only', false, false, true, false, 'Lidl',
    array['lidl-'], array['lidl'],
    'map_catalog_only', 'flipp', null, 'lidl-weekly-ad',
    50, 'Ingest rehearsal. Shopper coming soon — not recipe-ready.'
  ),
  (
    'walmart', 'Walmart', 'map_context', false, false, true, true, 'Walmart',
    array['walmart-'], array['walmart'],
    'map_catalog_only', 'hybrid', null, 'walmart-weekly-ad',
    60, 'Ads may persist. Ranked dinners hard-blocked until coverage review.'
  ),
  (
    'bjs', 'BJ''s', 'map_context', false, false, false, false, null,
    array['bjs-'], array['bj''s', 'bjs', 'bj wholesale'],
    'map_catalog_only', 'none', null, null,
    70, 'Map context. No weekly-ad adapter yet.'
  ),
  (
    'trader-joes', 'Trader Joe''s', 'upcoming', false, false, false, false, null,
    array['trader-joes-'], array['trader joe'],
    'map_catalog_only', 'none', null, null,
    80, 'StoreChain exists. No sale adapter yet.'
  ),
  (
    'dollar-general', 'Dollar General', 'ingest_only', false, false, true, false, null,
    array['dollar-general-'], array['dollar general'],
    'map_catalog_only', 'research_stub', null, 'dollar-general-weekly-ad',
    90, 'Research stub in weekly-ad chain list. Not shopper-ranked.'
  ),
  (
    'costco', 'Costco', 'map_context', false, false, false, false, null,
    array['costco-'], array['costco'],
    'map_catalog_only', 'none', null, null,
    100, 'OSM/SNAP name-fragment map context. Not a StoreChain yet.'
  ),
  (
    'sams-club', 'Sam''s Club', 'map_context', false, false, false, false, null,
    array['sams-club-'], array['sam''s club', 'sams club'],
    'map_catalog_only', 'none', null, null,
    110, 'OSM/SNAP name-fragment map context. Not a StoreChain yet.'
  ),
  (
    'whole-foods', 'Whole Foods', 'upcoming', false, false, false, false, null,
    array['whole-foods-'], array['whole foods'],
    'map_catalog_only', 'none', null, null,
    120, 'Seen on OSM in local catalog. No adapter.'
  ),
  (
    'target', 'Target', 'upcoming', false, false, false, false, null,
    array['target-'], array['target'],
    'map_catalog_only', 'none', null, null,
    130, 'Nationwide major. Needs a new adapter before sales/ranked.'
  ),
  (
    'safeway', 'Safeway', 'upcoming', false, false, false, false, null,
    array['safeway-'], array['safeway'],
    'map_catalog_only', 'none', null, null,
    140, 'Nationwide major (Albertsons family later). Needs adapter.'
  ),
  (
    'heb', 'H-E-B', 'upcoming', false, false, false, false, null,
    array['heb-'], array['h-e-b'],
    'map_catalog_only', 'none', null, null,
    150, 'Texas major. Needs adapter.'
  ),
  (
    'hannaford', 'Hannaford', 'upcoming', false, false, false, false, null,
    array['hannaford-'], array['hannaford'],
    'map_catalog_only', 'none', null, null,
    160, 'Northeast major. Not Food Lion. Needs adapter.'
  ),
  (
    'wegmans', 'Wegmans', 'upcoming', false, false, false, false, null,
    array['wegmans-'], array['wegmans'],
    'map_catalog_only', 'none', null, null,
    170, 'Regional major. Needs adapter.'
  ),
  (
    'sprouts', 'Sprouts', 'upcoming', false, false, false, false, null,
    array['sprouts-'], array['sprouts'],
    'map_catalog_only', 'none', null, null,
    180, 'Regional major. Needs adapter.'
  )
on conflict (chain_id) do nothing;

create or replace view store_coverage as
select
  s.id as store_id,
  s.name,
  s.kind,
  s.city,
  s.state,
  s.latitude,
  s.longitude,
  s.source_name,
  s.source_store_id,
  true as seen,
  (s.latitude is not null and s.longitude is not null) as mapped,
  coalesce(sales.fresh_sale_count, 0) as fresh_sale_count,
  sales.last_sale_at
from stores s
left join lateral (
  select
    count(*)::int as fresh_sale_count,
    max(coalesce(po.last_verified_at, po.observed_at)) as last_sale_at
  from price_observations po
  where po.store_id = s.id
    and po.in_stock
    and coalesce(po.last_verified_at, po.observed_at)
      >= now() - interval '24 hours'
) sales on true;
