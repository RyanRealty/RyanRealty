-- Drop the dead 28-arg search_listings_advanced overload (was oid 613025).
--
-- A later CREATE OR REPLACE added p_has_fireplace, p_has_golf_course, and
-- p_view_contains, producing a NEW 31-arg function and orphaning the original
-- 28-arg version. The app's only caller (getListingsAdvanced in
-- app/actions/listings.ts) passes all 31 named params, so it resolves uniquely
-- to the 31-arg function. The 28-arg overload has zero callers and only adds
-- overload-resolution ambiguity.
--
-- Verified 2026-06-07: no source callers of the 28-arg signature; live count
-- parity confirmed against the 31-arg path (Bend active = 1,351 either way).
-- No CASCADE, so this errors rather than breaking anything if a hidden
-- dependency existed. Idempotent (IF EXISTS) so re-application is a no-op.
-- Already applied to hosted prod 2026-06-07 via MCP; this file keeps repo +
-- prod migration history in sync.
DROP FUNCTION IF EXISTS public.search_listings_advanced(
  text, text, text, numeric, numeric, integer, integer, numeric, numeric,
  numeric, numeric, integer, integer, numeric, numeric, text, text, text, text,
  boolean, integer, boolean, boolean, boolean, integer, text, integer, integer
);
