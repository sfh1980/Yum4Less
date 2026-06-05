-- Slice 10: TheMealDB ingredient aliases and recipe ranking eligibility.

create table if not exists ingredient_aliases (
  id bigserial primary key,
  ingredient_id text not null references ingredients(id) on delete cascade,
  source_name text not null,
  external_label text not null,
  match_confidence numeric(5, 4),
  created_at timestamptz not null default now(),
  unique (source_name, external_label)
);

create index if not exists idx_ingredient_aliases_ingredient
  on ingredient_aliases (ingredient_id);

create index if not exists idx_ingredient_aliases_source_label
  on ingredient_aliases (source_name, external_label);

alter table recipes
  add column if not exists eligible_for_ranking boolean not null default true;

-- Internal curated recipes remain eligible; future TheMealDB rows import with false.
update recipes
set eligible_for_ranking = true
where source_name is null
   or source_name = 'yum4less-internal-catalog';

-- Common TheMealDB filter/lookup strings → internal catalog slugs.
insert into ingredient_aliases (ingredient_id, source_name, external_label, match_confidence)
values
  ('chicken-thighs', 'themealdb', 'chicken', 0.85),
  ('chicken-breast', 'themealdb', 'chicken breast', 0.95),
  ('ground-beef', 'themealdb', 'minced beef', 0.90),
  ('ground-beef', 'themealdb', 'beef', 0.80),
  ('garlic', 'themealdb', 'garlic', 1.00),
  ('yellow-onion', 'themealdb', 'onion', 0.90),
  ('yellow-onion', 'themealdb', 'onions', 0.90),
  ('tomato-paste', 'themealdb', 'tomato puree', 0.85),
  ('canned-tomatoes', 'themealdb', 'tomatoes', 0.85),
  ('canned-tomatoes', 'themealdb', 'chopped tomatoes', 0.90),
  ('spaghetti', 'themealdb', 'spaghetti', 1.00),
  ('penne-pasta', 'themealdb', 'penne', 0.95),
  ('penne-pasta', 'themealdb', 'pasta', 0.75),
  ('jasmine-rice', 'themealdb', 'rice', 0.80),
  ('white-rice', 'themealdb', 'long grain rice', 0.90),
  ('eggs', 'themealdb', 'egg', 0.95),
  ('eggs', 'themealdb', 'eggs', 1.00),
  ('butter', 'themealdb', 'butter', 1.00),
  ('olive-oil', 'themealdb', 'olive oil', 1.00),
  ('parmesan', 'themealdb', 'parmesan', 0.95),
  ('parmesan', 'themealdb', 'parmesan cheese', 0.95),
  ('mozzarella', 'themealdb', 'mozzarella', 0.95),
  ('cheddar-cheese', 'themealdb', 'cheddar', 0.95),
  ('black-beans', 'themealdb', 'black beans', 1.00),
  ('pinto-beans', 'themealdb', 'kidney beans', 0.70),
  ('chickpeas', 'themealdb', 'chickpeas', 1.00),
  ('broccoli', 'themealdb', 'broccoli', 1.00),
  ('spinach', 'themealdb', 'spinach', 1.00),
  ('carrots', 'themealdb', 'carrots', 0.95),
  ('carrots', 'themealdb', 'carrot', 0.95),
  ('mushrooms', 'themealdb', 'mushrooms', 0.95),
  ('bell-peppers', 'themealdb', 'red pepper', 0.85),
  ('bell-peppers', 'themealdb', 'green pepper', 0.85),
  ('lemon', 'themealdb', 'lemon', 1.00),
  ('lime', 'themealdb', 'lime', 1.00),
  ('soy-sauce', 'themealdb', 'soy sauce', 1.00),
  ('salmon-fillet', 'themealdb', 'salmon', 0.95),
  ('shrimp', 'themealdb', 'prawns', 0.90),
  ('shrimp', 'themealdb', 'shrimp', 1.00),
  ('bacon', 'themealdb', 'bacon', 1.00),
  ('italian-sausage', 'themealdb', 'sausage', 0.80),
  ('russet-potatoes', 'themealdb', 'potatoes', 0.90),
  ('baby-potatoes', 'themealdb', 'new potatoes', 0.85),
  ('cumin', 'themealdb', 'cumin', 1.00),
  ('paprika', 'themealdb', 'paprika', 1.00),
  ('salt', 'themealdb', 'salt', 1.00),
  ('black-pepper', 'themealdb', 'pepper', 0.75),
  ('flour-tortillas', 'themealdb', 'tortillas', 0.85),
  ('corn-tortillas', 'themealdb', 'corn tortillas', 1.00),
  ('avocado', 'themealdb', 'avocado', 1.00),
  ('cilantro', 'themealdb', 'coriander', 0.90),
  ('cilantro', 'themealdb', 'cilantro', 1.00),
  ('cream-cheese', 'themealdb', 'cream cheese', 1.00),
  ('heavy-cream', 'themealdb', 'double cream', 0.85),
  ('heavy-cream', 'themealdb', 'heavy cream', 1.00),
  ('all-purpose-flour', 'themealdb', 'flour', 0.85),
  ('honey', 'themealdb', 'honey', 1.00),
  ('dijon-mustard', 'themealdb', 'mustard', 0.80),
  ('vegetable-oil', 'themealdb', 'vegetable oil', 1.00),
  ('chicken-broth', 'themealdb', 'chicken stock', 0.90),
  ('chicken-broth', 'themealdb', 'stock', 0.65)
on conflict (source_name, external_label) do nothing;
