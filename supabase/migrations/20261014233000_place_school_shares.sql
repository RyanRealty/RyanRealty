-- Place schools are measured once a night, not on every render (part 1 of 2).
--
-- WHY. get_place_schools (20260922160000) intersects every attendance polygon
-- touching a place with the place polygon on the spheroid, on every call. It
-- runs 45 to 550 ms alone (Bend city 430 ms, Sunriver 549 ms, 2026-10-14) and
-- was the largest statement-timeout source on the database after #618: 181 of
-- 342 timeouts between 2026-10-14 20:30Z and 23:52Z, and 122 on 2026-10-13
-- (postgres_logs, query_id 1109736241542811364). It fails in bursts when a
-- production build and PR CI render community and neighborhood pages at once
-- (anon statement_timeout 3 s), and the resilient cache retries a failure once
-- uncached, so a timeout doubles the load. Attendance polygons and place
-- polygons move when the county or the registry redraws them, not by the
-- minute.
--
-- THE CHANGE.
--   compute_place_schools        the live RPC body, word for word (its
--                                whitespace-normalized md5 was checked equal to
--                                the live get_place_schools before this file:
--                                c4d71053bf6d5781bdd6e356d25af401).
--   place_school_share_places    one row per measured place: every boundaries
--                                row that is not itself a school. A place here
--                                with no rows below is a measured empty (Crook,
--                                Jefferson, Culver, Gilchrist), not a gap.
--   place_school_shares          compute_place_schools' rows per place, in its
--                                own order (ordinal), share already rounded to
--                                4 places exactly as the RPC returns it.
--   refresh_place_school_shares  measures every place in one transaction.
--                                Readers keep the previous rows until commit.
--                                pg_cron nightly 11:17Z, clear of the 10:20,
--                                10:41, 10:56 and 11:40 jobs and the 15-minute
--                                slots.
--
-- After a boundaries edit (new place, redrawn polygon, new attendance layer),
-- run `select public.refresh_place_school_shares();` or wait for the night.
-- Until then a place that is not in place_school_share_places is measured live
-- by get_place_schools, exactly as before (part 2).
--
-- On an empty table (a fresh database) a one-shot pg_cron job fills it within a
-- minute. Re-applying this file to a filled database schedules nothing.

BEGIN;

CREATE OR REPLACE FUNCTION public.compute_place_schools(p_geo_type text, p_geo_slug text)
RETURNS TABLE (geo_slug text, geo_label text, share numeric)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  WITH place AS (
    SELECT polygon
    FROM public.boundaries
    WHERE geo_type = NULLIF(btrim(p_geo_type), '')
      AND geo_slug = NULLIF(btrim(p_geo_slug), '')
      AND polygon IS NOT NULL
    ORDER BY ST_Area(polygon::geography) DESC
    LIMIT 1
  ),
  hits AS (
    SELECT
      s.geo_slug,
      s.geo_label,
      ST_Area(ST_Intersection(s.polygon, p.polygon)::geography)
        / NULLIF(ST_Area(p.polygon::geography), 0) AS share
    FROM public.boundaries s
    CROSS JOIN place p
    WHERE s.geo_type = 'school'
      AND s.polygon IS NOT NULL
      AND s.polygon && p.polygon
      AND ST_Intersects(s.polygon, p.polygon)
  )
  SELECT
    h.geo_slug,
    h.geo_label,
    round(h.share::numeric, 4) AS share
  FROM hits h
  WHERE h.share >= 0.05
  ORDER BY h.share DESC;
$function$;

COMMENT ON FUNCTION public.compute_place_schools(text, text) IS
  'Attendance-area schools covering a boundaries polygon, measured live (the 20260922160000 get_place_schools body). get_place_schools serves the stored rows; this measures.';

REVOKE ALL ON FUNCTION public.compute_place_schools(text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.compute_place_schools(text, text) TO service_role;

CREATE TABLE IF NOT EXISTS public.place_school_share_places (
  geo_type    text        NOT NULL,
  geo_slug    text        NOT NULL,
  computed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (geo_type, geo_slug)
);

COMMENT ON TABLE public.place_school_share_places IS
  'Places measured by refresh_place_school_shares. A place here with no place_school_shares rows is a measured empty. Read only through get_place_schools.';

CREATE TABLE IF NOT EXISTS public.place_school_shares (
  geo_type         text        NOT NULL,
  geo_slug         text        NOT NULL,
  ordinal          integer     NOT NULL,
  school_geo_slug  text        NOT NULL,
  school_geo_label text        NOT NULL,
  share            numeric     NOT NULL,
  computed_at      timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (geo_type, geo_slug, ordinal)
);

COMMENT ON TABLE public.place_school_shares IS
  'compute_place_schools rows per place, in its order (ordinal). share is the rounded fraction of the place the school polygon covers: for the >= 0.05 cut and ordering, never printed. Read only through get_place_schools.';

-- Read only through the SECURITY DEFINER function, as boundaries is.
ALTER TABLE public.place_school_share_places ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.place_school_shares ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.place_school_share_places FROM anon, authenticated;
REVOKE ALL ON public.place_school_shares FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.refresh_place_school_shares()
RETURNS integer
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_started timestamptz := now();
  v_places  integer;
BEGIN
  -- One refresh at a time (the nightly job and a hand run after a boundary edit).
  PERFORM pg_advisory_xact_lock(7112);

  DELETE FROM public.place_school_share_places;
  INSERT INTO public.place_school_share_places (geo_type, geo_slug, computed_at)
  SELECT b.geo_type, b.geo_slug, v_started
  FROM public.boundaries b
  WHERE b.geo_type <> 'school';
  GET DIAGNOSTICS v_places = ROW_COUNT;

  -- The rows come from the place list above, so every listed place was measured.
  DELETE FROM public.place_school_shares;
  INSERT INTO public.place_school_shares
    (geo_type, geo_slug, ordinal, school_geo_slug, school_geo_label, share, computed_at)
  SELECT p.geo_type, p.geo_slug, c.ordinal::integer, c.geo_slug, c.geo_label, c.share, v_started
  FROM public.place_school_share_places p
  CROSS JOIN LATERAL public.compute_place_schools(p.geo_type, p.geo_slug)
    WITH ORDINALITY AS c(geo_slug, geo_label, share, ordinal);

  RETURN v_places;
END;
$fn$;

COMMENT ON FUNCTION public.refresh_place_school_shares() IS
  'Measures every non-school boundaries place into place_school_share_places + place_school_shares. pg_cron nightly; run by hand after a boundaries edit.';

REVOKE ALL ON FUNCTION public.refresh_place_school_shares() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.refresh_place_school_shares() TO service_role;

SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'place-school-shares-refresh';
SELECT cron.schedule(
  'place-school-shares-refresh',
  '17 11 * * *',
  $cmd$ set local statement_timeout = '1800s'; select public.refresh_place_school_shares(); $cmd$
);

-- First fill on an empty table only. The job unschedules itself in the same
-- transaction as the fill, so a failed fill retries the next minute.
DO $do$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.place_school_share_places) THEN
    PERFORM cron.unschedule(jobid) FROM cron.job WHERE jobname = 'place-school-shares-first-fill';
    PERFORM cron.schedule(
      'place-school-shares-first-fill',
      '* * * * *',
      $cmd$ select cron.unschedule('place-school-shares-first-fill'); set local statement_timeout = '1800s'; select public.refresh_place_school_shares(); $cmd$
    );
  END IF;
END
$do$;

COMMIT;
