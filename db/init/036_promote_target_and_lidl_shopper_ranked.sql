-- Target: store-bound weekly ad, same dinner floors as other ranked banners.
-- Lidl: ZIP-wide circular stays honest via shopper copy (not this store's shelf).
-- TrueNAS volumes that already applied 030/032 need this update; Watchtower does not migrate.

update chain_registry
set
  rollout_stage = 'ranked',
  shopper_ranked = true,
  settings_selectable = true,
  promotion_blocked = false,
  notes = 'v1 ranked when weekly-ad promotion gates pass. Store-bound Target promotions. Missing estimates stay map context.'
where chain_id = 'target';

update chain_registry
set
  rollout_stage = 'ranked',
  shopper_ranked = true,
  settings_selectable = true,
  promotion_blocked = false,
  notes = 'v1 ranked when weekly-ad promotion gates pass. Prices are a ZIP weekly ad, not this store shelf. Shopper note must say that.'
where chain_id = 'lidl';
