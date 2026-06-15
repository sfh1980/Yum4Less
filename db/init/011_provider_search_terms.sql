-- Provider-tuned product search terms for ingest/sync scripts (not public API reads).

create table if not exists provider_search_terms (
  id bigserial primary key,
  ingredient_id text not null references ingredients(id) on delete restrict,
  provider text not null,
  search_term text not null,
  priority integer not null default 1,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider, ingredient_id, search_term)
);

create index if not exists idx_provider_search_terms_provider_priority
  on provider_search_terms (provider, priority, ingredient_id);

insert into provider_search_terms (ingredient_id, provider, search_term, priority, notes)
values
  ('chicken-thighs', 'kroger', 'chicken thigh', 1, null),
  (
    'baby-potatoes',
    'kroger',
    'baby gold potatoes',
    1,
    'Primary: most specific Kroger SKU label. Avoid "baby potato" (baby food) and "mini potatoes" (tater tots / pet food).'
  ),
  (
    'baby-potatoes',
    'kroger',
    'petite potatoes',
    2,
    'Priority-2 fallback when priority-1 returns no product match at or above 0.45 confidence.'
  ),
  ('broccoli', 'kroger', 'broccoli', 1, null),
  ('lemon', 'kroger', 'lemon', 1, null),
  ('olive-oil', 'kroger', 'olive oil', 1, null)
on conflict (provider, ingredient_id, search_term) do nothing;
