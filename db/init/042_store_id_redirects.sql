-- A same-building merge deletes the extra store row. The shopper's saved
-- Settings id has to follow the row that remains. store_identity_aliases
-- cannot hold that pointer: one alias per store, and the store_id foreign
-- key disappears with the deleted row.

create table if not exists store_id_redirects (
  from_id text primary key,
  to_id text not null references stores (id) on delete restrict,
  created_at timestamptz not null default now(),
  constraint store_id_redirects_not_self check (from_id <> to_id)
);

create index if not exists store_id_redirects_to_id_idx
  on store_id_redirects (to_id);
