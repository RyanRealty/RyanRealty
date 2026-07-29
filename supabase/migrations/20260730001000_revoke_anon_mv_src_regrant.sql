-- SECURITY re-revoke (found during the F7 follow-up, 2026-07-29).
--
-- The 2026-07-29 tile-MV rebuild (20260729193000) recreated
-- listing_tile_mv_src and similar_listings_mv_src. Supabase's pg_default_acl
-- auto-grants full rights on NEWLY CREATED relations to anon/authenticated/
-- service_role, which silently undid the Coming Soon lockdown revokes from
-- 20260721091000: the anon key could once again read the _src matview
-- directly via PostgREST, bypassing the serving view's Coming Soon filter.
-- Verified via relacl before this fix.
--
-- Lesson encoded in 20260730000500's GRANT MODEL header: every migration that
-- recreates a relation must explicitly REVOKE after CREATE — recreation is
-- re-granting on this platform.
revoke all on public.listing_tile_mv_src from anon, authenticated;
revoke all on public.similar_listings_mv_src from anon, authenticated;
grant select on public.listing_tile_mv_src to service_role;
grant select on public.similar_listings_mv_src to service_role;
