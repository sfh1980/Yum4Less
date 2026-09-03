-- Demote Lidl from shopper-ranked v1. Flipp ZIP circulars are not store-bound,
-- so Lidl stays map/context. Weekly-ad ingest remains eligible and fail-soft.
-- TrueNAS volumes that already applied 027 need this update; Watchtower does not migrate.

update chain_registry
set
  rollout_stage = 'map_context',
  shopper_ranked = false,
  settings_selectable = false,
  notes = 'Map context. ZIP-wide Flipp/hub circulars are not store-bound sale data, so Lidl is not used for dinner totals. Ingest stays fail-soft until a store-bound source exists.'
where chain_id = 'lidl';
