-- CI / integration / e2e only (not applied on owner db:up).
-- Shopper ranking is TheMealDB-only. Clone internal seed dinners as linked TheMealDB
-- rows so yum4less_test still has rankable meals when live imports are absent.
insert into recipes (
  id,
  title,
  summary,
  cook_time_minutes,
  difficulty,
  tags,
  dietary_tags,
  steps,
  source_name,
  source_recipe_id,
  eligible_for_ranking
)
select
  'themealdb-ci-' || id,
  title,
  summary,
  cook_time_minutes,
  difficulty,
  tags,
  dietary_tags,
  steps,
  'themealdb',
  case id
    when 'sheet-pan-lemon-chicken' then '900001'
    when 'black-bean-tacos' then '900002'
    when 'garlic-butter-pasta' then '900003'
    when 'crispy-tofu-rice-bowls' then '900004'
    when 'weeknight-beef-chili' then '900005'
    when 'italian-sausage-penne' then '900006'
    else null
  end,
  false
from recipes
where source_name = 'yum4less-internal-catalog'
  and id in (
    'sheet-pan-lemon-chicken',
    'black-bean-tacos',
    'garlic-butter-pasta',
    'crispy-tofu-rice-bowls',
    'weeknight-beef-chili',
    'italian-sausage-penne'
  )
on conflict (id) do nothing;

insert into recipe_ingredients (
  recipe_id,
  ingredient_id,
  display_name,
  quantity_note,
  sort_order,
  match_confidence
)
select
  'themealdb-ci-' || recipe_id,
  ingredient_id,
  display_name,
  quantity_note,
  sort_order,
  match_confidence
from recipe_ingredients
where recipe_id in (
  'sheet-pan-lemon-chicken',
  'black-bean-tacos',
  'garlic-butter-pasta',
  'crispy-tofu-rice-bowls',
  'weeknight-beef-chili',
  'italian-sausage-penne'
)
on conflict (recipe_id, ingredient_id) do nothing;
