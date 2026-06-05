alter table ingredients
  drop constraint if exists ingredients_category_check;

alter table ingredients
  add constraint ingredients_category_check check (
    category in ('protein', 'produce', 'pantry', 'dairy', 'seasoning', 'baking', 'frozen')
  );

insert into ingredients (id, name, category, source_name, source_record_id)
values
  ('cumin', 'Ground cumin', 'seasoning', 'yum4less-internal-catalog', 'cumin'),
  ('chili-powder', 'Chili powder', 'seasoning', 'yum4less-internal-catalog', 'chili-powder'),
  ('paprika', 'Paprika', 'seasoning', 'yum4less-internal-catalog', 'paprika'),
  ('black-pepper', 'Black pepper', 'seasoning', 'yum4less-internal-catalog', 'black-pepper'),
  ('salt', 'Salt', 'seasoning', 'yum4less-internal-catalog', 'salt'),
  ('tomato-paste', 'Tomato paste', 'pantry', 'yum4less-internal-catalog', 'tomato-paste'),
  ('vegetable-oil', 'Vegetable oil', 'pantry', 'yum4less-internal-catalog', 'vegetable-oil'),
  ('hot-sauce', 'Hot sauce', 'seasoning', 'yum4less-internal-catalog', 'hot-sauce'),
  ('russet-potatoes', 'Russet potatoes', 'produce', 'yum4less-internal-catalog', 'russet-potatoes'),
  ('yukon-potatoes', 'Yukon gold potatoes', 'produce', 'yum4less-internal-catalog', 'yukon-potatoes'),
  ('white-rice', 'Long-grain white rice', 'pantry', 'yum4less-internal-catalog', 'white-rice'),
  ('brown-rice', 'Brown rice', 'pantry', 'yum4less-internal-catalog', 'brown-rice'),
  ('egg-noodles', 'Egg noodles', 'pantry', 'yum4less-internal-catalog', 'egg-noodles'),
  ('fettuccine', 'Fettuccine', 'pantry', 'yum4less-internal-catalog', 'fettuccine'),
  ('elbow-macaroni', 'Elbow macaroni', 'pantry', 'yum4less-internal-catalog', 'elbow-macaroni'),
  ('rice-noodles', 'Rice noodles', 'pantry', 'yum4less-internal-catalog', 'rice-noodles'),
  ('garlic-powder', 'Garlic powder', 'seasoning', 'yum4less-internal-catalog', 'garlic-powder'),
  ('onion-powder', 'Onion powder', 'seasoning', 'yum4less-internal-catalog', 'onion-powder'),
  ('dried-oregano', 'Dried oregano', 'seasoning', 'yum4less-internal-catalog', 'dried-oregano'),
  ('dried-basil', 'Dried basil', 'seasoning', 'yum4less-internal-catalog', 'dried-basil'),
  ('cayenne', 'Cayenne pepper', 'seasoning', 'yum4less-internal-catalog', 'cayenne'),
  ('italian-seasoning', 'Italian seasoning', 'seasoning', 'yum4less-internal-catalog', 'italian-seasoning'),
  ('taco-seasoning', 'Taco seasoning mix', 'seasoning', 'yum4less-internal-catalog', 'taco-seasoning'),
  ('rice-vinegar', 'Rice vinegar', 'seasoning', 'yum4less-internal-catalog', 'rice-vinegar'),
  ('balsamic-vinegar', 'Balsamic vinegar', 'seasoning', 'yum4less-internal-catalog', 'balsamic-vinegar'),
  ('dijon-mustard', 'Dijon mustard', 'seasoning', 'yum4less-internal-catalog', 'dijon-mustard'),
  ('all-purpose-flour', 'All-purpose flour', 'baking', 'yum4less-internal-catalog', 'all-purpose-flour'),
  ('granulated-sugar', 'Granulated sugar', 'baking', 'yum4less-internal-catalog', 'granulated-sugar'),
  ('brown-sugar', 'Brown sugar', 'baking', 'yum4less-internal-catalog', 'brown-sugar'),
  ('honey', 'Honey', 'baking', 'yum4less-internal-catalog', 'honey'),
  ('baking-powder', 'Baking powder', 'baking', 'yum4less-internal-catalog', 'baking-powder'),
  ('baking-soda', 'Baking soda', 'baking', 'yum4less-internal-catalog', 'baking-soda'),
  ('vanilla-extract', 'Vanilla extract', 'baking', 'yum4less-internal-catalog', 'vanilla-extract'),
  ('cornstarch', 'Cornstarch', 'baking', 'yum4less-internal-catalog', 'cornstarch'),
  ('frozen-broccoli', 'Frozen broccoli', 'frozen', 'yum4less-internal-catalog', 'frozen-broccoli'),
  ('frozen-green-beans', 'Frozen green beans', 'frozen', 'yum4less-internal-catalog', 'frozen-green-beans'),
  ('frozen-corn', 'Frozen corn', 'frozen', 'yum4less-internal-catalog', 'frozen-corn'),
  ('frozen-peas', 'Frozen peas', 'frozen', 'yum4less-internal-catalog', 'frozen-peas'),
  ('frozen-spinach', 'Frozen spinach', 'frozen', 'yum4less-internal-catalog', 'frozen-spinach'),
  ('frozen-mixed-vegetables', 'Frozen mixed vegetables', 'frozen', 'yum4less-internal-catalog', 'frozen-mixed-vegetables'),
  ('frozen-berries', 'Frozen berries', 'frozen', 'yum4less-internal-catalog', 'frozen-berries'),
  ('bacon', 'Bacon', 'protein', 'yum4less-internal-catalog', 'bacon'),
  ('pork-shoulder', 'Pork shoulder', 'protein', 'yum4less-internal-catalog', 'pork-shoulder'),
  ('salmon-fillet', 'Salmon fillet', 'protein', 'yum4less-internal-catalog', 'salmon-fillet'),
  ('shrimp', 'Shrimp', 'protein', 'yum4less-internal-catalog', 'shrimp'),
  ('celery', 'Celery', 'produce', 'yum4less-internal-catalog', 'celery'),
  ('sweet-potato', 'Sweet potato', 'produce', 'yum4less-internal-catalog', 'sweet-potato'),
  ('cilantro', 'Cilantro', 'produce', 'yum4less-internal-catalog', 'cilantro'),
  ('jalapeno', 'Jalapeño', 'produce', 'yum4less-internal-catalog', 'jalapeno'),
  ('avocado', 'Avocado', 'produce', 'yum4less-internal-catalog', 'avocado'),
  ('cream-cheese', 'Cream cheese', 'dairy', 'yum4less-internal-catalog', 'cream-cheese'),
  ('heavy-cream', 'Heavy cream', 'dairy', 'yum4less-internal-catalog', 'heavy-cream'),
  ('plain-yogurt', 'Plain yogurt', 'dairy', 'yum4less-internal-catalog', 'plain-yogurt'),
  ('shredded-cheese-blend', 'Shredded Mexican cheese blend', 'dairy', 'yum4less-internal-catalog', 'shredded-cheese-blend'),
  ('bread-loaf', 'Sandwich bread', 'pantry', 'yum4less-internal-catalog', 'bread-loaf'),
  ('canned-corn', 'Canned corn', 'pantry', 'yum4less-internal-catalog', 'canned-corn')
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
  ('black-bean-tacos', 'taco-seasoning', 'Taco seasoning', '1 packet', 6, 1.0000),
  ('black-bean-tacos', 'cumin', 'Ground cumin', '1 tsp', 7, 1.0000),
  ('weeknight-beef-chili', 'cumin', 'Ground cumin', '1 tbsp', 7, 1.0000),
  ('weeknight-beef-chili', 'chili-powder', 'Chili powder', '1 tbsp', 8, 1.0000),
  ('garlic-butter-pasta', 'garlic', 'Garlic', '4 cloves', 6, 1.0000),
  ('italian-sausage-penne', 'italian-seasoning', 'Italian seasoning', '1 tsp', 5, 1.0000)
on conflict (recipe_id, ingredient_id) do nothing;
