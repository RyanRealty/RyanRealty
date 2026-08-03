-- audit: migration — rebuild listing_tile_mv_src with ZERO reads of
-- listings.details (marker required by the DAL-bypass guard).
--
-- THE HEADLINE DEFECT. listing_tile_mv_src's definition contained exactly one
-- details read:
--
--   nullif(btrim(details ->> 'StreetSuffix'), '') as street_suffix
--
-- One string, over all 594,099 IDX-permitted rows, on a matview that pg_cron job
-- 164 refreshes every 30 minutes. Postgres has no partial-detoast path, so that
-- expression reassembles the whole ~10 KB jsonb document from its TOAST chunks
-- once per row. At the measured +3.845 ms/row (docs/TOAST_READ_DISCIPLINE.md,
-- controlled A/B: typed columns 0.107 ms/row vs +one details key 3.953 ms/row,
-- 36.9x, +5.17 buffer blocks/row) that single expression accounts for ~2,284 s
-- of every refresh. This is the documented root of the historical
-- "listing_tile_mv went 8 days stale" incident; the 300 -> 900 -> 1800 s timeout
-- escalations treated the symptom.
--
-- After this migration the definition reads typed columns and one narrow
-- side-table join. Nothing in the tile chain touches details.
--
-- ── WHERE street_suffix COMES FROM NOW ──────────────────────────────────────
-- listings has NO typed street_suffix column (information_schema sweep for
-- '%suffix%' returns zero rows), so this is the side-table remedy, not the
-- typed-column swap. 20260801050000 added listing_feature_flags.street_suffix
-- and taught sync_listing_feature_flags() to maintain it; 20260801051000 /
-- 20260801051500 backfilled the pre-existing 594,199 rows. Coverage was verified
-- at 594,199 / 594,199 with 0 listings lacking a flags row before any of this
-- started, so the LEFT JOIN below cannot drop or blank a row.
--
-- ── THE EQUIVALENCE PROOF (zero detoast, whole table) ───────────────────────
-- The live matview's OWN street_suffix column is a materialized copy of the
-- jsonb expression, produced by an independent execution of it at the last
-- refresh. So the proof is a join between the old matview and the new side-table
-- column, with no jsonb touched at all — restricted to rows whose
-- "ModificationTimestamp" predates the start of the refresh run that produced
-- the current contents, because only those rows are guaranteed to have presented
-- identical details to both readers. Numbers are recorded in the commit message
-- and the task report; mismatch, mv_only and side_only must all be 0.
--
-- ── ZERO-DOWNTIME SHAPE ─────────────────────────────────────────────────────
-- Same two-step build/swap as 20260731170000_listing_search_mv_v4.sql, with one
-- addition: similar_listings_mv_src is a matview built ON TOP of
-- listing_tile_mv_src (pg_depend/pg_rewrite sweep), and similar_listings_mv
-- reads both it and the listing_tile_mv serving view. A plain DROP of the tile
-- matview would cascade that 76,366-row / 34 MB projection away, so the new
-- similar_listings_mv_src_new is built in the same step off the new tile source
-- and renamed in the same transaction. Neither serving view is ever absent and
-- neither matview is ever left WITH NO DATA.
--
-- STEP 1 (pg_cron one-shot, statement_timeout 0): build both _new matviews WITH
--   DATA, all 13 indexes under _new names, analyze. Touches nothing a reader
--   sees. Idempotent (IF NOT EXISTS throughout) and self-unscheduling.
--   `SET LOCAL statement_timeout = '0'` must be its OWN top-level statement —
--   set_config() inside a DO block arms too late (proven on this database
--   2026-07-31, see the v4 migration header).
-- STEP 2 (run directly, once step 1 reports succeeded): the swap. Metadata-only,
--   all-or-nothing, sub-second.
--
-- PRIVILEGE POSTURE (load-bearing, verified before the change): neither _src
-- matview carries ANY grant — the serving views run with the owner's rights.
-- Supabase's ALTER DEFAULT PRIVILEGES auto-grants new relations to anon and
-- authenticated, so the REVOKEs below are what keep the _src relations
-- ungranted, and the Coming Soon lockdown stays on the serving view where it is
-- today.

-- ════════════════════════════════════════════════════════════════════════════
-- STEP 1 — build beside the live objects (pg_cron one-shot)
-- ════════════════════════════════════════════════════════════════════════════
select cron.schedule(
  'rr-tile-mv-nodetoast-build',
  '*/5 * * * *',            -- fires once; the command unschedules itself
  $cmd$
  set local statement_timeout = '0';

  create materialized view if not exists public.listing_tile_mv_src_new as
    select
      l."ListingKey"          as listing_key,
      l."ListNumber"          as list_number,
      l."StandardStatus"      as standard_status,
      l."ListPrice"           as list_price,
      l."ClosePrice"          as close_price,
      l."CloseDate"           as close_date,
      l."BedroomsTotal"       as beds,
      l."BathroomsTotal"      as baths,
      l."TotalLivingAreaSqFt" as sqft,
      l."StreetNumber"        as street_number,
      l."StreetName"          as street_name,
      f.street_suffix         as street_suffix,
      l."City"                as city,
      lower(trim(both from l."City")) as city_lower,
      l."PostalCode"          as postal_code,
      l."SubdivisionName"     as subdivision_name,
      lower(trim(both from l."SubdivisionName")) as subdivision_lower,
      l."Latitude"            as lat,
      l."Longitude"           as lng,
      l."PhotoURL"            as photo_url,
      l."PropertyType"        as property_type,
      l.property_sub_type,
      l."OnMarketDate"        as on_market_date,
      l."ModificationTimestamp" as modified_at,
      l.price_per_sqft,
      l.lot_size_acres,
      l.year_built,
      l.garage_spaces,
      l.pool_yn,
      l.has_virtual_tour,
      l."DaysOnMarket"        as dom,
      l.price_drop_count,
      lower(regexp_replace(
        concat_ws('-'::text, l."StreetNumber",
          regexp_replace(coalesce(l."StreetName", ''::text), '\s+'::text, '-'::text, 'g'::text)),
        '[^a-z0-9-]'::text, ''::text, 'g'::text)) as address_slug,
      l.boundary_city,
      l.boundary_neighborhood,
      l.boundary_subdivision,
      (((setweight(to_tsvector('english'::regconfig, coalesce(l."StreetNumber", ''::text)), 'A'::"char")
        || setweight(to_tsvector('english'::regconfig, coalesce(l."StreetName", ''::text)), 'A'::"char"))
        || setweight(to_tsvector('english'::regconfig, coalesce(l."City", ''::text)), 'B'::"char"))
        || setweight(to_tsvector('english'::regconfig, coalesce(l."SubdivisionName", ''::text)), 'B'::"char"))
        || setweight(to_tsvector('english'::regconfig, coalesce(l."PostalCode", ''::text)), 'C'::"char")
        as search_vector
    from public.listings l
    left join public.listing_feature_flags f on f.list_number = l."ListNumber"
    where l.permit_internet_yn is distinct from false
      and l.idx_participant is distinct from false;

  create unique index if not exists listing_tile_mv_key_new
    on public.listing_tile_mv_src_new using btree (listing_key);
  create index if not exists idx_listing_tile_mv_postal_code_prefix_new
    on public.listing_tile_mv_src_new using btree (postal_code text_pattern_ops);
  create index if not exists idx_listing_tile_mv_street_number_prefix_new
    on public.listing_tile_mv_src_new using btree (street_number text_pattern_ops);
  create index if not exists listing_tile_mv_active_latlng_new
    on public.listing_tile_mv_src_new using btree (lat, lng)
    where ((standard_status = any (array['Active'::text,'Coming Soon'::text,'Active Under Contract'::text]))
           and (lat is not null) and (lng is not null));
  create index if not exists listing_tile_mv_address_slug_new
    on public.listing_tile_mv_src_new using btree (city_lower, address_slug);
  create index if not exists listing_tile_mv_boundary_neighborhood_new
    on public.listing_tile_mv_src_new using btree (boundary_neighborhood)
    where (boundary_neighborhood is not null);
  create index if not exists listing_tile_mv_city_status_mod_new
    on public.listing_tile_mv_src_new using btree (city_lower, standard_status, modified_at desc nulls last)
    where (standard_status = any (array['Active'::text,'Coming Soon'::text,'Active Under Contract'::text]));
  create index if not exists listing_tile_mv_city_sub_status_new
    on public.listing_tile_mv_src_new using btree (city_lower, subdivision_lower, standard_status)
    where (standard_status = any (array['Active'::text,'Coming Soon'::text,'Active Under Contract'::text,'Pending'::text]));
  create index if not exists listing_tile_mv_latlng_all_new
    on public.listing_tile_mv_src_new using btree (lat, lng)
    where ((lat is not null) and (lng is not null));
  create index if not exists listing_tile_mv_list_number_new
    on public.listing_tile_mv_src_new using btree (list_number);
  create index if not exists listing_tile_mv_search_new
    on public.listing_tile_mv_src_new using gin (search_vector);

  revoke all on public.listing_tile_mv_src_new from public, anon, authenticated;
  analyze public.listing_tile_mv_src_new;

  -- similar_listings_mv_src rebuilt off the NEW tile source, definition
  -- otherwise byte-identical to the live one.
  create materialized view if not exists public.similar_listings_mv_src_new as
    with active_anchors as (
      select t.listing_key, t.city_lower, t.subdivision_lower, t.list_price, t.beds, t.photo_url
      from public.listing_tile_mv_src_new t
      where (t.standard_status = any (array['Active'::text,'Coming Soon'::text,'Active Under Contract'::text]))
        and t.city_lower is not null and t.list_price is not null and t.list_price > 0::numeric
    ), candidates as (
      select a.listing_key as anchor_key,
             c.listing_key as similar_key,
             case when a.subdivision_lower is not null and a.subdivision_lower = c.subdivision_lower
                  then 100 else 50 end
               + (40::numeric * (1::numeric - least(1::numeric, abs(c.list_price - a.list_price) / a.list_price)))::integer
               as similarity_score,
             row_number() over (partition by a.listing_key order by
               (case when a.subdivision_lower is not null and a.subdivision_lower = c.subdivision_lower then 0 else 1 end),
               (abs(c.list_price - a.list_price)),
               c.modified_at desc nulls last) as rank
      from active_anchors a
      join public.listing_tile_mv_src_new c
        on c.city_lower = a.city_lower
       and (c.standard_status = any (array['Active'::text,'Coming Soon'::text,'Active Under Contract'::text]))
       and c.listing_key <> a.listing_key
       and c.list_price is not null
       and c.list_price >= (a.list_price * 0.80)
       and c.list_price <= (a.list_price * 1.20)
       and (a.beds is null or c.beds is null or (c.beds >= greatest(0, a.beds - 1) and c.beds <= (a.beds + 1)))
       and c.photo_url is not null
    )
    select anchor_key, similar_key, rank::smallint as rank,
           similarity_score::smallint as similarity_score, now() as refreshed_at
    from candidates where rank <= 12;

  create unique index if not exists similar_listings_mv_anchor_rank_new
    on public.similar_listings_mv_src_new using btree (anchor_key, rank);
  create unique index if not exists similar_listings_mv_anchor_similar_new
    on public.similar_listings_mv_src_new using btree (anchor_key, similar_key);

  revoke all on public.similar_listings_mv_src_new from public, anon, authenticated;
  analyze public.similar_listings_mv_src_new;

  select cron.unschedule('rr-tile-mv-nodetoast-build');
  $cmd$
);

-- ════════════════════════════════════════════════════════════════════════════
-- STEP 2 — the swap. Run ONLY after step 1 reports success:
--   select status, end_time - start_time from cron.job_run_details
--   where command like '%rr-tile-mv-nodetoast-build%' order by start_time desc limit 1;
-- ════════════════════════════════════════════════════════════════════════════

begin;

-- Fail fast rather than queue behind a running REFRESH ... CONCURRENTLY (job 164
-- fires at :02/:32). If this trips, wait for the refresh and re-run — nothing
-- has changed.
set local lock_timeout = '20s';

drop view if exists public.similar_listings_mv;
drop view if exists public.listing_tile_mv;
drop materialized view if exists public.similar_listings_mv_src;
drop materialized view if exists public.listing_tile_mv_src;

alter materialized view public.listing_tile_mv_src_new rename to listing_tile_mv_src;
alter index public.listing_tile_mv_key_new                    rename to listing_tile_mv_key;
alter index public.idx_listing_tile_mv_postal_code_prefix_new rename to idx_listing_tile_mv_postal_code_prefix;
alter index public.idx_listing_tile_mv_street_number_prefix_new rename to idx_listing_tile_mv_street_number_prefix;
alter index public.listing_tile_mv_active_latlng_new          rename to listing_tile_mv_active_latlng;
alter index public.listing_tile_mv_address_slug_new           rename to listing_tile_mv_address_slug;
alter index public.listing_tile_mv_boundary_neighborhood_new  rename to listing_tile_mv_boundary_neighborhood;
alter index public.listing_tile_mv_city_status_mod_new        rename to listing_tile_mv_city_status_mod;
alter index public.listing_tile_mv_city_sub_status_new        rename to listing_tile_mv_city_sub_status;
alter index public.listing_tile_mv_latlng_all_new             rename to listing_tile_mv_latlng_all;
alter index public.listing_tile_mv_list_number_new            rename to listing_tile_mv_list_number;
alter index public.listing_tile_mv_search_new                 rename to listing_tile_mv_search;

alter materialized view public.similar_listings_mv_src_new rename to similar_listings_mv_src;
alter index public.similar_listings_mv_anchor_rank_new    rename to similar_listings_mv_anchor_rank;
alter index public.similar_listings_mv_anchor_similar_new rename to similar_listings_mv_anchor_similar;

comment on materialized view public.listing_tile_mv_src is
  'Tile projection over listings for the IDX-permitted scope. Reads TYPED COLUMNS ONLY plus listing_feature_flags.street_suffix — it must never read the listings jsonb document again. The single StreetSuffix extraction it used to carry cost ~2,284 s of detoast per refresh across 594,099 rows and is the documented cause of the stale-matview incidents (docs/TOAST_READ_DISCIPLINE.md). Refresh timestamp lives in public.mv_refresh_state.';

comment on materialized view public.similar_listings_mv_src is
  'Similar-listing pairs for on-market anchors, built over listing_tile_mv_src. Rebuilt 2026-08-01 alongside the tile source; definition otherwise unchanged.';

-- Serving views recreated exactly as they were.
create view public.listing_tile_mv as
  select
    listing_key, list_number, standard_status, list_price, close_price, close_date,
    beds, baths, sqft, street_number, street_name, street_suffix, city, city_lower,
    postal_code, subdivision_name, subdivision_lower, lat, lng, photo_url,
    property_type, property_sub_type, on_market_date, modified_at, price_per_sqft,
    lot_size_acres, year_built, garage_spaces, pool_yn, has_virtual_tour, dom,
    price_drop_count, address_slug, boundary_city, boundary_neighborhood,
    boundary_subdivision, search_vector,
    (select s.refreshed_at from public.mv_refresh_state s
      where s.mv_name = 'listing_tile_mv_src') as refreshed_at
  from public.listing_tile_mv_src
  where coalesce(standard_status, ''::text) !~~* '%coming%soon%'::text;

create view public.similar_listings_mv as
  select anchor_key, similar_key, rank, similarity_score, refreshed_at
  from public.similar_listings_mv_src s
  where exists (select 1 from public.listing_tile_mv a where a.listing_key = s.anchor_key)
    and exists (select 1 from public.listing_tile_mv b where b.listing_key = s.similar_key);

grant select on public.listing_tile_mv    to anon, authenticated, service_role;
grant select on public.similar_listings_mv to anon, authenticated, service_role;
revoke all on public.listing_tile_mv_src     from public, anon, authenticated;
revoke all on public.similar_listings_mv_src from public, anon, authenticated;

commit;
