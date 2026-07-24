-- get_subdivision_schools (W2.4 schools leg) — modal school assignment per level
-- for one city-scoped subdivision, from the subdivision's OWN listings' MLS
-- school fields (elementary_school / middle_school / high_school /
-- school_district).
--
-- §0: this returns RAW modal aggregates (modal value, modal count, total count
-- carrying the field). The DAL (getSubdivisionSchools) applies the honesty
-- threshold — a school is only CLAIMED when >=70% of >=10 listings agree —
-- so the claim logic is a pure, unit-tested function. Mixed assignments (e.g.
-- Rivers Edge Village elementary at 59%) are omitted, never guessed.
--
-- Scoped by City + SubdivisionName (same anti-collision posture as
-- compute_subdivision_period_stats). Aggregate-only; no listing rows exposed.

CREATE OR REPLACE FUNCTION public.get_subdivision_schools(p_city text, p_name text)
RETURNS TABLE (level text, modal_name text, modal_n integer, total_n integer)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  WITH src AS (
    SELECT elementary_school, middle_school, high_school, school_district
    FROM public.listings
    WHERE "City" = p_city AND "SubdivisionName" = p_name
      AND "PropertyType" = 'A'
  ),
  unpivoted AS (
    SELECT 'elementary' AS level, NULLIF(trim(elementary_school), '') AS name FROM src
    UNION ALL SELECT 'middle',   NULLIF(trim(middle_school), '')      FROM src
    UNION ALL SELECT 'high',     NULLIF(trim(high_school), '')        FROM src
    UNION ALL SELECT 'district', NULLIF(trim(school_district), '')    FROM src
  ),
  counted AS (
    SELECT level, name, count(*)::int AS n
    FROM unpivoted WHERE name IS NOT NULL
    GROUP BY level, name
  ),
  ranked AS (
    SELECT level, name, n,
           sum(n) OVER (PARTITION BY level)::int AS total,
           row_number() OVER (PARTITION BY level ORDER BY n DESC, name) AS rk
    FROM counted
  )
  SELECT level, name, n, total FROM ranked WHERE rk = 1;
$function$;
