-- PostgREST's schema-cache reload gets 30 s, not 8, before it gives up.
--
-- THE FAILURE (2026-10-14/15). A schema change (a migration applied over the
-- Supabase API at 00:03:20Z, for one) sends NOTIFY pgrst 'reload schema'
-- (extensions.pgrst_ddl_watch). PostgREST then re-reads the catalog as its
-- login role, authenticator, whose statement_timeout is 8 s. Under a
-- production build's load that read timed out at 23:03Z and at 00:03Z;
-- PostgREST's log:
--   "Failed to load the schema cache using db-schemas=public,graphql_public
--    ... {"code":"57014" ...}"
-- and until a retry loaded it, every API request was answered PGRST002
-- "Could not query the database for the schema cache. Retrying." (HTTP 503):
-- 415 such errors in the 23:03Z minute, 265 at 00:03Z, 5 to 20 s of 503s in
-- Supabase's edge log each time. Production builds 458d4a40a (23:03:20Z),
-- 0a9c47645 (00:03:31Z) and 4837ad8a8 (00:08:02Z) each died on a prerender
-- whose read got that 503. A reload that succeeded under the same load took
-- 4.4 s ("Schema cache queried in 4363.4 milliseconds", 23:03Z): close to the
-- limit, not far past it.
--
-- THE CHANGE. statement_timeout = 30s for authenticator only. It bounds
-- PostgREST's own queries (schema cache, role settings, version). API
-- requests are unaffected: PostgREST applies the impersonated role's settings
-- on every request (anon 3 s, authenticated 8 s, service_role 120 s, all set
-- on those roles; see 20261001040235_site212_postgrest_custom_plans.sql for
-- the same mechanism), so no request runs under authenticator's value.
-- lock_timeout stays 8 s.
--
-- Takes effect on each PostgREST pool connection opened after this (the pool
-- recycles its connections); NOTIFY makes PostgREST re-read its config now.
-- Undo: ALTER ROLE authenticator SET statement_timeout = '8s'; then the same
-- NOTIFY.

ALTER ROLE authenticator SET statement_timeout = '30s';

NOTIFY pgrst, 'reload config';
