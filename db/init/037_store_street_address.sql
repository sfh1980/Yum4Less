-- Street and ZIP for a grocery building. Owner Markets and the shopper store
-- line read these columns. A blank street stays blank.
-- Watchtower does not migrate by itself.

alter table stores add column if not exists address_line text;
alter table stores add column if not exists postal_code text;

update stores as s
set
  address_line = coalesce(nullif(btrim(s.address_line), ''), nullif(btrim(snap.address_line1), '')),
  postal_code = coalesce(nullif(btrim(s.postal_code), ''), nullif(btrim(snap.zip_code), ''))
from store_identity_aliases as a
join snap_retailer_locations as snap on snap.id = a.snap_retailer_id
where a.store_id = s.id
  and a.link_status in ('confirmed', 'provisional')
  and a.snap_retailer_id is not null;

drop view if exists store_coverage;
create view store_coverage as
select
  s.id as store_id,
  s.name,
  s.kind,
  s.city,
  s.state,
  s.latitude,
  s.longitude,
  s.source_name,
  s.source_store_id,
  true as seen,
  (s.latitude is not null and s.longitude is not null) as mapped,
  coalesce(sales.fresh_sale_count, 0) as fresh_sale_count,
  sales.last_sale_at,
  s.address_line,
  s.postal_code
from stores s
left join lateral (
  select
    count(*)::int as fresh_sale_count,
    max(coalesce(po.last_verified_at, po.observed_at)) as last_sale_at
  from price_observations po
  where po.store_id = s.id
    and po.in_stock
    and coalesce(po.last_verified_at, po.observed_at)
      >= now() - interval '24 hours'
) sales on true;
