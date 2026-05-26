-- Cap service_role statement_timeout + lock_timeout.
--
-- ROOT CAUSE of the 2026-05-26 CF-522 incident (also 2026-05-24):
-- service_role had rolconfig=NULL, inheriting Supabase's default
-- statement_timeout of 10 minutes. Every Vercel cron + every server
-- action connects as service_role. A single bad query could hold a
-- connection for 10 full minutes — long enough for a cron storm to
-- exhaust the pool, starve autovacuum, and tip the DB into the wedged
-- state that required a hard restart to recover from.
--
-- Per-role timeouts BEFORE this migration (verified live 2026-05-26):
--   anon          → statement_timeout=3s
--   authenticated → statement_timeout=8s
--   authenticator → statement_timeout=8s, lock_timeout=8s
--   service_role  → (NULL, inherits 10min)         ← the missing guard
--
-- AFTER: service_role caps at 2 min per statement, 30s waiting for a
-- lock. Long-running operations (REFRESH MATERIALIZED VIEW CONCURRENTLY,
-- refresh_market_pulse) live inside SECURITY DEFINER functions with
-- their own `SET statement_timeout TO '180-300s'` clause — the
-- function-level setting overrides the role-level one, so those keep
-- working. Plain queries from cron handlers cannot exceed 2 min.
--
-- ALTER ROLE ... SET ... persists across restarts; reload not required
-- for new connections.

ALTER ROLE service_role SET statement_timeout TO '120s';
ALTER ROLE service_role SET lock_timeout TO '30s';

COMMENT ON ROLE service_role IS
  'Supabase service role. statement_timeout=120s, lock_timeout=30s (set 2026-05-26 after CF-522 incident). Long-running ops must live in SECURITY DEFINER functions with their own SET statement_timeout clause to override.';
