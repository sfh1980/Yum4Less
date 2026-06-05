create table if not exists customer_feedback (
  id bigserial primary key,
  received_at timestamptz not null default now(),
  issue_type text not null check (
    issue_type in ('wrong_price', 'missing_item', 'stale_ad', 'other', 'bug', 'general')
  ),
  chain_label text,
  product_description text,
  note text,
  app_env text not null default 'development'
);

create index if not exists idx_customer_feedback_received_at
  on customer_feedback (received_at desc);
