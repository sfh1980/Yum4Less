-- Promote Lidl to shopper-ranked v1 (Settings + dinner estimates when
-- weekly-ad promotion gates pass). TrueNAS volumes that already applied 026
-- need this update; Watchtower does not migrate.

update chain_registry
set
  rollout_stage = 'ranked',
  shopper_ranked = true,
  settings_selectable = true,
  notes = 'v1 ranked when weekly-ad promotion gates pass. Coordinate sanity still required.'
where chain_id = 'lidl';
