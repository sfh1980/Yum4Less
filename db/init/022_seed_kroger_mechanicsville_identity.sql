-- Option A Slice 3: seed Mechanicsville Kroger slug ↔ API twin as one identity.
-- Manual/seeded confirm (not live auto-confirm). Q3: official API id is canonical.
--
-- Does NOT insert stores rows — only links when both members already exist
-- (ingest / CI bootstrap). Avoids changing Settings collocated collapse with
-- the identity expand flag still OFF.
-- Idempotent: safe to re-apply.

insert into store_identities (
  id,
  canonical_store_id,
  display_name,
  kind,
  city,
  state,
  latitude,
  longitude,
  display_source_name,
  last_resolved_at
)
select
  'kroger-02900529',
  'kroger-02900529',
  coalesce(api.name, 'Kroger Marketplace - Kroger Marketplace'),
  'grocery',
  coalesce(api.city, 'Mechanicsville'),
  coalesce(api.state, 'VA'),
  api.latitude,
  api.longitude,
  coalesce(api.source_name, 'kroger-official-api'),
  now()
from stores api
inner join stores slug on slug.id = 'kroger-mechanicsville'
where api.id = 'kroger-02900529'
  and not exists (
    select 1 from store_identities where id = 'kroger-02900529'
  );

insert into store_identity_aliases (
  identity_id,
  source_system,
  external_id,
  store_id,
  member_role,
  link_status,
  match_method,
  match_confidence,
  notes
)
select
  'kroger-02900529',
  'kroger-official-api',
  '02900529',
  'kroger-02900529',
  'canonical',
  'confirmed',
  'seeded',
  0.8500,
  'Option A Slice 3 seeded link; scorer no-pointer perfect twin lands on confirmThreshold by design'
where exists (select 1 from store_identities where id = 'kroger-02900529')
  and not exists (
    select 1
    from store_identity_aliases
    where source_system = 'kroger-official-api'
      and external_id = '02900529'
  );

insert into store_identity_aliases (
  identity_id,
  source_system,
  external_id,
  store_id,
  member_role,
  link_status,
  match_method,
  match_confidence,
  notes
)
select
  'kroger-02900529',
  'kroger-weekly-ad-scrape',
  'kroger-mechanicsville',
  'kroger-mechanicsville',
  'alias',
  'confirmed',
  'seeded',
  0.8500,
  'Option A Slice 3 seeded link; alias for Settings/localStorage round-trip'
where exists (select 1 from store_identities where id = 'kroger-02900529')
  and not exists (
    select 1
    from store_identity_aliases
    where source_system = 'kroger-weekly-ad-scrape'
      and external_id = 'kroger-mechanicsville'
  );
