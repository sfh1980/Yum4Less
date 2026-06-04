create table if not exists analytics_events (
  id bigserial primary key,
  received_at timestamptz not null default now(),
  event_name text not null,
  session_id text,
  properties jsonb not null default '{}'::jsonb,
  app_env text not null default 'development'
);

create index if not exists idx_analytics_events_received_at
  on analytics_events (received_at desc);

create index if not exists idx_analytics_events_name_time
  on analytics_events (event_name, received_at desc);
