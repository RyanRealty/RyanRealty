-- SITE-212: place character is measured once a night, not on every render.
--
-- WHY. get_place_character (20260826170000) measures a place's housing stock
-- from its primary members, one index lookup per member listing. It was the
-- largest API statement by total time on the instance: 13,384 anon calls
-- between 2026-09-30 22:08Z and 2026-10-01 04:01Z, mean 339 ms, 1,821 buffers
-- a call, 757,281 of them read from disk (pg_stat_statements), and 26
-- statement timeouts at anon's 3 s between 2026-09-30 23:45Z and 04:10Z
-- (postgres_logs). A large place is a large read: neighborhood/sunriver has
-- 10,231 members, 1.1 s warm and 28.9 s cold under load (SITE-212 evidence).
-- The page gives up at 4 s and the data cache never stores a late answer, so
-- a large place was measured again on every render. The figures it serves
-- (10th to 90th percentile build year, the median HOA dues of the last 36
-- months) move when a home is built or a listing reports dues, not by the
-- minute.
--
-- THE CHANGE.
--   compute_place_character   the measured query, word for word (the live
--                             body's whitespace-normalized md5 was checked
--                             equal to 20260826170000's before this file).
--   place_character_cache     one row per (geo_type, geo_slug, window): the
--                             function's rows as a jsonb array in its own order,
--                             and when they were computed.
--   refresh_place_character_cache(window)
--                             measures every place a page asks about (primary,
--                             current neighborhood and subdivision members) in
--                             one statement, upserts, and drops the rows of
--                             places that have no members any more. pg_cron,
--                             nightly 10:41Z, after the 10:39 membership refresh.
--   get_place_character       same signature, grants and settings. Serves the
--                             stored rows while they are under 48 hours old;
--                             otherwise, and for any place or window the
--                             refresh does not cover, measures live exactly as
--                             before. An empty table serves exactly what the
--                             old function did.
--
-- A stored answer is the function's own output as of the refresh, including
-- its window_from, so the copy states the window the figures cover. Proof
-- after the first refresh: the stored path against compute_place_character,
-- row for row and in order, for the largest places and a spread of others.

BEGIN;

CREATE TABLE IF NOT EXISTS public.place_character_cache (
  geo_type          text        NOT NULL,
  geo_slug          text        NOT NULL,
  hoa_window_months integer     NOT NULL,
  payload           jsonb       NOT NULL,
  computed_at       timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (geo_type, geo_slug, hoa_window_months)
);

COMMENT ON TABLE public.place_character_cache IS
  'get_place_character''s rows per place, measured nightly by refresh_place_character_cache (SITE-212). Read only through get_place_character.';

-- Read only through the SECURITY DEFINER function.
ALTER TABLE public.place_character_cache ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.place_character_cache FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.compute_place_character(
  p_geo_type          text,
  p_geo_slug          text,
  p_hoa_window_months integer default 36
)
RETURNS TABLE(
  segment            text,
  home_count         int,
  year_sample        int,
  year_p10           int,
  year_p90           int,
  hoa_reported       int,
  hoa_median_monthly numeric,
  assoc_reported     int,
  assoc_yes          int,
  window_from        date
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  with cutoff as (
    select (current_date
            - make_interval(months => greatest(coalesce(p_hoa_window_months, 36), 1))
           )::date as from_date
  ),
  member as (
    select pm.listing_key
    from public.place_membership pm
    where pm.geo_type = p_geo_type
      and pm.geo_slug = p_geo_slug
      and pm.is_primary
      and pm.effective_to is null
  ),
  raw as (
    select
      l."ListingKey"                          as listing_key,
      nullif(btrim(l.property_sub_type), '')  as sub_type,
      l.year_built                            as year_built,
      l.hoa_monthly                           as hoa_monthly,
      l.association_yn                        as association_yn,
      coalesce(
        nullif(btrim(l.parcel_number), ''),
        nullif(
          lower(concat_ws('|', btrim(l."StreetNumber"), btrim(l."StreetName"), btrim(l."City"))),
          ''
        ),
        l."ListingKey"
      )                                       as home_key,
      greatest(
        coalesce(l."CloseDate",             '-infinity'::timestamptz),
        coalesce(l.status_change_timestamp, '-infinity'::timestamptz),
        coalesce(l."OnMarketDate",          '-infinity'::timestamptz),
        coalesce(l."ListDate",              '-infinity'::timestamptz)
      )                                       as as_of_ts
    from member m
    join public.listings l on l."ListingKey" = m.listing_key
    where nullif(btrim(l.property_sub_type), '') is not null
  ),
  homes as (
    select distinct on (r.home_key) r.*
    from raw r
    order by r.home_key, r.as_of_ts desc, r.listing_key desc
  ),
  home_agg as (
    select h.sub_type as segment, count(*)::int as home_count
    from homes h
    group by 1
  ),
  year_rows as (
    select h.sub_type as segment, h.year_built
    from homes h
    where h.year_built between 1850 and 2030
  ),
  year_agg as (
    select
      segment,
      count(*)::int                                                    as year_sample,
      (percentile_disc(0.10) within group (order by year_built))::int  as year_p10,
      (percentile_disc(0.90) within group (order by year_built))::int  as year_p90
    from year_rows
    group by 1
  ),
  window_rows as (
    select r.sub_type as segment, r.hoa_monthly, r.association_yn
    from raw r
    cross join cutoff c
    where r.as_of_ts > '-infinity'::timestamptz
      and r.as_of_ts::date >= c.from_date
  ),
  hoa_agg as (
    select
      segment,
      count(*) filter (where hoa_monthly is not null and hoa_monthly > 0)::int as hoa_reported,
      count(*) filter (where association_yn is not null)::int                  as assoc_reported,
      count(*) filter (where association_yn is true)::int                      as assoc_yes
    from window_rows
    group by 1
  ),
  dues as (
    select
      segment,
      round(percentile_cont(0.5) within group (order by hoa_monthly))::numeric as hoa_median_monthly
    from window_rows
    where hoa_monthly is not null and hoa_monthly > 0
    group by 1
  )
  select
    ha.segment,
    ha.home_count,
    coalesce(ya.year_sample, 0)   as year_sample,
    ya.year_p10,
    ya.year_p90,
    coalesce(hg.hoa_reported, 0)  as hoa_reported,
    d.hoa_median_monthly,
    coalesce(hg.assoc_reported, 0) as assoc_reported,
    coalesce(hg.assoc_yes, 0)      as assoc_yes,
    (select from_date from cutoff) as window_from
  from home_agg ha
  left join year_agg ya on ya.segment = ha.segment
  left join hoa_agg  hg on hg.segment = ha.segment
  left join dues     d  on d.segment  = ha.segment
  order by ha.home_count desc, ha.segment
$$;

COMMENT ON FUNCTION public.compute_place_character(text, text, integer) IS
  'The place character measurement (PLACE_CONTENT_RULES R1 to R3), live. get_place_character serves its stored rows; this measures (SITE-212).';

REVOKE ALL ON FUNCTION public.compute_place_character(text, text, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.compute_place_character(text, text, integer) TO service_role;

CREATE OR REPLACE FUNCTION public.refresh_place_character_cache(
  p_hoa_window_months integer default 36
)
RETURNS integer
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_window  integer := greatest(coalesce(p_hoa_window_months, 36), 1);
  v_started timestamptz := now();
  v_rows    integer;
BEGIN
  INSERT INTO public.place_character_cache AS c (geo_type, geo_slug, hoa_window_months, payload, computed_at)
  SELECT p.geo_type,
         p.geo_slug,
         v_window,
         coalesce(
           (SELECT jsonb_agg(to_jsonb(m) ORDER BY m.home_count DESC, m.segment)
              FROM public.compute_place_character(p.geo_type, p.geo_slug, v_window) m),
           '[]'::jsonb
         ),
         v_started
  FROM (
    SELECT DISTINCT pm.geo_type, pm.geo_slug
    FROM public.place_membership pm
    WHERE pm.is_primary
      AND pm.effective_to IS NULL
      AND pm.geo_type IN ('neighborhood', 'subdivision')
  ) p
  ON CONFLICT (geo_type, geo_slug, hoa_window_months)
  DO UPDATE SET payload = excluded.payload, computed_at = excluded.computed_at;
  GET DIAGNOSTICS v_rows = ROW_COUNT;

  -- A place with no current primary member any more: its stored answer goes,
  -- and a call measures it live (no members, no rows), as before.
  DELETE FROM public.place_character_cache c
  WHERE c.hoa_window_months = v_window
    AND c.computed_at < v_started;

  RETURN v_rows;
END;
$fn$;

COMMENT ON FUNCTION public.refresh_place_character_cache(integer) IS
  'Measures every neighborhood and subdivision with current primary members into place_character_cache (SITE-212). pg_cron nightly.';

REVOKE ALL ON FUNCTION public.refresh_place_character_cache(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.refresh_place_character_cache(integer) TO service_role;

CREATE OR REPLACE FUNCTION public.get_place_character(
  p_geo_type          text,
  p_geo_slug          text,
  p_hoa_window_months integer default 36
)
RETURNS TABLE(
  segment            text,
  home_count         int,
  year_sample        int,
  year_p10           int,
  year_p90           int,
  hoa_reported       int,
  hoa_median_monthly numeric,
  assoc_reported     int,
  assoc_yes          int,
  window_from        date
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
SET statement_timeout = '15s'
AS $fn$
DECLARE
  v_rows jsonb;
BEGIN
  SELECT c.payload INTO v_rows
  FROM public.place_character_cache c
  WHERE c.geo_type = p_geo_type
    AND c.geo_slug = p_geo_slug
    AND c.hoa_window_months = greatest(coalesce(p_hoa_window_months, 36), 1)
    AND c.computed_at > now() - interval '48 hours';

  IF v_rows IS NOT NULL THEN
    RETURN QUERY
      SELECT r.segment, r.home_count, r.year_sample, r.year_p10, r.year_p90,
             r.hoa_reported, r.hoa_median_monthly, r.assoc_reported, r.assoc_yes,
             r.window_from
      FROM jsonb_to_recordset(v_rows) AS r(
        segment            text,
        home_count         int,
        year_sample        int,
        year_p10           int,
        year_p90           int,
        hoa_reported       int,
        hoa_median_monthly numeric,
        assoc_reported     int,
        assoc_yes          int,
        window_from        date
      )
      ORDER BY r.home_count DESC, r.segment;
    RETURN;
  END IF;

  RETURN QUERY
    SELECT m.segment, m.home_count, m.year_sample, m.year_p10, m.year_p90,
           m.hoa_reported, m.hoa_median_monthly, m.assoc_reported, m.assoc_yes,
           m.window_from
    FROM public.compute_place_character(p_geo_type, p_geo_slug, p_hoa_window_months) m;
END;
$fn$;

COMMENT ON FUNCTION public.get_place_character(text, text, integer) IS
  'Place character (PLACE_CONTENT_RULES R1 to R3): the nightly stored rows while under 48 h old, else measured live by compute_place_character (SITE-212).';

REVOKE ALL ON FUNCTION public.get_place_character(text, text, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_place_character(text, text, integer)
  TO anon, authenticated, service_role;

-- Nightly, two minutes after the :39 place-membership refresh and clear of
-- the 10:20 and 10:56 MV rebuilds.
SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'place-character-cache-refresh';
SELECT cron.schedule(
  'place-character-cache-refresh',
  '41 10 * * *',
  $cmd$ set local statement_timeout = '1800s'; select public.refresh_place_character_cache(36); $cmd$
);

COMMIT;
