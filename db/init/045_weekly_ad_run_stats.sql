-- One row per chain per night. A later run the same day updates the row.
-- Counts only. No page HTML, URLs, or store ids.
-- Rollback: drop table if exists weekly_ad_run_stats;

create table if not exists weekly_ad_run_stats (
  run_date date not null,
  chain text not null,
  status text not null,
  cards_seen integer,
  offers_parsed integer,
  matched integer,
  rows_written integer not null default 0,
  rows_skipped integer not null default 0,
  rows_failed integer not null default 0,
  seconds_taken integer not null default 0,
  thin_reason text,
  miss_reason text,
  recorded_at timestamptz not null default now(),
  primary key (run_date, chain)
);
