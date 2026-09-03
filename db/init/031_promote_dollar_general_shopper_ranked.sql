-- Promote Dollar General to shopper-ranked v1 for sale collection and
-- food-desert dinners. Same coverage floors as other ranked banners.
-- Dinner totals still require those floors AND no other ranked grocer nearby.
-- TrueNAS volumes that already applied 026 need this update; Watchtower does not migrate.

update chain_registry
set
  rollout_stage = 'ranked',
  shopper_ranked = true,
  settings_selectable = true,
  promotion_blocked = false,
  flipp_merchant_name = 'Dollar General',
  sale_discovery_strategy = 'flipp',
  weekly_ad_adapter = 'dollar-general-weekly-ad',
  notes = 'v1 ranked when weekly-ad floors pass and no other ranked grocer is nearby (food-desert dinners). Flipp ZIP circular is area-wide, not this building''s shelf. Thin pantry match stays map + sale list with an honest reason.'
where chain_id = 'dollar-general';
