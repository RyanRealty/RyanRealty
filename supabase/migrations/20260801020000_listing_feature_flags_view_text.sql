-- audit: migration — extend the listing_feature_flags projection with view_text so
-- search_listings_advanced's p_view_contains predicate stops detoasting
-- listings.details (marker required by the DAL-bypass guard).
--
-- DEFECT. p_view_contains is the LAST predicate in the RPC still reading
-- listings.details:
--   l.details->>'View' IS NOT NULL AND l.details->>'View' ILIKE '%'||p_view_contains||'%'
-- Postgres cannot read one key out of a TOASTed jsonb, so this detoasts the whole
-- ~10 KB document per candidate row. The five SEO preset pages
-- (/homes-for-sale/mountain-view, water-view, river-view, golf-course-view,
-- lake-view) set exactly this filter and set NO city, so there is no cheap
-- narrowing predicate in front of it and the candidate set is the whole table.
-- They render an empty grid.
--
-- MEASURED AFTER the SECURITY DEFINER fix (20260801010000), as anon:
--   search_listings_advanced(p_view_contains=>'Mountain', p_status_filter=>'active')
--     -> 57014, statement timeout, zero rows.
-- The DEFINER fix was necessary and did fix every city-scoped shape, but it
-- cannot help here: the cost is a TOAST read, not a barred index.
--
-- THE FIX. Same pattern as the six feature flags in 20260731210000 — project the
-- expression into the narrow side table and read it from there. `View` averages
-- 33 characters and peaks at 223 (measured against the flat view_description
-- column as a proxy over 594,196 rows), so unlike PublicRemarks it does NOT
-- warrant a sibling table: it goes on listing_feature_flags itself and the
-- relation stays resident.
--
-- WHY NOT listings.view_description, WHICH ALREADY EXISTS. Same reason
-- 20260731210000 refused pool_yn/fireplace_yn: the flat promoted columns DISAGREE
-- materially with the jsonb the RPC actually reads, so swapping to them would
-- silently change what users see. view_text is `details->>'View'` verbatim.
--
-- NULL vs EMPTY IS LOAD-BEARING. view_text stores details->>'View' EXACTLY: NULL
-- when the key is absent, '' when the key is present and empty. The RPC's
-- predicate is `<x> IS NOT NULL AND <x> ILIKE ...`, and `'' ILIKE '%%'` is TRUE,
-- so collapsing '' to NULL would change the answer for a caller passing
-- viewContains='%'. It is a reachable input (viewContains is a free-text search
-- param, lib/search-filters.ts), so the distinction is preserved.
--
-- WHY THE WHOLE TABLE MUST BE BACKFILLED. It is tempting to backfill only rows
-- with view_yn = true, since {View non-empty} is provably a subset of
-- {view_yn true}. That holds, but it does not cover View = '' (which sets
-- view_yn false via the ViewYN arm yet still matches ILIKE '%%'). The backfill in
-- the next migration therefore covers every row, and the RPC does NOT switch to
-- this column until it reports done — a partially-populated column would return
-- silently-wrong results, which is worse than the slow query it replaces.
--
-- ONE DEFINITION, NO DRIFT. listing_feature_flags_of() stays the single home of
-- every projected expression; the trigger and the backfill both call it.

-- ── The value tuple gains an eighth field ───────────────────────────────────
-- Safe: the composite is not used as a column type by any relation (checked), so
-- this is a catalog-only change with no table rewrite.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_attribute a
    WHERE a.attrelid = 'public.listing_feature_flag_values'::regtype::oid
      AND a.attname = 'view_text' AND NOT a.attisdropped
  ) THEN
    ALTER TYPE public.listing_feature_flag_values ADD ATTRIBUTE view_text text;
  END IF;
END
$$;

-- ── The single definition of every projected expression ─────────────────────
-- Unchanged except for the new final field, which is `l.details->>'View'` lifted
-- verbatim out of the live search_listings_advanced body.
CREATE OR REPLACE FUNCTION public.listing_feature_flags_of(p_details jsonb)
RETURNS public.listing_feature_flag_values
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $function$
  SELECT ROW(
    -- p_has_view
    COALESCE(
      (p_details->>'ViewYN' IS NOT NULL AND (p_details->>'ViewYN')::text ILIKE 'true%')
      OR (p_details->>'View' IS NOT NULL AND p_details->>'View' != ''),
      false),
    -- p_has_pool
    COALESCE(
      (p_details->>'PoolYN' IS NOT NULL AND (p_details->>'PoolYN')::text ILIKE 'true%')
      OR (p_details->>'PoolFeatures' IS NOT NULL AND p_details->>'PoolFeatures' != ''),
      false),
    -- p_has_waterfront
    COALESCE(
      (p_details->>'WaterfrontYN' IS NOT NULL AND (p_details->>'WaterfrontYN')::text ILIKE 'true%')
      OR (p_details->>'WaterfrontFeatures' IS NOT NULL AND p_details->>'WaterfrontFeatures' != ''),
      false),
    -- p_has_fireplace
    COALESCE(
      (p_details->>'FireplaceYN' IS NOT NULL AND (p_details->>'FireplaceYN')::text ILIKE 'true%')
      OR (p_details->>'FireplaceFeatures' IS NOT NULL AND p_details->>'FireplaceFeatures' != ''),
      false),
    -- p_has_open_house
    COALESCE(
      jsonb_typeof(p_details->'OpenHouses') = 'array'
      AND jsonb_array_length(p_details->'OpenHouses') > 0,
      false),
    -- p_property_subtype (v_subtypes is matched as a case-insensitive exact set)
    lower(p_details->>'PropertySubType'),
    -- p_keywords (projected into listing_remarks_search, not into this table)
    p_details->>'PublicRemarks',
    -- p_view_contains — NULL/'' distinction preserved deliberately, see header
    p_details->>'View'
  )::public.listing_feature_flag_values
$function$;

COMMENT ON FUNCTION public.listing_feature_flags_of(jsonb) IS
  'Single definition of every listings.details expression the search RPC projects. Trigger and backfill both call it so they cannot drift. Call via LATERAL, never (f(x)).*';

-- ── The column ──────────────────────────────────────────────────────────────
ALTER TABLE public.listing_feature_flags ADD COLUMN IF NOT EXISTS view_text text;

COMMENT ON COLUMN public.listing_feature_flags.view_text IS
  'listings.details->>''View'' verbatim, NULL/empty distinction preserved. Feeds search_listings_advanced''s p_view_contains so it never detoasts details. NOT interchangeable with listings.view_description, which disagrees with the jsonb.';

-- ── The trigger learns the new field ────────────────────────────────────────
-- Byte-identical to 20260731210000 apart from view_text. Still SECURITY DEFINER
-- (anon holds write privileges on public.listings, so an invoker trigger would
-- fail the parent write), still no BEGIN/EXCEPTION wrapper (it cannot raise, and
-- a subtransaction on every one of ~1.55M writes is a real cost for nothing),
-- still one call so NEW.details is detoasted exactly once.
CREATE OR REPLACE FUNCTION public.sync_listing_feature_flags()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $function$
DECLARE
  v public.listing_feature_flag_values := public.listing_feature_flags_of(NEW.details);
BEGIN
  INSERT INTO public.listing_feature_flags AS f (
    list_number, view_yn, pool_yn, waterfront_yn, fireplace_yn,
    has_open_house, property_sub_type_lower, view_text
  )
  VALUES (
    NEW."ListNumber", v.view_yn, v.pool_yn, v.waterfront_yn, v.fireplace_yn,
    v.has_open_house, v.property_sub_type_lower, v.view_text
  )
  ON CONFLICT (list_number) DO UPDATE SET
    view_yn = EXCLUDED.view_yn,
    pool_yn = EXCLUDED.pool_yn,
    waterfront_yn = EXCLUDED.waterfront_yn,
    fireplace_yn = EXCLUDED.fireplace_yn,
    has_open_house = EXCLUDED.has_open_house,
    property_sub_type_lower = EXCLUDED.property_sub_type_lower,
    view_text = EXCLUDED.view_text
  WHERE (f.view_yn, f.pool_yn, f.waterfront_yn, f.fireplace_yn,
         f.has_open_house, f.property_sub_type_lower, f.view_text)
     IS DISTINCT FROM
        (EXCLUDED.view_yn, EXCLUDED.pool_yn, EXCLUDED.waterfront_yn,
         EXCLUDED.fireplace_yn, EXCLUDED.has_open_house,
         EXCLUDED.property_sub_type_lower, EXCLUDED.view_text);
  RETURN NULL;
END;
$function$;

REVOKE ALL ON FUNCTION public.sync_listing_feature_flags() FROM PUBLIC, anon, authenticated;
