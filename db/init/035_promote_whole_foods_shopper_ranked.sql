-- Promote Whole Foods to shopper-ranked v1 (Settings + dinner estimates when
-- weekly-ad promotion gates pass). Same coverage floors as other ranked banners.
-- TrueNAS volumes that already applied 034 need this update; Watchtower does not migrate.

update chain_registry
set
  rollout_stage = 'ranked',
  shopper_ranked = true,
  settings_selectable = true,
  promotion_blocked = false,
  notes = 'v1 ranked when weekly-ad promotion gates pass. Missing estimates stay map context with an honest reason, not a permanent block.'
where chain_id = 'whole-foods';
