-- Coming Soon lockdown, part 2 of 2: materialized views + derived objects.
--
-- APPLIED TO PRODUCTION 2026-07-21 via Supabase apply_migration, in four
-- statements (tile / search+boundary / similar / geo_snapshot). Recorded here as
-- one file so the repo history matches the live database.
--
-- WHY: RLS protects tables, NOT materialized views. Part 1 (20260721090000)
-- closed the raw `listings` table, but every MV built from it still
-- materialized Coming Soon rows and was granted to `anon` — and the anon key
-- ships in the browser bundle. Verified leaking before this change:
--   listing_tile_mv 52 · listing_search_mv 52 · listing_boundary_xref_mv 152
--   listing_detail_mv 62 · beacon_comparable_listings_v 52
--   similar_listings_mv: 582 pairs recommending a Coming Soon listing
--
-- PATTERN: rename the MV to <name>_src, expose a filtered VIEW under the
-- ORIGINAL name, revoke anon/authenticated on _src. Every application call site
-- and every SQL function keeps working unchanged because the name they
-- reference now resolves to the filtered view. Refresh functions are repointed
-- at _src. No rebuild, no downtime.
--
-- MAINTENANCE NOTE: `create view ... as select *` freezes the column list at
-- creation time. If an MV gains a column, its wrapper view must be recreated to
-- expose it. G16 (ci:data-access) surfaces the drift via the schema snapshot.

-- ── listing_tile_mv ─────────────────────────────────────────────────────────
alter materialized view public.listing_tile_mv rename to listing_tile_mv_src;
create view public.listing_tile_mv with (security_barrier = true) as
  select * from public.listing_tile_mv_src
  where coalesce(standard_status, '') not ilike '%coming%soon%';
revoke all on public.listing_tile_mv_src from anon, authenticated;
grant select on public.listing_tile_mv_src to service_role;
grant select on public.listing_tile_mv to anon, authenticated, service_role;

-- ── listing_search_mv ───────────────────────────────────────────────────────
-- Column grants replicated EXACTLY (97 columns). private_remarks stays excluded
-- per 20260712000000_listing_private_redaction.sql — that redaction must survive.
alter materialized view public.listing_search_mv rename to listing_search_mv_src;
create view public.listing_search_mv with (security_barrier = true) as
  select * from public.listing_search_mv_src
  where coalesce(standard_status, '') not ilike '%coming%soon%';
revoke all on public.listing_search_mv_src from anon, authenticated;
grant select on public.listing_search_mv_src to service_role;
revoke all on public.listing_search_mv from public, anon, authenticated;
grant select on public.listing_search_mv to service_role;
grant select (
  listing_key, list_number, standard_status, list_price, close_price, close_date,
  beds, baths, sqft, street_number, street_name, street_suffix, city, city_lower,
  postal_code, subdivision_name, subdivision_lower, lat, lng, photo_url,
  property_type, property_sub_type, on_market_date, modified_at, price_per_sqft,
  lot_size_acres, year_built, garage_spaces, pool_yn, has_virtual_tour, dom,
  price_drop_count, address_slug, boundary_city, boundary_neighborhood,
  boundary_subdivision, search_vector, refreshed_at, fireplace_yn, waterfront_yn,
  basement_yn, horse_yn, senior_community_yn, new_construction_yn, association_yn,
  hoa_monthly, tax_annual_amount, estimated_monthly_piti,
  irrigation_water_rights_yn, county, elementary_school, middle_school,
  high_school, school_district, levels, baths_full, baths_half, public_remarks,
  has_open_house, price_reduced, appliances, flooring, heating_types,
  cooling_types, interior_features, exterior_features, window_features,
  laundry_features, security_features, parking_features, patio_porch_features,
  lot_features_arr, view_types, fireplace_types, basement_types, other_structures,
  structure_types, hoa_amenities, community_features, accessibility_features,
  waterfront_types, utilities, sewer_types, water_source, road_surface, roof_types,
  construction_materials_arr, foundation_types, architectural_styles,
  listing_terms, special_conditions, current_use, irrigation_source, common_walls,
  road_frontage, pool_features, direction_faces
) on public.listing_search_mv to anon, authenticated;

-- ── listing_boundary_xref_mv ────────────────────────────────────────────────
-- Read by listings_in_boundary + community_subdivisions (SECURITY DEFINER) and
-- by search_listings_advanced (SECURITY INVOKER — needs anon access). Keeping
-- the canonical name as a filtered view preserves all three.
alter materialized view public.listing_boundary_xref_mv rename to listing_boundary_xref_mv_src;
create view public.listing_boundary_xref_mv with (security_barrier = true) as
  select * from public.listing_boundary_xref_mv_src
  where coalesce(standard_status, '') not ilike '%coming%soon%';
revoke all on public.listing_boundary_xref_mv_src from anon, authenticated;
grant select on public.listing_boundary_xref_mv_src to service_role;
grant select on public.listing_boundary_xref_mv to anon, authenticated, service_role;

-- ── similar_listings_mv ─────────────────────────────────────────────────────
-- No status column, but 582 pairs recommended a Coming Soon listing and 598 were
-- anchored on one. Filter both sides through the now-locked listing_tile_mv.
-- Callers always filter by anchor_key (indexed), so EXISTS runs on ~10 rows.
alter materialized view public.similar_listings_mv rename to similar_listings_mv_src;
create view public.similar_listings_mv with (security_barrier = true) as
  select s.* from public.similar_listings_mv_src s
  where exists (select 1 from public.listing_tile_mv a where a.listing_key = s.anchor_key)
    and exists (select 1 from public.listing_tile_mv b where b.listing_key = s.similar_key);
revoke all on public.similar_listings_mv_src from anon, authenticated;
grant select on public.similar_listings_mv_src to service_role;
grant select on public.similar_listings_mv to anon, authenticated, service_role;

-- ── Dead objects, no application reader, both leaking to anon ───────────────
revoke all on public.listing_detail_mv from anon, authenticated;
revoke all on public.beacon_comparable_listings_v from anon, authenticated;

-- ── Refresh functions repointed at the _src objects ─────────────────────────
-- Bodies are otherwise unchanged (advisory locks + 900s timeouts preserved).
create or replace function public.refresh_listing_tile_mv()
 returns json language plpgsql security definer
 set search_path to 'public' set statement_timeout to '900s'
as $function$
DECLARE t_start timestamptz := clock_timestamp(); duration_ms integer; got_lock boolean;
BEGIN
  got_lock := pg_try_advisory_lock(7101);
  IF NOT got_lock THEN
    RETURN json_build_object('ok', true, 'skipped', true, 'reason', 'refresh_listing_tile_mv already running');
  END IF;
  BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY public.listing_tile_mv_src;
    duration_ms := EXTRACT(MILLISECOND FROM (clock_timestamp() - t_start))::integer;
    PERFORM pg_advisory_unlock(7101);
    RETURN json_build_object('ok', true, 'duration_ms', duration_ms);
  EXCEPTION WHEN OTHERS THEN
    PERFORM pg_advisory_unlock(7101);
    RETURN json_build_object('ok', false, 'error', SQLERRM);
  END;
END;
$function$;

create or replace function public.refresh_listing_search_mv()
 returns json language plpgsql security definer
 set search_path to 'public' set statement_timeout to '900s'
as $function$
DECLARE t_start timestamptz := clock_timestamp(); duration_ms integer; got_lock boolean;
BEGIN
  got_lock := pg_try_advisory_lock(7106);
  IF NOT got_lock THEN
    RETURN json_build_object('ok', true, 'skipped', true, 'reason', 'refresh_listing_search_mv already running');
  END IF;
  BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY public.listing_search_mv_src;
    duration_ms := EXTRACT(MILLISECOND FROM (clock_timestamp() - t_start))::integer;
    PERFORM pg_advisory_unlock(7106);
    RETURN json_build_object('ok', true, 'duration_ms', duration_ms);
  EXCEPTION WHEN OTHERS THEN
    PERFORM pg_advisory_unlock(7106);
    RETURN json_build_object('ok', false, 'error', SQLERRM);
  END;
END;
$function$;

create or replace function public.refresh_listing_boundary_xref_mv()
 returns json language plpgsql security definer
 set search_path to 'public' set statement_timeout to '900s'
as $function$
declare t_start timestamptz := clock_timestamp(); duration_ms integer;
begin
  refresh materialized view concurrently public.listing_boundary_xref_mv_src;
  duration_ms := extract(millisecond from (clock_timestamp() - t_start))::integer;
  return json_build_object('ok', true, 'duration_ms', duration_ms);
exception when others then
  return json_build_object('ok', false, 'error', sqlerrm);
end;
$function$;

create or replace function public.refresh_similar_listings_mv()
 returns json language plpgsql security definer
 set search_path to 'public' set statement_timeout to '300s'
as $function$
declare t_start timestamptz := clock_timestamp(); duration_ms integer;
begin
  refresh materialized view concurrently public.similar_listings_mv_src;
  duration_ms := extract(millisecond from (clock_timestamp() - t_start))::integer;
  return json_build_object('ok', true, 'duration_ms', duration_ms);
exception when others then
  return json_build_object('ok', false, 'error', sqlerrm);
end;
$function$;
