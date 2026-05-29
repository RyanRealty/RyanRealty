-- Allow anon read on asset_library for APPROVED assets only.
--
-- The public city / community pages resolve geo-tile imagery (neighborhood +
-- city area cards) from asset_library via supabaseAnon (getGeoTileImages).
-- The table had RLS enabled with only `authenticated` + `service_role` SELECT
-- policies, so the anon role got zero rows and every tile rendered imageless.
--
-- Approved assets are public, licensed Central Oregon photography served from
-- public Supabase Storage URLs (already allowed by next.config remotePatterns).
-- Anon read of the approved-asset metadata is safe. Pending / rejected assets
-- stay hidden from anon. Writes remain service-role only.
--
-- Per CLAUDE.md "Same pipeline as Cursor": this migration ships with the code
-- that depends on it (the city-page neighborhood + golf-community imagery
-- rebuild, 2026-05-28).

DROP POLICY IF EXISTS "asset_library_anon_read_approved" ON public.asset_library;
CREATE POLICY "asset_library_anon_read_approved"
  ON public.asset_library
  FOR SELECT
  TO anon
  USING (approval = 'approved');
