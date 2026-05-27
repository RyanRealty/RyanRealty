-- 20260527150000_listing_detail_mv.sql
--
-- Wave 1 Step 1.5 (per docs/EXECUTION_PLAN.md §9 + ADR_001 MV 3):
-- listing_detail_mv — wide projection of every listing for the listing
-- detail page. Replaces the 50-column raw read against `public.listings`
-- that getListingDetail.ts currently performs.
--
-- Includes everything in listing_tile_mv plus the detail-only fields
-- (original list price, school district, tax fields, HOA, agent fields,
-- public remarks, etc.). The detail page can render entirely from this
-- MV plus the existing photos / videos / similar_listings reads — no
-- multi-await chain against listings.
--
-- Refresh: hourly via `/api/cron/refresh-mvs` (CONCURRENTLY, no read
-- lock). Per-row trigger pattern from the plan is intentionally deferred
-- — the hourly cadence matches the existing tile MV and the detail page
-- accepts that lag. Per-row freshness lands in a follow-up commit if
-- staleness becomes a real complaint.
--
-- Storage estimate: ~3 GB per plan §13. WITH DATA populates on create.

BEGIN;

CREATE MATERIALIZED VIEW IF NOT EXISTS public.listing_detail_mv AS
SELECT
  -- Tile-level fields (mirror listing_tile_mv shape so the detail page
  -- can render hero/header without a second MV hit)
  l."ListingKey"                                       AS listing_key,
  l."ListNumber"                                       AS list_number,
  l."StandardStatus"                                   AS standard_status,
  l."ListPrice"                                        AS list_price,
  l."ClosePrice"                                       AS close_price,
  l."CloseDate"                                        AS close_date,
  l."BedroomsTotal"                                    AS beds,
  l."BathroomsTotal"                                   AS baths,
  l."TotalLivingAreaSqFt"                              AS sqft,
  l."StreetNumber"                                     AS street_number,
  l."StreetName"                                       AS street_name,
  l."City"                                             AS city,
  lower(trim(l."City"))                                AS city_lower,
  l."State"                                            AS state,
  l."PostalCode"                                       AS postal_code,
  l."SubdivisionName"                                  AS subdivision_name,
  lower(trim(l."SubdivisionName"))                     AS subdivision_lower,
  l."Latitude"                                         AS lat,
  l."Longitude"                                        AS lng,
  l."PhotoURL"                                         AS photo_url,
  l."PropertyType"                                     AS property_type,
  l.property_sub_type                                  AS property_sub_type,
  l."OnMarketDate"                                     AS on_market_date,
  l."ModificationTimestamp"                            AS modified_at,
  l.price_per_sqft                                     AS price_per_sqft,
  l.lot_size_acres                                     AS lot_size_acres,
  l.year_built                                         AS year_built,
  l.garage_spaces                                      AS garage_spaces,
  l.pool_yn                                            AS pool_yn,
  l.has_virtual_tour                                   AS has_virtual_tour,
  l."DaysOnMarket"                                     AS dom,
  l.price_drop_count                                   AS price_drop_count,

  -- Address slug for canonical URL resolution. Matches the
  -- `slug(streetNumber-streetName)` JS helper in lib/data/listings/
  -- getListingDetail.ts so `/homes-for-sale/<city>/.../<address>-<key>`
  -- URLs resolve via a single indexed lookup. (Same expression as the
  -- tile MV — the two stay byte-identical so a single canonical URL
  -- works for tile + detail paths.)
  lower(regexp_replace(
    concat_ws('-', l."StreetNumber", regexp_replace(coalesce(l."StreetName", ''), '\s+', '-', 'g')),
    '[^a-z0-9-]', '', 'g'
  ))                                                   AS address_slug,

  -- Boundary fields populated by tag_listing_boundaries cron — used by
  -- the detail page neighborhood-context panel.
  l.boundary_city                                      AS boundary_city,
  l.boundary_neighborhood                              AS boundary_neighborhood,
  l.boundary_subdivision                               AS boundary_subdivision,

  -- Detail-only fields below this line
  l."OriginalListPrice"                                AS original_list_price,
  l.fireplace_yn                                       AS fireplace_yn,
  l.waterfront_yn                                      AS waterfront_yn,
  l.architectural_style                                AS architectural_style,
  l.school_district                                    AS school_district,
  l.elementary_school                                  AS elementary_school,
  l.middle_school                                      AS middle_school,
  l.high_school                                        AS high_school,
  l.tax_annual_amount                                  AS tax_annual_amount,
  l.tax_assessed_value                                 AS tax_assessed_value,
  l.hoa_monthly                                        AS hoa_monthly,
  l.estimated_monthly_piti                             AS estimated_monthly_piti,
  l.listing_quality_score                              AS listing_quality_score,
  l.sale_to_list_ratio                                 AS sale_to_list_ratio,
  l.public_remarks                                     AS public_remarks,
  l."ListAgentName"                                    AS list_agent_name,
  l.list_agent_email                                   AS list_agent_email,
  l."ListOfficeName"                                   AS list_office_name,

  now()                                                AS refreshed_at
FROM public.listings l
WHERE l."ListingKey" IS NOT NULL
WITH DATA;

-- Primary lookup: single-row fetch by listing_key. The detail page's
-- hot path. UNIQUE index is also required for REFRESH CONCURRENTLY.
CREATE UNIQUE INDEX IF NOT EXISTS listing_detail_mv_key
  ON public.listing_detail_mv (listing_key);

-- Canonical URL resolution: /homes-for-sale/<city>/.../<address>-<key>
-- → listing_key. Composite index matches the (city_lower, address_slug)
-- shape callers use.
CREATE INDEX IF NOT EXISTS listing_detail_mv_city_addr
  ON public.listing_detail_mv (city_lower, address_slug);

-- Community filter — partial because a meaningful fraction of listings
-- have a null SubdivisionName.
CREATE INDEX IF NOT EXISTS listing_detail_mv_subdivision
  ON public.listing_detail_mv (subdivision_lower)
  WHERE subdivision_lower IS NOT NULL;

COMMIT;

-- Refresh function — mirrors the advisory-lock pattern in
-- 20260526140409_mv_refresh_advisory_lock.sql. Lock ID 7104 reserved
-- for listing_detail_mv (7101 tile, 7102 geo_snapshot, 7103 market_pulse).
-- Used by /api/cron/refresh-mvs (hourly at :08).
CREATE OR REPLACE FUNCTION public.refresh_listing_detail_mv()
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
 SET statement_timeout TO '300s'
AS $function$
DECLARE
  t_start timestamptz := clock_timestamp();
  duration_ms integer;
  got_lock boolean;
BEGIN
  got_lock := pg_try_advisory_lock(7104);
  IF NOT got_lock THEN
    RETURN json_build_object('ok', true, 'skipped', true, 'reason', 'refresh_listing_detail_mv already running');
  END IF;

  BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY public.listing_detail_mv;
    duration_ms := EXTRACT(MILLISECOND FROM (clock_timestamp() - t_start))::integer;
    PERFORM pg_advisory_unlock(7104);
    RETURN json_build_object('ok', true, 'duration_ms', duration_ms);
  EXCEPTION
    WHEN OTHERS THEN
      PERFORM pg_advisory_unlock(7104);
      RETURN json_build_object('ok', false, 'error', SQLERRM);
  END;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.refresh_listing_detail_mv() TO service_role;

-- Initial refresh (forces population if WITH DATA failed for any reason)
REFRESH MATERIALIZED VIEW public.listing_detail_mv;

-- Verification:
--
-- SELECT count(*) FROM public.listing_detail_mv;
-- (should equal count(*) FROM public.listings WHERE "ListingKey" IS NOT NULL)
--
-- EXPLAIN ANALYZE
-- SELECT * FROM public.listing_detail_mv WHERE listing_key = '<some-key>';
-- (should show Index Scan on listing_detail_mv_key, <5ms)
