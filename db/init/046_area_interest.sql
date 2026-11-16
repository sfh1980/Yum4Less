-- ZIP-only waitlist for areas that do not have dinner estimates yet.
-- No name, email, IP, session id, or free text.
-- Rollback: drop table if exists area_interest;

create table if not exists area_interest (
  zip text primary key check (zip ~ '^[0-9]{5}$'),
  first_requested_at timestamptz not null default now(),
  last_requested_at timestamptz not null default now(),
  request_count integer not null default 1 check (request_count > 0)
);
