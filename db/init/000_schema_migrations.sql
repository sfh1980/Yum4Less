-- Migration ledger: records which db/init/*.sql files have been applied.
-- Populated by scripts/lib/apply-migrations.mjs (backfill + incremental apply).

create table if not exists schema_migrations (
  version text primary key,
  filename text not null unique,
  checksum text not null,
  applied_at timestamptz not null default now()
);
