-- Kroger priority-2 fallback terms for INTERNAL_CATALOG gaps (020).
-- Idempotent: safe to re-run on volumes that already applied 013.

insert into provider_search_terms (ingredient_id, provider, search_term, priority, notes)
values
  (
    'chickpeas',
    'kroger',
    'garbanzo beans',
    2,
    'Priority-2 fallback when priority-1 chickpeas matches hummus or misses canned beans.'
  ),
  (
    'dried-oregano',
    'kroger',
    'oregano leaves',
    2,
    'Priority-2 fallback when priority-1 dried oregano matches oil or fresh herbs.'
  ),
  (
    'cornstarch',
    'kroger',
    'corn starch',
    2,
    'Priority-2 fallback for spaced Kroger product titles.'
  ),
  (
    'jalapeno',
    'kroger',
    'jalapeno pepper',
    2,
    'Priority-2 ASCII fallback when jalapeño priority-1 misses fresh peppers.'
  ),
  (
    'shredded-cheese-blend',
    'kroger',
    'shredded Mexican cheese',
    2,
    'Priority-2 fallback when Mexican cheese blend matches queso or dip SKUs.'
  ),
  (
    'bread-loaf',
    'kroger',
    'bread loaf',
    2,
    'Priority-2 fallback when white sandwich bread misses standard loaf SKUs.'
  )
on conflict (provider, ingredient_id, search_term) do nothing;
