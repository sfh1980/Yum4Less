-- Option A Slice 1: alias-graph store identity infrastructure.
-- Logical storefront (store_identities) + retained source attachments
-- (store_identity_aliases). Merge does not delete losing store rows.
--
-- v1 invariant: store_identities.id = canonical_store_id (public id).
-- Display cache columns are nullable until Slice 3+ resolution fills them.
-- Slice 1 does not backfill rows; unlinked stores use read-time virtual singletons.

create table if not exists store_identities (
  id text primary key,
  canonical_store_id text not null unique references stores (id) on delete restrict,
  display_name text,
  kind text check (
    kind is null
    or kind in ('grocery', 'big-box', 'specialty', 'dollar-market')
  ),
  city text,
  state text,
  latitude numeric(9, 6),
  longitude numeric(9, 6),
  display_source_name text,
  last_resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint store_identities_id_matches_canonical check (id = canonical_store_id)
);

create table if not exists store_identity_aliases (
  id bigserial primary key,
  identity_id text not null references store_identities (id) on delete cascade,
  source_system text not null,
  external_id text not null,
  store_id text references stores (id) on delete cascade,
  snap_retailer_id text references snap_retailer_locations (id) on delete cascade,
  member_role text not null check (member_role in ('canonical', 'alias')),
  link_status text not null check (
    link_status in ('confirmed', 'provisional', 'rejected')
  ),
  match_method text,
  match_confidence numeric(5, 4),
  linked_at timestamptz not null default now(),
  notes text,
  constraint store_identity_aliases_source_external_uid unique (source_system, external_id)
);

-- One catalog row belongs to at most one identity.
create unique index if not exists store_identity_aliases_store_id_uidx
  on store_identity_aliases (store_id)
  where store_id is not null;

-- One SNAP directory row belongs to at most one identity.
create unique index if not exists store_identity_aliases_snap_retailer_id_uidx
  on store_identity_aliases (snap_retailer_id)
  where snap_retailer_id is not null;

-- Exactly one canonical alias row per identity.
create unique index if not exists store_identity_aliases_one_canonical_uidx
  on store_identity_aliases (identity_id)
  where member_role = 'canonical';

create index if not exists store_identity_aliases_identity_id_idx
  on store_identity_aliases (identity_id);
