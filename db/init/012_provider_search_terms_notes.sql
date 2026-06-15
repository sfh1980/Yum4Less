-- Upgrade path when 011 ran before notes column and baby-potatoes term refresh.

alter table provider_search_terms
  add column if not exists notes text;

delete from provider_search_terms
where provider = 'kroger'
  and ingredient_id = 'baby-potatoes';

insert into provider_search_terms (ingredient_id, provider, search_term, priority, notes)
values
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
  )
on conflict (provider, ingredient_id, search_term) do update
set
  priority = excluded.priority,
  notes = excluded.notes,
  updated_at = now();

delete from provider_search_terms
where provider = 'kroger'
  and ingredient_id = 'baby-potatoes'
  and search_term = 'mini potatoes';
