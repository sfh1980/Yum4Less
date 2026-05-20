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
  ('food-lion-mechanicsville', 'Food Lion', 'grocery', 'Mechanicsville', 'VA', 37.615300, -77.349100, 'mock-market-data', 'food-lion-mechanicsville', now()),
  ('aldi-mechanicsville', 'Aldi', 'grocery', 'Mechanicsville', 'VA', 37.636200, -77.360600, 'mock-market-data', 'aldi-mechanicsville', now()),
  ('walmart-rocketts', 'Walmart Supercenter', 'big-box', 'Richmond', 'VA', 37.527500, -77.352300, 'mock-market-data', 'walmart-rocketts', now()),
  ('lidl-laburnum', 'Lidl', 'grocery', 'Richmond', 'VA', 37.542600, -77.358800, 'mock-market-data', 'lidl-laburnum', now()),
  ('trader-joes-short-pump', 'Trader Joe''s', 'specialty', 'Richmond', 'VA', 37.650600, -77.618000, 'mock-market-data', 'trader-joes-short-pump', now()),
  ('dollar-general-market-highland', 'Dollar General Market', 'dollar-market', 'Highland Springs', 'VA', 37.545800, -77.327800, 'mock-market-data', 'dollar-general-market-highland', now())
on conflict (id) do nothing;

insert into ingredients (
  id,
  name,
  category,
  source_name,
  source_record_id
)
values
  ('chicken-thighs', 'Chicken thighs', 'protein', 'mock-market-data', 'chicken-thighs'),
  ('baby-potatoes', 'Baby potatoes', 'produce', 'mock-market-data', 'baby-potatoes'),
  ('broccoli', 'Broccoli', 'produce', 'mock-market-data', 'broccoli'),
  ('lemon', 'Lemon', 'produce', 'mock-market-data', 'lemon'),
  ('olive-oil', 'Olive oil', 'pantry', 'mock-market-data', 'olive-oil'),
  ('black-beans', 'Black beans', 'pantry', 'mock-market-data', 'black-beans'),
  ('corn-tortillas', 'Corn tortillas', 'pantry', 'mock-market-data', 'corn-tortillas'),
  ('cabbage', 'Green cabbage', 'produce', 'mock-market-data', 'cabbage'),
  ('lime', 'Lime', 'produce', 'mock-market-data', 'lime'),
  ('spaghetti', 'Spaghetti', 'pantry', 'mock-market-data', 'spaghetti'),
  ('spinach', 'Spinach', 'produce', 'mock-market-data', 'spinach'),
  ('parmesan', 'Parmesan', 'dairy', 'mock-market-data', 'parmesan'),
  ('butter', 'Butter', 'dairy', 'mock-market-data', 'butter'),
  ('tofu', 'Extra-firm tofu', 'protein', 'mock-market-data', 'tofu'),
  ('jasmine-rice', 'Jasmine rice', 'pantry', 'mock-market-data', 'jasmine-rice'),
  ('bell-peppers', 'Bell peppers', 'produce', 'mock-market-data', 'bell-peppers'),
  ('soy-sauce', 'Soy sauce', 'pantry', 'mock-market-data', 'soy-sauce'),
  ('green-onion', 'Green onion', 'produce', 'mock-market-data', 'green-onion')
on conflict (id) do nothing;

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
  source_recipe_id
)
values
  (
    'sheet-pan-lemon-chicken',
    'Sheet Pan Lemon Chicken and Vegetables',
    'A low-mess sheet pan dinner that keeps prep simple while still feeling like a full weeknight meal.',
    35,
    'easy',
    array['quick', 'family', 'single-store friendly'],
    array[]::text[],
    array[
      'Roast the potatoes first so they get a head start before the chicken goes in.',
      'Toss chicken and broccoli with lemon and oil, then finish everything on one pan.',
      'Serve straight from the pan for an easy cleanup night.'
    ],
    'mock-market-data',
    'sheet-pan-lemon-chicken'
  ),
  (
    'black-bean-tacos',
    'Black Bean Tacos with Lime Slaw',
    'A flexible taco night option with pantry-friendly beans and a fresh slaw that still stays budget aware.',
    25,
    'easy',
    array['vegetarian', 'budget', 'multi-store savings'],
    array['vegetarian', 'quick'],
    array[
      'Warm the beans with pantry seasoning while the tortillas heat in a dry skillet.',
      'Toss shredded cabbage with lime and oil for a quick slaw.',
      'Layer beans and slaw into tortillas and serve immediately.'
    ],
    'mock-market-data',
    'black-bean-tacos'
  ),
  (
    'garlic-butter-pasta',
    'Garlic Butter Pasta with Spinach',
    'A pantry-heavy pasta dinner that works well when the user needs something fast, low-cost, and familiar.',
    20,
    'easy',
    array['quick', 'vegetarian', 'pantry-heavy'],
    array['vegetarian', 'quick'],
    array[
      'Cook the pasta and reserve a little pasta water before draining.',
      'Melt butter with oil, wilt the spinach, and toss with hot pasta.',
      'Finish with parmesan and enough pasta water to make the sauce glossy.'
    ],
    'mock-market-data',
    'garlic-butter-pasta'
  ),
  (
    'crispy-tofu-rice-bowls',
    'Crispy Tofu Rice Bowls',
    'A produce-forward bowl with tofu, rice, and vegetables that offers a stronger vegan option with a little more shopping complexity.',
    30,
    'medium',
    array['vegan', 'meal-prep', 'produce-heavy'],
    array['vegan', 'quick'],
    array[
      'Cook the rice first so the tofu and vegetables can finish while it rests.',
      'Pan-crisp tofu, then stir-fry peppers and green onion with a soy-based sauce.',
      'Build bowls with rice, vegetables, and tofu for a meal-prep friendly dinner.'
    ],
    'mock-market-data',
    'crispy-tofu-rice-bowls'
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
values
  ('sheet-pan-lemon-chicken', 'chicken-thighs', 'Chicken thighs', '1.5 lb', 1, 1.0000),
  ('sheet-pan-lemon-chicken', 'baby-potatoes', 'Baby potatoes', '1 bag', 2, 1.0000),
  ('sheet-pan-lemon-chicken', 'broccoli', 'Broccoli florets', '2 heads', 3, 1.0000),
  ('sheet-pan-lemon-chicken', 'lemon', 'Lemon', '1', 4, 1.0000),
  ('sheet-pan-lemon-chicken', 'olive-oil', 'Olive oil', '1 bottle', 5, 1.0000),
  ('black-bean-tacos', 'black-beans', 'Black beans', '2 cans', 1, 1.0000),
  ('black-bean-tacos', 'corn-tortillas', 'Corn tortillas', '1 pack', 2, 1.0000),
  ('black-bean-tacos', 'cabbage', 'Cabbage', '1/2 head', 3, 1.0000),
  ('black-bean-tacos', 'lime', 'Lime', '2', 4, 1.0000),
  ('black-bean-tacos', 'olive-oil', 'Olive oil', '1 bottle', 5, 1.0000),
  ('garlic-butter-pasta', 'spaghetti', 'Spaghetti', '1 box', 1, 1.0000),
  ('garlic-butter-pasta', 'spinach', 'Spinach', '1 bag', 2, 1.0000),
  ('garlic-butter-pasta', 'parmesan', 'Parmesan', '1 wedge', 3, 1.0000),
  ('garlic-butter-pasta', 'butter', 'Butter', '1 stick', 4, 1.0000),
  ('garlic-butter-pasta', 'olive-oil', 'Olive oil', '1 bottle', 5, 1.0000),
  ('crispy-tofu-rice-bowls', 'tofu', 'Extra-firm tofu', '2 blocks', 1, 1.0000),
  ('crispy-tofu-rice-bowls', 'jasmine-rice', 'Jasmine rice', '1 bag', 2, 1.0000),
  ('crispy-tofu-rice-bowls', 'bell-peppers', 'Bell peppers', '3', 3, 1.0000),
  ('crispy-tofu-rice-bowls', 'soy-sauce', 'Soy sauce', '1 bottle', 4, 1.0000),
  ('crispy-tofu-rice-bowls', 'green-onion', 'Green onion', '1 bunch', 5, 1.0000),
  ('crispy-tofu-rice-bowls', 'olive-oil', 'Olive oil', '1 bottle', 6, 1.0000)
on conflict (recipe_id, ingredient_id) do nothing;

insert into price_observations (
  store_id,
  ingredient_id,
  price,
  currency_code,
  sale_label,
  in_stock,
  observed_at,
  source_name,
  source_record_id,
  confidence_score
)
values
  ('food-lion-mechanicsville', 'chicken-thighs', 6.49, 'USD', null, true, now() - interval '1 day', 'mock-market-data', 'food-lion-mechanicsville:chicken-thighs', 1.0000),
  ('food-lion-mechanicsville', 'baby-potatoes', 2.79, 'USD', null, true, now() - interval '1 day', 'mock-market-data', 'food-lion-mechanicsville:baby-potatoes', 1.0000),
  ('food-lion-mechanicsville', 'broccoli', 2.39, 'USD', null, true, now() - interval '2 days', 'mock-market-data', 'food-lion-mechanicsville:broccoli', 1.0000),
  ('food-lion-mechanicsville', 'lemon', 0.89, 'USD', null, true, now() - interval '2 days', 'mock-market-data', 'food-lion-mechanicsville:lemon', 1.0000),
  ('food-lion-mechanicsville', 'olive-oil', 2.84, 'USD', null, true, now() - interval '3 days', 'mock-market-data', 'food-lion-mechanicsville:olive-oil', 1.0000),
  ('food-lion-mechanicsville', 'black-beans', 1.09, 'USD', null, true, now() - interval '3 days', 'mock-market-data', 'food-lion-mechanicsville:black-beans', 1.0000),
  ('food-lion-mechanicsville', 'corn-tortillas', 2.29, 'USD', null, true, now() - interval '4 days', 'mock-market-data', 'food-lion-mechanicsville:corn-tortillas', 1.0000),
  ('food-lion-mechanicsville', 'cabbage', 2.19, 'USD', null, true, now() - interval '2 days', 'mock-market-data', 'food-lion-mechanicsville:cabbage', 1.0000),
  ('food-lion-mechanicsville', 'lime', 0.59, 'USD', null, true, now() - interval '2 days', 'mock-market-data', 'food-lion-mechanicsville:lime', 1.0000),
  ('food-lion-mechanicsville', 'spaghetti', 1.59, 'USD', null, true, now() - interval '2 days', 'mock-market-data', 'food-lion-mechanicsville:spaghetti', 1.0000),
  ('food-lion-mechanicsville', 'spinach', 2.49, 'USD', null, true, now() - interval '1 day', 'mock-market-data', 'food-lion-mechanicsville:spinach', 1.0000),
  ('food-lion-mechanicsville', 'parmesan', 3.59, 'USD', null, true, now() - interval '3 days', 'mock-market-data', 'food-lion-mechanicsville:parmesan', 1.0000),
  ('food-lion-mechanicsville', 'butter', 2.79, 'USD', null, true, now() - interval '2 days', 'mock-market-data', 'food-lion-mechanicsville:butter', 1.0000),

  ('aldi-mechanicsville', 'black-beans', 0.89, 'USD', 'Pantry value', true, now() - interval '2 days', 'mock-market-data', 'aldi-mechanicsville:black-beans', 1.0000),
  ('aldi-mechanicsville', 'corn-tortillas', 1.79, 'USD', null, true, now() - interval '3 days', 'mock-market-data', 'aldi-mechanicsville:corn-tortillas', 1.0000),
  ('aldi-mechanicsville', 'cabbage', 1.69, 'USD', null, true, now() - interval '2 days', 'mock-market-data', 'aldi-mechanicsville:cabbage', 1.0000),
  ('aldi-mechanicsville', 'lime', 0.45, 'USD', null, true, now() - interval '2 days', 'mock-market-data', 'aldi-mechanicsville:lime', 1.0000),
  ('aldi-mechanicsville', 'olive-oil', 2.49, 'USD', null, true, now() - interval '4 days', 'mock-market-data', 'aldi-mechanicsville:olive-oil', 1.0000),
  ('aldi-mechanicsville', 'baby-potatoes', 2.39, 'USD', null, true, now() - interval '3 days', 'mock-market-data', 'aldi-mechanicsville:baby-potatoes', 1.0000),

  ('walmart-rocketts', 'black-beans', 0.98, 'USD', null, true, now() - interval '4 days', 'mock-market-data', 'walmart-rocketts:black-beans', 1.0000),
  ('walmart-rocketts', 'corn-tortillas', 1.98, 'USD', null, true, now() - interval '4 days', 'mock-market-data', 'walmart-rocketts:corn-tortillas', 1.0000),
  ('walmart-rocketts', 'cabbage', 1.88, 'USD', null, true, now() - interval '3 days', 'mock-market-data', 'walmart-rocketts:cabbage', 1.0000),
  ('walmart-rocketts', 'lime', 0.50, 'USD', null, true, now() - interval '3 days', 'mock-market-data', 'walmart-rocketts:lime', 1.0000),
  ('walmart-rocketts', 'olive-oil', 2.68, 'USD', null, true, now() - interval '4 days', 'mock-market-data', 'walmart-rocketts:olive-oil', 1.0000),
  ('walmart-rocketts', 'tofu', 2.38, 'USD', null, true, now() - interval '3 days', 'mock-market-data', 'walmart-rocketts:tofu', 1.0000),
  ('walmart-rocketts', 'jasmine-rice', 2.72, 'USD', null, true, now() - interval '4 days', 'mock-market-data', 'walmart-rocketts:jasmine-rice', 1.0000),
  ('walmart-rocketts', 'bell-peppers', 2.88, 'USD', null, true, now() - interval '2 days', 'mock-market-data', 'walmart-rocketts:bell-peppers', 1.0000),
  ('walmart-rocketts', 'soy-sauce', 2.18, 'USD', null, true, now() - interval '5 days', 'mock-market-data', 'walmart-rocketts:soy-sauce', 1.0000),
  ('walmart-rocketts', 'green-onion', 0.98, 'USD', null, true, now() - interval '2 days', 'mock-market-data', 'walmart-rocketts:green-onion', 1.0000),

  ('lidl-laburnum', 'spaghetti', 1.09, 'USD', null, true, now() - interval '2 days', 'mock-market-data', 'lidl-laburnum:spaghetti', 1.0000),
  ('lidl-laburnum', 'spinach', 1.89, 'USD', null, true, now() - interval '1 day', 'mock-market-data', 'lidl-laburnum:spinach', 1.0000),
  ('lidl-laburnum', 'parmesan', 3.09, 'USD', null, true, now() - interval '3 days', 'mock-market-data', 'lidl-laburnum:parmesan', 1.0000),
  ('lidl-laburnum', 'butter', 2.39, 'USD', null, true, now() - interval '2 days', 'mock-market-data', 'lidl-laburnum:butter', 1.0000),
  ('lidl-laburnum', 'olive-oil', 2.35, 'USD', null, true, now() - interval '4 days', 'mock-market-data', 'lidl-laburnum:olive-oil', 1.0000),
  ('lidl-laburnum', 'baby-potatoes', 2.29, 'USD', null, true, now() - interval '3 days', 'mock-market-data', 'lidl-laburnum:baby-potatoes', 1.0000),

  ('trader-joes-short-pump', 'tofu', 1.99, 'USD', 'Store favorite', true, now() - interval '1 day', 'mock-market-data', 'trader-joes-short-pump:tofu', 1.0000),
  ('trader-joes-short-pump', 'jasmine-rice', 2.29, 'USD', null, true, now() - interval '2 days', 'mock-market-data', 'trader-joes-short-pump:jasmine-rice', 1.0000),
  ('trader-joes-short-pump', 'bell-peppers', 2.49, 'USD', null, true, now() - interval '1 day', 'mock-market-data', 'trader-joes-short-pump:bell-peppers', 1.0000),
  ('trader-joes-short-pump', 'soy-sauce', 1.99, 'USD', null, true, now() - interval '3 days', 'mock-market-data', 'trader-joes-short-pump:soy-sauce', 1.0000),
  ('trader-joes-short-pump', 'green-onion', 0.89, 'USD', null, true, now() - interval '1 day', 'mock-market-data', 'trader-joes-short-pump:green-onion', 1.0000),
  ('trader-joes-short-pump', 'olive-oil', 2.99, 'USD', null, true, now() - interval '3 days', 'mock-market-data', 'trader-joes-short-pump:olive-oil', 1.0000),

  ('dollar-general-market-highland', 'spaghetti', 1.25, 'USD', null, true, now() - interval '5 days', 'mock-market-data', 'dollar-general-market-highland:spaghetti', 1.0000),
  ('dollar-general-market-highland', 'black-beans', 1.15, 'USD', null, true, now() - interval '5 days', 'mock-market-data', 'dollar-general-market-highland:black-beans', 1.0000),
  ('dollar-general-market-highland', 'corn-tortillas', 2.15, 'USD', null, false, now() - interval '5 days', 'mock-market-data', 'dollar-general-market-highland:corn-tortillas', 1.0000),
  ('dollar-general-market-highland', 'olive-oil', 2.75, 'USD', null, true, now() - interval '5 days', 'mock-market-data', 'dollar-general-market-highland:olive-oil', 1.0000);
