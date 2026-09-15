-- R11: curated cuisine facet for dinner filter chips (not freeform tags / dietary_tags).
alter table recipes
  add column if not exists cuisine_tags text[] not null default '{}';

comment on column recipes.cuisine_tags is
  'Curated R11 cuisine chip ids (american, italian, mexican, chinese, thai, japanese, greek, indian, korean, vietnamese). Empty = unmapped.';

-- Backfill from TheMealDB summary prose ("Cuisine: Italian.") for existing rows.
update recipes
set cuisine_tags = array[mapped.cuisine_id]::text[]
from (
  select
    id,
    case
      when summary ~* 'Cuisine:\s*(American|United States|USA|US|British|Canadian)\.' then 'american'
      when summary ~* 'Cuisine:\s*Italian\.' then 'italian'
      when summary ~* 'Cuisine:\s*Mexican\.' then 'mexican'
      when summary ~* 'Cuisine:\s*Chinese\.' then 'chinese'
      when summary ~* 'Cuisine:\s*Thai\.' then 'thai'
      when summary ~* 'Cuisine:\s*Japanese\.' then 'japanese'
      when summary ~* 'Cuisine:\s*Greek\.' then 'greek'
      when summary ~* 'Cuisine:\s*Indian\.' then 'indian'
      when summary ~* 'Cuisine:\s*(Korean|South Korean)\.' then 'korean'
      when summary ~* 'Cuisine:\s*Vietnamese\.' then 'vietnamese'
      else null
    end as cuisine_id
  from recipes
) as mapped
where recipes.id = mapped.id
  and mapped.cuisine_id is not null
  and coalesce(cardinality(recipes.cuisine_tags), 0) = 0;
