-- Store catalog rows are ingest-only (map-catalog, provider sync, weekly-ad).
-- CI/integration bootstrap pins live in db/ci/014_ci_bootstrap_stores.sql.

insert into ingredients (
  id,
  name,
  category,
  source_name,
  source_record_id
)
values
  ('chicken-thighs', 'Chicken thighs', 'protein', 'yum4less-internal-catalog', 'chicken-thighs'),
  ('baby-potatoes', 'Baby potatoes', 'produce', 'yum4less-internal-catalog', 'baby-potatoes'),
  ('broccoli', 'Broccoli', 'produce', 'yum4less-internal-catalog', 'broccoli'),
  ('lemon', 'Lemon', 'produce', 'yum4less-internal-catalog', 'lemon'),
  ('olive-oil', 'Olive oil', 'pantry', 'yum4less-internal-catalog', 'olive-oil'),
  ('black-beans', 'Black beans', 'pantry', 'yum4less-internal-catalog', 'black-beans'),
  ('corn-tortillas', 'Corn tortillas', 'pantry', 'yum4less-internal-catalog', 'corn-tortillas'),
  ('cabbage', 'Green cabbage', 'produce', 'yum4less-internal-catalog', 'cabbage'),
  ('lime', 'Lime', 'produce', 'yum4less-internal-catalog', 'lime'),
  ('spaghetti', 'Spaghetti', 'pantry', 'yum4less-internal-catalog', 'spaghetti'),
  ('spinach', 'Spinach', 'produce', 'yum4less-internal-catalog', 'spinach'),
  ('parmesan', 'Parmesan', 'dairy', 'yum4less-internal-catalog', 'parmesan'),
  ('butter', 'Butter', 'dairy', 'yum4less-internal-catalog', 'butter'),
  ('tofu', 'Extra-firm tofu', 'protein', 'yum4less-internal-catalog', 'tofu'),
  ('jasmine-rice', 'Jasmine rice', 'pantry', 'yum4less-internal-catalog', 'jasmine-rice'),
  ('bell-peppers', 'Bell peppers', 'produce', 'yum4less-internal-catalog', 'bell-peppers'),
  ('soy-sauce', 'Soy sauce', 'pantry', 'yum4less-internal-catalog', 'soy-sauce'),
  ('green-onion', 'Green onion', 'produce', 'yum4less-internal-catalog', 'green-onion'),
  ('ground-beef', 'Ground beef', 'protein', 'yum4less-internal-catalog', 'ground-beef'),
  ('chicken-breast', 'Chicken breast', 'protein', 'yum4less-internal-catalog', 'chicken-breast'),
  ('ground-turkey', 'Ground turkey', 'protein', 'yum4less-internal-catalog', 'ground-turkey'),
  ('yellow-onion', 'Yellow onion', 'produce', 'yum4less-internal-catalog', 'yellow-onion'),
  ('garlic', 'Garlic', 'pantry', 'yum4less-internal-catalog', 'garlic'),
  ('carrots', 'Carrots', 'produce', 'yum4less-internal-catalog', 'carrots'),
  ('green-beans', 'Green beans', 'produce', 'yum4less-internal-catalog', 'green-beans'),
  ('eggs', 'Eggs', 'dairy', 'yum4less-internal-catalog', 'eggs'),
  ('cheddar-cheese', 'Cheddar cheese', 'dairy', 'yum4less-internal-catalog', 'cheddar-cheese'),
  ('whole-milk', 'Whole milk', 'dairy', 'yum4less-internal-catalog', 'whole-milk'),
  ('pasta-sauce', 'Pasta sauce', 'pantry', 'yum4less-internal-catalog', 'pasta-sauce'),
  ('canned-tomatoes', 'Canned tomatoes', 'pantry', 'yum4less-internal-catalog', 'canned-tomatoes'),
  ('chicken-broth', 'Chicken broth', 'pantry', 'yum4less-internal-catalog', 'chicken-broth'),
  ('pinto-beans', 'Pinto beans', 'pantry', 'yum4less-internal-catalog', 'pinto-beans'),
  ('chickpeas', 'Chickpeas', 'pantry', 'yum4less-internal-catalog', 'chickpeas'),
  ('flour-tortillas', 'Flour tortillas', 'pantry', 'yum4less-internal-catalog', 'flour-tortillas'),
  ('penne-pasta', 'Penne pasta', 'pantry', 'yum4less-internal-catalog', 'penne-pasta'),
  ('roma-tomatoes', 'Roma tomatoes', 'produce', 'yum4less-internal-catalog', 'roma-tomatoes'),
  ('zucchini', 'Zucchini', 'produce', 'yum4less-internal-catalog', 'zucchini'),
  ('mushrooms', 'Mushrooms', 'produce', 'yum4less-internal-catalog', 'mushrooms'),
  ('italian-sausage', 'Italian sausage', 'protein', 'yum4less-internal-catalog', 'italian-sausage'),
  ('sour-cream', 'Sour cream', 'dairy', 'yum4less-internal-catalog', 'sour-cream'),
  ('mozzarella', 'Mozzarella', 'dairy', 'yum4less-internal-catalog', 'mozzarella')
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
    'yum4less-internal-catalog',
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
    'yum4less-internal-catalog',
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
    'yum4less-internal-catalog',
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
    'yum4less-internal-catalog',
    'crispy-tofu-rice-bowls'
  ),
  (
    'weeknight-beef-chili',
    'Weeknight Beef and Bean Chili',
    'A one-pot chili built from ground beef, beans, and pantry staples that stays budget-friendly for busy weeknights.',
    40,
    'easy',
    array['quick', 'family', 'budget', 'single-store friendly'],
    array[]::text[],
    array[
      'Brown the ground beef with diced onion until no longer pink.',
      'Stir in canned tomatoes, pinto beans, and chicken broth; simmer until flavors meld.',
      'Serve with optional sour cream once the chili thickens slightly.'
    ],
    'yum4less-internal-catalog',
    'weeknight-beef-chili'
  ),
  (
    'italian-sausage-penne',
    'Italian Sausage Penne Skillet',
    'A skillet pasta dinner that pairs browned sausage with penne, sauce, and melted mozzarella.',
    30,
    'easy',
    array['quick', 'family', 'single-store friendly'],
    array[]::text[],
    array[
      'Brown Italian sausage in a skillet and drain excess fat if needed.',
      'Cook penne until al dente, then toss with pasta sauce and sausage.',
      'Top with mozzarella and cover briefly until the cheese melts.'
    ],
    'yum4less-internal-catalog',
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
  ('crispy-tofu-rice-bowls', 'olive-oil', 'Olive oil', '1 bottle', 6, 1.0000),
  ('weeknight-beef-chili', 'ground-beef', 'Ground beef', '1 lb', 1, 1.0000),
  ('weeknight-beef-chili', 'pinto-beans', 'Pinto beans', '2 cans', 2, 1.0000),
  ('weeknight-beef-chili', 'canned-tomatoes', 'Canned tomatoes', '2 cans', 3, 1.0000),
  ('weeknight-beef-chili', 'yellow-onion', 'Yellow onion', '1', 4, 1.0000),
  ('weeknight-beef-chili', 'chicken-broth', 'Chicken broth', '2 cups', 5, 1.0000),
  ('weeknight-beef-chili', 'sour-cream', 'Sour cream', '1 tub', 6, 0.8500),
  ('italian-sausage-penne', 'italian-sausage', 'Italian sausage', '1 lb', 1, 1.0000),
  ('italian-sausage-penne', 'penne-pasta', 'Penne pasta', '1 box', 2, 1.0000),
  ('italian-sausage-penne', 'pasta-sauce', 'Pasta sauce', '1 jar', 3, 1.0000),
  ('italian-sausage-penne', 'mozzarella', 'Mozzarella', '8 oz', 4, 1.0000)
on conflict (recipe_id, ingredient_id) do nothing;

