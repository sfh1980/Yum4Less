-- Each morning row stores that morning's rows-per-store census.
-- The comparison baseline is the highest value per chain across the last 7
-- saved mornings. One low morning does not replace a higher one still in
-- that window. Rollback: alter table morning_reports drop column if exists coverage_baseline;

alter table morning_reports
  add column if not exists coverage_baseline jsonb;
