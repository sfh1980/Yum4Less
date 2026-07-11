-- Option A Slice 3: seed Mechanicsville Kroger slug↔ API twin as one identity.
-- Manual/seeded confirm (not live auto-confirm). Q3: official API id is canonical.
--
-- Ensures both member store rows exist (ON CONFLICT DO NOTHING) so the link can
-- apply on CI/fresh volumes; does not overwrite ingest-updated coords/names.
-- Idempotent: safe to re-apply.

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
  (
    'kroger-02900529',
    'Kroger Marketplace - Kroger Marketplace',
    'grocery',
    'Mechanicsville',
    'VA',
    37.615460,
    -77.329390,
    'kroger-official-api',
    '02900529',
    now()
  ),
  (
    'kroger-mechanicsville',
    'Kroger',
    'grocery',
    'Mechanicsville',
    'VA',
    37.6154615,
    -77.329390,
    'kroger-weekly-ad-scrape',
    'kroger-mechanicsville',
    now()
  )
on conflict (id) do nothing;

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
  'Kroger Marketplace - Kroger Marketplace',
  'grocery',
  'Mechanicsville',
  'VA',
  37.615460,
  -77.329390,
  'kroger-official-api',
  now()
where exists (select 1 from stores where id = 'kroger-02900529')
  and exists (select 1 from stores where id = 'kroger-mechanicsville')
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
