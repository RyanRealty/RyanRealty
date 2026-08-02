-- audit: migration — project StreetSuffix into listing_feature_flags so
-- listing_tile_mv_src stops detoasting all 594,099 IDX rows every 30 minutes
-- (marker required by the DAL-bypass guard).
--
-- THE DEFECT (docs/TOAST_READ_DISCIPLINE.md, the class).
-- listing_tile_mv_src's definition carries exactly one read of listings.details:
--
--   nullif(btrim(details ->> 'StreetSuffix'), '') as street_suffix
--
-- One string. Postgres cannot fetch one key out of a TOASTed jsonb: it
-- reassembles the whole ~10 KB document from its TOAST chunks, parses it, and
-- throws the rest away. At the measured +3.845 ms/row detoast delta, that single
-- expression costs ~2,284 s per refresh across the 594,099-row IDX scope — on a
-- matview refreshed every 30 minutes by pg_cron job 164 with an 1800 s budget.
-- Observed job-164 durations over the 12 h to 2026-08-01 05:30 UTC: 425.2 /
-- 459.4 / 469.8 / 536.6 / 583.4 / 588.1 / 638.4 / 851.7 / 920.7 / 1029.5 s
-- (mean 650.3 s, max 1029.5 s = 57% of the ceiling). This is the same class as
-- the historical "listing_tile_mv went 8 days stale" incident; raising the
-- timeout 300 -> 900 -> 1800 s treated the symptom.
--
-- THE REMEDY. listings has NO typed street_suffix column (verified against
-- information_schema 2026-08-01: zero matches for '%suffix%'), so this is the
-- side-table remedy, not the typed-column swap. TOAST_READ_DISCIPLINE.md § "The
-- two correct remedies" names listing_feature_flags as the established narrow
-- projection and says explicitly: do not invent a second parallel mechanism.
-- So the value lands there, maintained by the trigger that is already attached
-- to listings for exactly this purpose.
--
-- WHY NOT A TYPED COLUMN ON listings. Backfilling one would mean UPDATEing
-- 594,199 rows of a 14 GB table: ~1.3 GB of dead heap tuples, and every row
-- would fire trg_compute_listing_fields (BEFORE INSERT OR UPDATE, unconditional)
-- plus trg_listing_feature_flags_upd, whose WHEN (old.details IS DISTINCT FROM
-- new.details) clause has to compare two jsonb Datums and therefore detoasts
-- BOTH copies — doubling the very cost being removed. Writing into the narrow
-- side table costs ~60 MB of churn instead and fires nothing.
--
-- WHY NOT listing_feature_flags_of(). That function returns the composite type
-- listing_feature_flag_values, which search_listings_advanced depends on, and
-- StreetSuffix is an address component rather than a search filter. The value is
-- computed inline in the trigger instead, so neither the composite type nor
-- search_listings_advanced is touched.
--
-- COVERAGE, measured 2026-08-01 before this migration:
--   listings 594,199 · listing_feature_flags 594,199 · listings with no flags
--   row 0. The projection is fully backfilled, so the LEFT JOIN the matview
--   picks up in 20260801053000 cannot silently drop or blank a row.
--
-- STAGING. This migration only adds the column and the write path; every
-- existing row's street_suffix stays NULL until 20260801051000 backfills it,
-- and nothing reads the column until 20260801053000 rebuilds the matview. The
-- equivalence proof runs between those two steps.

ALTER TABLE public.listing_feature_flags
  ADD COLUMN IF NOT EXISTS street_suffix text;

COMMENT ON COLUMN public.listing_feature_flags.street_suffix IS
  'nullif(btrim(listings.details->>''StreetSuffix''), '''') — projected here so listing_tile_mv_src can build the display address without detoasting listings.details for every IDX row on every refresh. Maintained by sync_listing_feature_flags(); backfilled by 20260801051000.';

-- The trigger gains street_suffix in the INSERT list, the DO UPDATE SET list and
-- the IS DISTINCT FROM guard (so an unrelated details edit still short-circuits
-- to a no-op write). Everything else is byte-identical to the 20260801020000
-- version.
CREATE OR REPLACE FUNCTION public.sync_listing_feature_flags()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_catalog'
AS $function$
DECLARE
  v public.listing_feature_flag_values := public.listing_feature_flags_of(NEW.details);
  s text := NULLIF(btrim(NEW.details ->> 'StreetSuffix'), '');
BEGIN
  INSERT INTO public.listing_feature_flags AS f (
    list_number, view_yn, pool_yn, waterfront_yn, fireplace_yn,
    has_open_house, property_sub_type_lower, view_text, street_suffix
  )
  VALUES (
    NEW."ListNumber", v.view_yn, v.pool_yn, v.waterfront_yn, v.fireplace_yn,
    v.has_open_house, v.property_sub_type_lower, v.view_text, s
  )
  ON CONFLICT (list_number) DO UPDATE SET
    view_yn = EXCLUDED.view_yn,
    pool_yn = EXCLUDED.pool_yn,
    waterfront_yn = EXCLUDED.waterfront_yn,
    fireplace_yn = EXCLUDED.fireplace_yn,
    has_open_house = EXCLUDED.has_open_house,
    property_sub_type_lower = EXCLUDED.property_sub_type_lower,
    view_text = EXCLUDED.view_text,
    street_suffix = EXCLUDED.street_suffix
  WHERE (f.view_yn, f.pool_yn, f.waterfront_yn, f.fireplace_yn,
         f.has_open_house, f.property_sub_type_lower, f.view_text, f.street_suffix)
     IS DISTINCT FROM
        (EXCLUDED.view_yn, EXCLUDED.pool_yn, EXCLUDED.waterfront_yn,
         EXCLUDED.fireplace_yn, EXCLUDED.has_open_house,
         EXCLUDED.property_sub_type_lower, EXCLUDED.view_text,
         EXCLUDED.street_suffix);
  RETURN NULL;
END;
$function$;
