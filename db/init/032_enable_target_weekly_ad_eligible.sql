-- Enable Target weekly-ad ingest without ranked dinners.
-- Locator + promotions JSON adapter is code-side; keep shopper_ranked false.
-- TrueNAS volumes that already applied 026 need this update; Watchtower does not migrate.

update chain_registry
set
  rollout_stage = 'ingest_only',
  shopper_ranked = false,
  settings_selectable = false,
  weekly_ad_eligible = true,
  weekly_ad_adapter = 'target-weekly-ad',
  sale_discovery_strategy = 'retailer_json',
  location_strategy = 'locator_then_catalog',
  notes = 'Weekly-ad ingest via Target store locator + promotions JSON. Directional sales only — dinners stay off until floors + membership. Never hardcode store numbers; bind source_store_id from the ZIP locator.'
where chain_id = 'target';
