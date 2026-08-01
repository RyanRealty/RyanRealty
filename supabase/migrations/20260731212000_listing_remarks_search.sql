-- audit: migration — sibling remarks projection so search_listings_advanced's
-- p_keywords predicate stops detoasting listings.details (marker required by the
-- DAL-bypass guard).
--
-- listing_remarks_search — the keyword half of the TOAST fix.
--
-- p_keywords is the same defect class as the six feature flags:
--   l.details->>'PublicRemarks' ILIKE '%' || p_keywords || '%'
-- detoasts the whole ~10 KB details document per candidate row. Measured live
-- 2026-07-31: 4.9 ms/row on a PK-ordered pass, and the closed+Bend candidate set
-- is 96,673 rows.
--
-- WHY A SIBLING TABLE AND NOT A COLUMN ON listing_feature_flags. The flags table
-- is six fixed-width columns; a row is ~40 bytes and the whole relation stays
-- resident. PublicRemarks is variable-length text. Putting it beside the booleans
-- would multiply that table's width by roughly an order of magnitude and make
-- every feature-flag probe read a page that is mostly remarks it does not want.
-- Keyed identically on listings' PRIMARY KEY, so the two are joinable and both
-- ride the same cascade.
--
-- STILL VASTLY CHEAPER THAN details EVEN WITHOUT AN INDEX. PublicRemarks is a
-- short field (measured heap 273 MB against a ~13 GB TOAST relation), so an ILIKE
-- scan over this table is a different order of magnitude from detoasting details
-- even before any index is considered.
--
-- THE pg_trgm GIN INDEX IS KEPT, on measurement, not on principle. A/B on the same
-- shape (Bend + closed + keywords 'granite', 60,094 matching rows), read off
-- EXPLAIN (ANALYZE, BUFFERS) so the number is not a load artefact:
--   without it  Parallel Seq Scan + ILIKE filter   4,021 ms, 34,995 blocks
--   with it     Bitmap Index Scan + heap recheck   1,037 ms, 27,952 blocks
--               (the index probe itself is 262 ms)
-- i.e. it cuts the keyword predicate's own evaluation by 74%. Build cost was
-- ~3.5 min under load; size 243 MB. Ongoing cost is GIN maintenance, and only on
-- writes where PublicRemarks actually CHANGES — the trigger's
-- `WHERE r.public_remarks IS DISTINCT FROM EXCLUDED.public_remarks` skips the rest.
--
-- WHAT THE INDEX DOES NOT FIX, stated plainly: keywords combined with another
-- filter on a large closed scope still measures anywhere from 1.7 s to 20 s. The
-- remaining cost is not the scan, it is the JOIN — 60,094 keyword matches against
-- the 96,683-row Bend/closed candidate set, where the planner picks a nested loop
-- of 60K index probes into listings (25 s of the 26 s total in one plan). That is
-- a join-order problem, not a TOAST problem, and it is left open rather than
-- papered over. Keyword-ONLY searches never reach here: app/actions/listings.ts
-- routes them to search_keyword_listings and its partial GIN full-text index.
--
-- EXPRESSION LIFTED VERBATIM. The stored value is exactly `details->>'PublicRemarks'`,
-- the same expression the RPC evaluates today, including its NULL behaviour: the
-- RPC's guard is `l.details->>'PublicRemarks' IS NOT NULL AND ... ILIKE ...`, so a
-- NULL remarks value excludes the row, and a NULL here does the same.
--
-- ONE DETOAST FOR BOTH PROJECTIONS. listing_feature_flags_of() grows a
-- public_remarks field rather than gaining a second helper function, so the
-- trigger and the backfill each read the details document ONCE and populate both
-- tables from that single read. Two helpers would mean two detoasts of a 10 KB
-- value on every write to a table that takes ~1.55M of them.

-- The composite grows one field. Dropped and recreated rather than ALTER TYPE …
-- ADD ATTRIBUTE because the helper function returns it; both are recreated in the
-- same transaction, so no writer ever sees the type missing.
DROP FUNCTION IF EXISTS public.listing_feature_flags_of(jsonb);
DROP TYPE IF EXISTS public.listing_feature_flag_values;

CREATE TYPE public.listing_feature_flag_values AS (
  view_yn boolean,
  pool_yn boolean,
  waterfront_yn boolean,
  fireplace_yn boolean,
  has_open_house boolean,
  property_sub_type_lower text,
  public_remarks text
);

-- Each expression is copied byte-for-byte out of the live search_listings_advanced
-- body, with `l.details` rewritten to the parameter name and the outer
-- `p_has_x IS NULL OR NOT p_has_x` param gate dropped — that gate stays in the RPC,
-- because it decides WHETHER to apply the predicate, not what it means.
--
-- Returns a composite so callers evaluate it ONCE per row. Never call it as
-- `(listing_feature_flags_of(details)).*` — that syntax re-evaluates the function
-- per field, which is seven detoasts of a 10 KB document. Use
-- `FROM ... , LATERAL public.listing_feature_flags_of(details) f` instead.
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
    -- p_keywords
    p_details->>'PublicRemarks'
  )::public.listing_feature_flag_values
$function$;

COMMENT ON FUNCTION public.listing_feature_flags_of(jsonb) IS
  'Single definition of the seven listings.details predicates search_listings_advanced applies (six feature flags + PublicRemarks). Trigger and backfill both call it so they cannot drift, and each call detoasts the document once. Call via LATERAL, never (f(x)).*';

CREATE TABLE IF NOT EXISTS public.listing_remarks_search (
  list_number text PRIMARY KEY
    REFERENCES public.listings("ListNumber") ON UPDATE CASCADE ON DELETE CASCADE,
  public_remarks text
);

COMMENT ON TABLE public.listing_remarks_search IS
  'Narrow trigger-maintained projection of listings.details->>''PublicRemarks'', so search_listings_advanced''s p_keywords ILIKE never detoasts the ~10 KB details document. Written only by trg_listing_feature_flags_* on public.listings.';

-- Substring search index for p_keywords. Built after the backfill, not before —
-- building it on an empty table would have made every one of the 594K backfill
-- inserts pay GIN maintenance.
CREATE INDEX IF NOT EXISTS listing_remarks_search_trgm_idx
  ON public.listing_remarks_search USING gin (public_remarks gin_trgm_ops);

ALTER TABLE public.listing_remarks_search ENABLE ROW LEVEL SECURITY;

-- Same reasoning as listing_feature_flags: the RPC is SECURITY INVOKER, so the
-- calling role reads this table directly. PublicRemarks is the broker-written
-- public description — it is already served verbatim on every listing page and in
-- the RPC's own `details` output column. Nothing here is non-public.
DROP POLICY IF EXISTS "Public read listing remarks search" ON public.listing_remarks_search;
CREATE POLICY "Public read listing remarks search"
  ON public.listing_remarks_search FOR SELECT TO anon, authenticated USING (true);

REVOKE ALL ON public.listing_remarks_search FROM anon, authenticated;
GRANT SELECT ON public.listing_remarks_search TO anon, authenticated, service_role;
GRANT INSERT, UPDATE, DELETE ON public.listing_remarks_search TO service_role;

-- The trigger now maintains BOTH projections from a single helper call, i.e. a
-- single detoast. Everything else about it is unchanged (see 20260731210000 for
-- why it is SECURITY DEFINER and why it cannot raise).
CREATE OR REPLACE FUNCTION public.sync_listing_feature_flags()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $function$
DECLARE
  -- One call, one detoast of NEW.details, both projections. Do not expand this
  -- into per-key expressions and do not use (listing_feature_flags_of(...)).* .
  v public.listing_feature_flag_values := public.listing_feature_flags_of(NEW.details);
BEGIN
  INSERT INTO public.listing_feature_flags AS f (
    list_number, view_yn, pool_yn, waterfront_yn, fireplace_yn,
    has_open_house, property_sub_type_lower
  )
  VALUES (
    NEW."ListNumber", v.view_yn, v.pool_yn, v.waterfront_yn, v.fireplace_yn,
    v.has_open_house, v.property_sub_type_lower
  )
  ON CONFLICT (list_number) DO UPDATE SET
    view_yn = EXCLUDED.view_yn,
    pool_yn = EXCLUDED.pool_yn,
    waterfront_yn = EXCLUDED.waterfront_yn,
    fireplace_yn = EXCLUDED.fireplace_yn,
    has_open_house = EXCLUDED.has_open_house,
    property_sub_type_lower = EXCLUDED.property_sub_type_lower
  -- Skip the heap write (and the index churn) when nothing actually moved.
  WHERE (f.view_yn, f.pool_yn, f.waterfront_yn, f.fireplace_yn,
         f.has_open_house, f.property_sub_type_lower)
     IS DISTINCT FROM
        (EXCLUDED.view_yn, EXCLUDED.pool_yn, EXCLUDED.waterfront_yn,
         EXCLUDED.fireplace_yn, EXCLUDED.has_open_house,
         EXCLUDED.property_sub_type_lower);

  INSERT INTO public.listing_remarks_search AS r (list_number, public_remarks)
  VALUES (NEW."ListNumber", v.public_remarks)
  ON CONFLICT (list_number) DO UPDATE SET public_remarks = EXCLUDED.public_remarks
  WHERE r.public_remarks IS DISTINCT FROM EXCLUDED.public_remarks;

  RETURN NULL;
END;
$function$;

REVOKE ALL ON FUNCTION public.sync_listing_feature_flags() FROM PUBLIC, anon, authenticated;
