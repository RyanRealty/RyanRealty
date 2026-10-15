-- get_place_schools reads the stored measurement (part 2 of 2).
--
-- Same signature, output columns, order, SECURITY DEFINER posture and grants as
-- 20260922160000. A measured place (place_school_share_places) is answered from
-- place_school_shares by primary key: no geography math at request time. Any
-- other place (added since the last refresh, or a geo_type the refresh skips)
-- is measured live by compute_place_schools, which is the old body word for
-- word. An empty table therefore serves exactly what the old function did.
--
-- Parity before this file was applied to production: for every measured place,
-- the old get_place_schools output against place_school_shares, row for row and
-- in order (slug, label, share rounded to 4 places). Evidence in the PR.

BEGIN;

CREATE OR REPLACE FUNCTION public.get_place_schools(p_geo_type text, p_geo_slug text)
RETURNS TABLE (geo_slug text, geo_label text, share numeric)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_type text := NULLIF(btrim(p_geo_type), '');
  v_slug text := NULLIF(btrim(p_geo_slug), '');
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.place_school_share_places m
    WHERE m.geo_type = v_type
      AND m.geo_slug = v_slug
  ) THEN
    RETURN QUERY
      SELECT s.school_geo_slug, s.school_geo_label, s.share
      FROM public.place_school_shares s
      WHERE s.geo_type = v_type
        AND s.geo_slug = v_slug
      ORDER BY s.ordinal;
    RETURN;
  END IF;

  RETURN QUERY
    SELECT c.geo_slug, c.geo_label, c.share
    FROM public.compute_place_schools(p_geo_type, p_geo_slug) c;
END;
$function$;

COMMENT ON FUNCTION public.get_place_schools(text, text) IS
  'Attendance-area schools covering a boundaries polygon: the nightly stored rows (place_school_shares), else measured live by compute_place_schools. Share is the fraction of the place (spheroid), kept only at >= 0.05. Not an MLS modal.';

GRANT EXECUTE ON FUNCTION public.get_place_schools(text, text) TO anon, authenticated, service_role;

COMMIT;
