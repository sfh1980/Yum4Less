-- Owner morning note. ZIP codes here are for /owner and Discord, not analytics_events.

create table if not exists morning_reports (
  report_date date not null,
  kind text not null check (kind in ('morning', 'missed')),
  body text not null,
  needs_attention boolean not null,
  created_at timestamptz not null default now(),
  primary key (report_date, kind)
);

create table if not exists morning_external_checks (
  check_date date primary key,
  code_tests text not null check (code_tests in ('passed', 'failed', 'not_reported')),
  site_check text not null check (site_check in ('passed', 'failed', 'not_reported')),
  detail text not null default '',
  received_at timestamptz not null default now()
);

create table if not exists morning_zip_adds (
  zip_code text primary key,
  added_on date not null,
  tested_on date,
  outcome text
);
