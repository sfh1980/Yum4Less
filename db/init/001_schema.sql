create table if not exists stores (
  id text primary key,
  name text not null,
  kind text not null check (kind in ('grocery', 'big-box', 'specialty', 'dollar-market')),
  city text not null,
  state text not null,
  latitude numeric(9, 6) not null,
  longitude numeric(9, 6) not null,
  source_name text,
  source_store_id text,
  last_verified_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists ingredients (
  id text primary key,
  name text not null,
  category text not null check (
    category in ('protein', 'produce', 'pantry', 'dairy', 'seasoning', 'baking', 'frozen')
  ),
  source_name text,
  source_record_id text,
  created_at timestamptz not null default now()
);

create table if not exists recipes (
  id text primary key,
  title text not null,
  summary text not null,
  cook_time_minutes integer not null check (cook_time_minutes > 0),
  difficulty text not null check (difficulty in ('easy', 'medium')),
  tags text[] not null default '{}',
  dietary_tags text[] not null default '{}',
  steps text[] not null default '{}',
  source_name text,
  source_recipe_id text,
  created_at timestamptz not null default now()
);

create table if not exists recipe_ingredients (
  recipe_id text not null references recipes(id) on delete cascade,
  ingredient_id text not null references ingredients(id) on delete restrict,
  display_name text not null,
  quantity_note text not null,
  sort_order integer not null check (sort_order >= 0),
  match_confidence numeric(5, 4),
  created_at timestamptz not null default now(),
  primary key (recipe_id, ingredient_id)
);

create table if not exists price_observations (
  id bigserial primary key,
  store_id text not null references stores(id) on delete cascade,
  ingredient_id text not null references ingredients(id) on delete restrict,
  price numeric(10, 2) not null check (price >= 0),
  currency_code text not null default 'USD',
  sale_label text,
  in_stock boolean not null,
  observed_at timestamptz not null,
  captured_at timestamptz not null default now(),
  source_name text,
  source_record_id text,
  confidence_score numeric(5, 4),
  notes text
);

create index if not exists idx_stores_city_state on stores (state, city);
create index if not exists idx_recipe_ingredients_recipe_sort
  on recipe_ingredients (recipe_id, sort_order);
create index if not exists idx_price_observations_latest
  on price_observations (store_id, ingredient_id, observed_at desc);
