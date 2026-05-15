-- Add provenance metadata columns to public.neighborhoods for every polygon stored in boundary_geojson.
-- Enforces the GIS-authoritative-only rule (feedback_gis_authoritative_only.md + CLAUDE.md §0).
-- Every row with boundary_geojson IS NOT NULL must trace to an authoritative source via
-- boundary_source, boundary_source_url, boundary_fetched_at, boundary_verified_by.

ALTER TABLE public.neighborhoods
  ADD COLUMN IF NOT EXISTS boundary_source text,
  ADD COLUMN IF NOT EXISTS boundary_source_url text,
  ADD COLUMN IF NOT EXISTS boundary_fetched_at timestamptz,
  ADD COLUMN IF NOT EXISTS boundary_verified_by text;

COMMENT ON COLUMN public.neighborhoods.boundary_source IS 'Authoritative source for boundary_geojson (e.g. "City of Bend GIS - Neighborhood Districts"). MANDATORY per feedback_gis_authoritative_only.md. Never NULL when boundary_geojson is populated.';
COMMENT ON COLUMN public.neighborhoods.boundary_source_url IS 'Direct URL to source file or REST endpoint where the polygon originated.';
COMMENT ON COLUMN public.neighborhoods.boundary_fetched_at IS 'When the source data was pulled from its origin.';
COMMENT ON COLUMN public.neighborhoods.boundary_verified_by IS 'Who validated the polygon visually (matt initials or agent:<session_id>).';
