-- geo_assign_batch — bulk point-in-polygon assignment for boundary tagging.
--
-- Applied to the hosted DB during the 2026-05-26 incident remediation
-- session via MCP `apply_migration` (Supabase migration history version
-- `20260526142311`) but the corresponding SQL file was never written to
-- disk. Captured 2026-05-26 via `pg_get_functiondef` and committed here
-- so `supabase/migrations/` matches `supabase_migrations.schema_migrations`.
-- This is the repo-DB parity habit locked in by
-- `.cursor/rules/production-parity.mdc` after the CF-522 incidents.
--
-- Input: jsonb array of `{ idx, lon, lat }` records.
-- Output: one row per (input point, matching boundary) ordered by
-- geo_type then ascending polygon area, so the caller can pick the
-- smallest containing polygon per geo_type (e.g. tightest neighborhood
-- match for a listing's lat/lng).

CREATE OR REPLACE FUNCTION public.geo_assign_batch(points jsonb)
 RETURNS TABLE(idx integer, geo_type text, geo_slug text, geo_label text, area_m2 double precision)
 LANGUAGE sql
 STABLE PARALLEL SAFE
AS $function$
  WITH input AS (
    SELECT
      (elem->>'idx')::int AS idx,
      (elem->>'lon')::double precision AS lon,
      (elem->>'lat')::double precision AS lat
    FROM jsonb_array_elements(points) AS elem
  )
  SELECT
    input.idx,
    b.geo_type,
    b.geo_slug,
    b.geo_label,
    ST_Area(b.polygon::geography) AS area_m2
  FROM input
  JOIN public.boundaries b
    ON ST_Contains(b.polygon, ST_SetSRID(ST_MakePoint(input.lon, input.lat), 4326))
  ORDER BY input.idx, b.geo_type, area_m2 ASC
$function$;
