-- 20260711230000_refresh_rpc_service_role_only.sql
--
-- refresh_listing_search_mv() was granted to `authenticated` (copied from the
-- older tile-refresh pattern). But `authenticated` is every signed-in consumer
-- account, reachable at POST /rest/v1/rpc/refresh_listing_search_mv with the
-- browser anon+JWT — a signed-in user could spin ~43s CONCURRENTLY refreshes
-- and contend with the hourly alert reads (attack finding 2026-07-11). Only the
-- cron (service_role) and Postgres itself ever call it.
--
-- PROD APPLY NOTE (2026-07-11): applied to hosted dwvlophlbvvygjfxcrhm in the
-- same session.

REVOKE EXECUTE ON FUNCTION public.refresh_listing_search_mv() FROM authenticated;
-- service_role + postgres retain EXECUTE (granted in 20260711160000).
