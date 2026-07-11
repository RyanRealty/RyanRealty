-- 20260711160000_listing_search_mv.sql
--
-- Search field exposure (contract 2026-07-11): every consumer-filterable DB
-- field — feature arrays, schools, HOA, taxes, terms, utilities — behind ONE
-- on-market materialized view so voice + screen search can filter on all of
-- them without touching the 593K-row listings table at request time.
--
--   * listing_search_mv = the on-market subset only (Active, Active Under
--     Contract, Coming Soon, Pending + the IDX compliance gates). ~9.8K rows,
--     so every predicate combination seq-scans in milliseconds — no GINs.
--   * Carries EVERY listing_tile_mv column (same names, same expressions,
--     copied from 20260708150000_listing_tile_mv_street_suffix.sql) so tile
--     consumers can read search results without a second lookup, PLUS the
--     filter columns from the contract's MV table.
--   * rr_feature_keys() flattens RESO feature jsonb objects ({"Deck": true,
--     "Patio": true}) into text[] for @> / && predicates. Sentinel-guarded:
--     this feed masks some values with '********' privacy-sentinel strings,
--     so any non-object input returns NULL instead of erroring.
--
-- Refresh: refresh_listing_search_mv() (advisory lock 7106, CONCURRENTLY),
-- wired into /api/cron/refresh-mvs — every 15 minutes via vercel.json,
-- after the tile + geo_snapshot + boundary-xref refreshes.
--
-- Closed/sold searches keep today's legacy paths untouched — this MV serves
-- on-market scopes only.
--
-- PROD APPLY NOTE (2026-07-11): NOT yet applied to hosted dwvlophlbvvygjfxcrhm.
-- New MV with no consumers yet, so no zero-downtime dance is needed — apply
-- this file as-is (the WITH DATA build scans listings once with the status
-- filter; expect a few seconds).

-- ── Helper: RESO feature object → text[] of true keys ───────────────────────
-- IMMUTABLE so it is usable in the MV definition. Returns NULL for NULL,
-- missing, or sentinel-masked (non-object) input; an object with no true
-- keys also yields NULL (array_agg over zero rows), which @> / && treat as
-- no match — exactly right for filtering.
CREATE OR REPLACE FUNCTION public.rr_feature_keys(j jsonb)
RETURNS text[]
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN j IS NULL OR jsonb_typeof(j) <> 'object' THEN NULL
    ELSE (
      SELECT array_agg(e.key ORDER BY e.key)
      FROM jsonb_each(j) AS e(key, value)
      WHERE e.value = to_jsonb(true)
    )
  END
$$;

-- ── The MV ───────────────────────────────────────────────────────────────────
DROP MATERIALIZED VIEW IF EXISTS public.listing_search_mv;

CREATE MATERIALIZED VIEW public.listing_search_mv AS
SELECT
  -- Tile columns — verbatim from listing_tile_mv (20260708150000).
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
  -- Suffix (Loop/Rd/Ct) lives only in the raw feed payload — without it no
  -- card address matches Zillow/county records (design-audit P1, trust).
  nullif(btrim(l.details->>'StreetSuffix'), '')        AS street_suffix,
  l."City"                                             AS city,
  lower(trim(l."City"))                                AS city_lower,
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
  lower(regexp_replace(
    concat_ws('-', l."StreetNumber", regexp_replace(coalesce(l."StreetName", ''), '\s+', '-', 'g')),
    '[^a-z0-9-]', '', 'g'
  ))                                                   AS address_slug,
  l.boundary_city                                      AS boundary_city,
  l.boundary_neighborhood                              AS boundary_neighborhood,
  l.boundary_subdivision                               AS boundary_subdivision,
  (
    setweight(to_tsvector('english', coalesce(l."StreetNumber", '')), 'A') ||
    setweight(to_tsvector('english', coalesce(l."StreetName", '')), 'A') ||
    setweight(to_tsvector('english', coalesce(l."City", '')), 'B') ||
    setweight(to_tsvector('english', coalesce(l."SubdivisionName", '')), 'B') ||
    setweight(to_tsvector('english', coalesce(l."PostalCode", '')), 'C')
  )                                                    AS search_vector,
  now()                                                AS refreshed_at,
  -- Filter columns — promoted booleans / numerics / text.
  l.fireplace_yn                                       AS fireplace_yn,
  l.waterfront_yn                                      AS waterfront_yn,
  l.basement_yn                                        AS basement_yn,
  l.horse_yn                                           AS horse_yn,
  l.senior_community_yn                                AS senior_community_yn,
  l.new_construction_yn                                AS new_construction_yn,
  l.association_yn                                     AS association_yn,
  l.hoa_monthly                                        AS hoa_monthly,
  l.tax_annual_amount                                  AS tax_annual_amount,
  l.estimated_monthly_piti                             AS estimated_monthly_piti,
  l.irrigation_water_rights_yn                         AS irrigation_water_rights_yn,
  l.county                                             AS county,
  l.elementary_school                                  AS elementary_school,
  l.middle_school                                      AS middle_school,
  l.high_school                                        AS high_school,
  l.school_district                                    AS school_district,
  l.levels                                             AS levels,
  l.baths_full                                         AS baths_full,
  l.baths_half                                         AS baths_half,
  l.public_remarks                                     AS public_remarks,
  (jsonb_array_length(COALESCE(l."OpenHouses", '[]'::jsonb)) > 0) AS has_open_house,
  (COALESCE(l.price_drop_count, 0) > 0)                AS price_reduced,
  -- Filter columns — RESO feature arrays (jsonb key names verbatim from feed).
  public.rr_feature_keys(l.details->'KitchenAppliances')      AS appliances,
  public.rr_feature_keys(l.details->'Flooring')               AS flooring,
  public.rr_feature_keys(l.details->'Heating')                AS heating_types,
  public.rr_feature_keys(l.details->'Cooling')                AS cooling_types,
  public.rr_feature_keys(l.details->'InteriorFeatures')       AS interior_features,
  public.rr_feature_keys(l.details->'ExteriorFeatures')       AS exterior_features,
  public.rr_feature_keys(l.details->'WindowFeatures')         AS window_features,
  public.rr_feature_keys(l.details->'LaundryFeatures')        AS laundry_features,
  public.rr_feature_keys(l.details->'SecurityFeatures')       AS security_features,
  public.rr_feature_keys(l.details->'ParkingFeatures')        AS parking_features,
  public.rr_feature_keys(l.details->'PatioAndPorchFeatures')  AS patio_porch_features,
  public.rr_feature_keys(l.details->'LotFeatures')            AS lot_features_arr,
  public.rr_feature_keys(l.details->'View')                   AS view_types,
  public.rr_feature_keys(l.details->'FireplaceFeatures')      AS fireplace_types,
  public.rr_feature_keys(l.details->'Basement')               AS basement_types,
  public.rr_feature_keys(l.details->'OtherStructures')        AS other_structures,
  public.rr_feature_keys(l.details->'StructureType')          AS structure_types,
  public.rr_feature_keys(l.details->'AssociationAmenities')   AS hoa_amenities,
  public.rr_feature_keys(l.details->'CommunityFeatures')      AS community_features,
  public.rr_feature_keys(l.details->'AccessibilityFeatures')  AS accessibility_features,
  public.rr_feature_keys(l.details->'WaterfrontFeatures')     AS waterfront_types,
  public.rr_feature_keys(l.details->'Utilities')              AS utilities,
  public.rr_feature_keys(l.details->'Sewer')                  AS sewer_types,
  public.rr_feature_keys(l.details->'WaterSource')            AS water_source,
  public.rr_feature_keys(l.details->'RoadSurfaceType')        AS road_surface,
  public.rr_feature_keys(l.details->'Roof')                   AS roof_types,
  public.rr_feature_keys(l.details->'ConstructionMaterials')  AS construction_materials_arr,
  public.rr_feature_keys(l.details->'FoundationDetails')      AS foundation_types,
  public.rr_feature_keys(l.details->'ArchitecturalStyle')     AS architectural_styles,
  public.rr_feature_keys(l.details->'ListingTerms')           AS listing_terms,
  public.rr_feature_keys(l.details->'SpecialListingConditions') AS special_conditions,
  public.rr_feature_keys(l.details->'CurrentUse')             AS current_use,
  public.rr_feature_keys(l.details->'IrrigationSource')       AS irrigation_source,
  public.rr_feature_keys(l.details->'CommonWalls')            AS common_walls,
  public.rr_feature_keys(l.details->'RoadFrontageType')       AS road_frontage,
  public.rr_feature_keys(l.details->'PoolFeatures')           AS pool_features,
  nullif(btrim(l.details->>'DirectionFaces'), '')             AS direction_faces
FROM public.listings l
WHERE l."StandardStatus" = ANY (ARRAY['Active', 'Active Under Contract', 'Coming Soon', 'Pending'])
  AND l.permit_internet_yn IS DISTINCT FROM false   -- seller internet opt-out (ODS B/G)
  AND l.idx_participant     IS DISTINCT FROM false   -- listing broker not in IDX
WITH DATA;

-- Unique index → enables REFRESH MATERIALIZED VIEW CONCURRENTLY.
CREATE UNIQUE INDEX IF NOT EXISTS listing_search_mv_key
  ON public.listing_search_mv (listing_key);
CREATE INDEX IF NOT EXISTS listing_search_mv_city_lower
  ON public.listing_search_mv (city_lower);
CREATE INDEX IF NOT EXISTS listing_search_mv_latlng
  ON public.listing_search_mv (lat, lng);

-- listing_tile_mv relies on the project's default privileges for this same
-- ACL; stated explicitly here so the search path never depends on defaults.
GRANT SELECT ON public.listing_search_mv TO anon, authenticated, service_role;

-- ── Refresh RPC ──────────────────────────────────────────────────────────────
-- Advisory-lock pattern from 20260526140409_mv_refresh_advisory_lock.sql so
-- overlapping cron runs no-op instead of piling up. Lock IDs: 7101 tile,
-- 7102 geo_snapshot, 7103 market_pulse, 7104 listing_detail (hosted-only
-- function, verified live 2026-07-11 — it DOES take 7104, so this MV uses
-- the next free id), 7105 similar_listings, 7106 THIS.
CREATE OR REPLACE FUNCTION public.refresh_listing_search_mv()
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
 SET statement_timeout TO '120s'
AS $function$
DECLARE
  t_start timestamptz := clock_timestamp();
  duration_ms integer;
  got_lock boolean;
BEGIN
  got_lock := pg_try_advisory_lock(7106);
  IF NOT got_lock THEN
    RETURN json_build_object('ok', true, 'skipped', true, 'reason', 'refresh_listing_search_mv already running');
  END IF;

  BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY public.listing_search_mv;
    duration_ms := EXTRACT(MILLISECOND FROM (clock_timestamp() - t_start))::integer;
    PERFORM pg_advisory_unlock(7106);
    RETURN json_build_object('ok', true, 'duration_ms', duration_ms);
  EXCEPTION
    WHEN OTHERS THEN
      PERFORM pg_advisory_unlock(7106);
      RETURN json_build_object('ok', false, 'error', SQLERRM);
  END;
END;
$function$;

-- Cron (service-role client) + signed-in server code only — public users
-- must never trigger an MV refresh.
REVOKE EXECUTE ON FUNCTION public.refresh_listing_search_mv() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.refresh_listing_search_mv() TO service_role, authenticated;

-- Verification:
--
-- SELECT public.rr_feature_keys('{"Deck": true, "Patio": false}'::jsonb);
-- (should return {Deck})
-- SELECT public.rr_feature_keys('"********"'::jsonb);
-- (should return NULL)
-- SELECT count(*) FROM public.listing_search_mv;
-- (should return ~9,770 rows as of 2026-07-11)
-- SELECT public.refresh_listing_search_mv();
-- (should return {"ok": true, "duration_ms": <integer>})
