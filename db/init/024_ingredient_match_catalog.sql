-- Weekly-ad catalog expansion: skip list + owner review queue.
-- Canonical foods stay in ingredients; flyer wording is a nickname (ingredient_aliases).

create table if not exists ingredient_match_skips (
  id bigserial primary key,
  normalized_label text not null unique,
  raw_product_name text not null,
  reason text not null,
  created_at timestamptz not null default now()
);

create table if not exists ingredient_match_reviews (
  id bigserial primary key,
  normalized_label text not null unique,
  raw_product_name text not null,
  chain text,
  status text not null check (status in ('pending', 'accepted', 'rejected')),
  resolved_ingredient_id text references ingredients(id) on delete set null,
  seen_at timestamptz not null default now(),
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_ingredient_match_reviews_status
  on ingredient_match_reviews (status, seen_at desc);
