-- audit: migration — narrow trigger-maintained feature-flag projection that lets
-- search_listings_advanced stop detoasting listings.details in its WHERE clause.
--
-- listing_feature_flags — the fix for ROOT CAUSE #2 named in 20260731190000.
--
-- DEFECT. search_listings_advanced expresses six feature predicates as reads of
-- listings.details (jsonb, avg ~10 KB, 1,297 MB heap + a ~13 GB TOAST relation,
-- against shared_buffers=1GB). Postgres cannot read one key out of a TOASTed
-- jsonb, so `details->>'ViewYN'` detoasts the WHOLE document for every candidate
-- row. Measured live 2026-07-31: 8.2 ms/row, ~15.8 buffers/row. The closed+Bend
-- candidate set is 96,673 rows, i.e. ~13 minutes for one page of 12. count(*)
-- OVER () is the pagination contract, so LIMIT cannot short-circuit the scan.
-- The deferred-join rewrite (20260731190000) cut sorting cost 48% but could not
-- touch this: the detoast happens in the WHERE clause, before the sort exists.
--
-- THE FIX. Project exactly those six predicates into a narrow side table. Six
-- small columns over 594K rows is a few tens of MB — no TOAST, fully cacheable,
-- and index-cheap. The RPC then evaluates the feature filters against this table
-- and never touches details for them.
--
-- WHY NOT THE EXISTING TYPED COLUMNS. listings already has pool_yn, fireplace_yn
-- and view_description. They DISAGREE materially with the jsonb the RPC reads
-- today (closed Bend: jsonb pool 15,763 vs typed pool_yn 167; jsonb fireplace
-- 74,148 vs typed 58,828). Swapping to them would silently change what users see.
-- Every flag below is the RPC's CURRENT boolean expression, lifted verbatim.
--
-- ONE DEFINITION, NO DRIFT. listing_feature_flags_of() is the single home of
-- those expressions. The trigger and the backfill both call it, so they cannot
-- diverge from each other, and a future change to a flag is one edit.
--
-- NULL SEMANTICS. Four of the five booleans can never evaluate to NULL: each is
-- `(details->>'X' IS NOT NULL AND ...) OR (details->>'Y' IS NOT NULL AND ...)`,
-- which is strictly false when details is NULL or the key is absent.
-- has_open_house is the exception: `jsonb_typeof(details->'OpenHouses')` is NULL
-- whenever the key is absent, so the expression yields NULL for most rows. The
-- RPC uses it as `p IS NULL OR NOT p OR (<expr>)`, where a NULL third disjunct
-- excludes the row exactly as false would. COALESCE(...,false) is therefore
-- filter-equivalent, and is what we store so the column can be NOT NULL and
-- partially indexed.
--
-- KEY COLUMN. listings' PRIMARY KEY is "ListNumber" (listings_pkey), NOT
-- "ListingKey" (which is a separate, also-unique column). This table keys on
-- "ListNumber" so the FK can cascade and so the probe rides the primary key —
-- the same key the deferred join in 20260731190000 already uses. The column is
-- named list_number rather than listing_key precisely because listing_key would
-- read as the other column.
--
-- RLS. SELECT is granted to anon because search_listings_advanced is SECURITY
-- INVOKER — the RPC reads this table as the calling role. The table carries no
-- status, address, price, agent or remark data: a row is an opaque MLS number
-- plus five amenity booleans and a sub-type label. The coming-soon exclusion
-- that listings' own policy enforces stays effective where it matters, because
-- the RPC's outer scan is over listings and is still RLS-filtered there; the
-- flags row is only ever reached as a correlated probe of an already-visible
-- listing. Mirroring the exclusion into this table's policy would require a
-- per-row join back to listings and would destroy the semi-join plan that makes
-- the fix work, in exchange for hiding five booleans behind MLS numbers an
-- attacker cannot identify (no status column exists here to identify them by).

-- ── The value tuple returned by the shared expression helper ────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public' AND t.typname = 'listing_feature_flag_values'
  ) THEN
    CREATE TYPE public.listing_feature_flag_values AS (
      view_yn boolean,
      pool_yn boolean,
      waterfront_yn boolean,
      fireplace_yn boolean,
      has_open_house boolean,
      property_sub_type_lower text
    );
  END IF;
END
$$;

-- ── The single definition of every flag ─────────────────────────────────────
-- Each expression below is copied byte-for-byte out of the live
-- search_listings_advanced body (pg_proc.prosrc, md5 61ad4bd5c9e7b46187bce9bee343531c),
-- with `l.details` rewritten to the parameter name and the outer
-- `p_has_x IS NULL OR NOT p_has_x OR` param gate dropped — that gate stays in the
-- RPC, because it decides WHETHER to apply the flag, not what the flag means.
--
-- Returns a composite so callers evaluate it ONCE per row. Never call it as
-- `(listing_feature_flags_of(details)).*` — that syntax re-evaluates the
-- function per field, which is six detoasts of a 10 KB document. Use
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
    lower(p_details->>'PropertySubType')
  )::public.listing_feature_flag_values
$function$;

COMMENT ON FUNCTION public.listing_feature_flags_of(jsonb) IS
  'Single definition of the six feature predicates search_listings_advanced applies. Trigger and backfill both call it so they cannot drift. Call via LATERAL, never (f(x)).*';

-- ── The projection ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.listing_feature_flags (
  list_number text PRIMARY KEY
    REFERENCES public.listings("ListNumber") ON UPDATE CASCADE ON DELETE CASCADE,
  view_yn boolean NOT NULL,
  pool_yn boolean NOT NULL,
  waterfront_yn boolean NOT NULL,
  fireplace_yn boolean NOT NULL,
  has_open_house boolean NOT NULL,
  property_sub_type_lower text
);

COMMENT ON TABLE public.listing_feature_flags IS
  'Narrow trigger-maintained projection of the six listings.details predicates used by search_listings_advanced. Exists so those predicates never detoast the ~10 KB details document (measured 8.2 ms/row). Written only by trg_listing_feature_flags_* on public.listings.';

-- Partial indexes on the flag, carrying the key. Under a plpgsql CUSTOM plan the
-- RPC's `p_has_view IS NULL OR NOT p_has_view OR f.view_yn` folds to `f.view_yn`,
-- which lets the planner pull the EXISTS up into a semi-join and drive it from
-- one of these index-only scans instead of probing per candidate row.
CREATE INDEX IF NOT EXISTS listing_feature_flags_view_idx
  ON public.listing_feature_flags (list_number) WHERE view_yn;
CREATE INDEX IF NOT EXISTS listing_feature_flags_pool_idx
  ON public.listing_feature_flags (list_number) WHERE pool_yn;
CREATE INDEX IF NOT EXISTS listing_feature_flags_waterfront_idx
  ON public.listing_feature_flags (list_number) WHERE waterfront_yn;
CREATE INDEX IF NOT EXISTS listing_feature_flags_fireplace_idx
  ON public.listing_feature_flags (list_number) WHERE fireplace_yn;
CREATE INDEX IF NOT EXISTS listing_feature_flags_open_house_idx
  ON public.listing_feature_flags (list_number) WHERE has_open_house;
CREATE INDEX IF NOT EXISTS listing_feature_flags_sub_type_idx
  ON public.listing_feature_flags (property_sub_type_lower, list_number)
  WHERE property_sub_type_lower IS NOT NULL;

ALTER TABLE public.listing_feature_flags ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read listing feature flags" ON public.listing_feature_flags;
CREATE POLICY "Public read listing feature flags"
  ON public.listing_feature_flags FOR SELECT TO anon, authenticated USING (true);

REVOKE ALL ON public.listing_feature_flags FROM anon, authenticated;
GRANT SELECT ON public.listing_feature_flags TO anon, authenticated, service_role;
GRANT INSERT, UPDATE, DELETE ON public.listing_feature_flags TO service_role;

-- ── The trigger ─────────────────────────────────────────────────────────────
-- SECURITY DEFINER on purpose. anon holds write privileges on public.listings
-- (relacl arwdDxtm), so a SECURITY INVOKER trigger would raise "permission
-- denied for table listing_feature_flags" and FAIL the parent write. Running as
-- the owner makes the projection maintainable from any writer. EXECUTE is
-- revoked below so the function is not independently callable; a trigger fires
-- regardless, because EXECUTE is checked at CREATE TRIGGER time, not at fire time.
--
-- THIS FUNCTION CANNOT RAISE, by construction rather than by catching:
--   * it runs AFTER the row is in place, so the FK to listings is satisfied;
--   * every boolean comes back COALESCE'd, so NOT NULL holds;
--   * NEW."ListNumber" is the primary key of listings and cannot be NULL;
--   * ON CONFLICT covers the row already existing.
-- A BEGIN/EXCEPTION wrapper is deliberately NOT used: it would open a
-- subtransaction on every one of the ~1.55M writes this table takes, which is a
-- real cost paid to catch an error that cannot occur.
CREATE OR REPLACE FUNCTION public.sync_listing_feature_flags()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $function$
DECLARE
  -- One call, one detoast of NEW.details. Do not expand this into six
  -- expressions and do not use (listing_feature_flags_of(...)).* .
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
  RETURN NULL;
END;
$function$;

REVOKE ALL ON FUNCTION public.sync_listing_feature_flags() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_listing_feature_flags_ins ON public.listings;
CREATE TRIGGER trg_listing_feature_flags_ins
  AFTER INSERT ON public.listings
  FOR EACH ROW EXECUTE FUNCTION public.sync_listing_feature_flags();

-- The UPDATE arm is gated so it costs nothing on the many writes that leave
-- details alone. public.listings takes ~1.55M updates and the MLS delta sync
-- runs constantly; an ungated arm would recompute (and detoast) on every one.
DROP TRIGGER IF EXISTS trg_listing_feature_flags_upd ON public.listings;
CREATE TRIGGER trg_listing_feature_flags_upd
  AFTER UPDATE ON public.listings
  FOR EACH ROW
  WHEN (OLD.details IS DISTINCT FROM NEW.details)
  EXECUTE FUNCTION public.sync_listing_feature_flags();

-- DELETE is handled by the FK's ON DELETE CASCADE, and a "ListNumber" rewrite by
-- ON UPDATE CASCADE. No third trigger arm is needed or wanted.
