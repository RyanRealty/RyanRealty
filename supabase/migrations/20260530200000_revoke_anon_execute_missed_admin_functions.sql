-- ============================================================================
-- Follow-up to 20260530180000_revoke_anon_execute_admin_functions.sql
-- Gates: DATA-07 / DATA-08 (cutover anon-exposure hole — second pass)
-- Author: pre-cutover security hardening, 2026-05-30
--
-- WHY: the security advisor (anon_security_definer_function_executable) surfaced
-- four more anon-executable SECURITY DEFINER functions the first pass missed.
-- All four have ZERO references in the site code (lib/app/scripts) — they are
-- server/cron-only — and each carries the same risk profile the first migration
-- was written to close:
--   * run_post_sync_pipeline(p_caller)        — heavy pipeline, statement_timeout
--                                               240s; anon-callable = DoS vector.
--   * refresh_neighborhood_subdivisions()     — TRUNCATEs + rebuilds the
--                                               neighborhood_subdivisions table;
--                                               anon-callable = destructive.
--   * refresh_video_tours_cache(scope,limit)  — rebuilds a cache payload; resource.
--   * rls_auto_enable()                        — DDL event-trigger function; should
--                                               never have been PUBLIC-executable.
--
-- SCOPE (verified safe): none of these are on the anon read path. service_role is
-- re-granted so the pg_cron jobs + server-side callers (createServiceClient) keep
-- working. The intentional public read RPCs and RLS predicates (is_super_admin,
-- is_broker_admin_or_above) are deliberately NOT touched.
--
-- Idempotent. After apply, anon/authenticated EXECUTE = revoked, service_role = kept.
-- ============================================================================

do $$
declare
  r record;
  targets text[] := array[
    'run_post_sync_pipeline',
    'refresh_neighborhood_subdivisions',
    'refresh_video_tours_cache',
    'rls_auto_enable'
  ];
begin
  for r in
    select p.oid::regprocedure as sig
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = any(targets)
  loop
    execute format('revoke execute on function %s from public', r.sig);
    execute format('revoke execute on function %s from anon', r.sig);
    execute format('revoke execute on function %s from authenticated', r.sig);
    execute format('grant execute on function %s to service_role', r.sig);
    raise notice 'locked down: %', r.sig;
  end loop;
end $$;

-- ── Verification (run after apply; expect anon=false, service_role=true) ─────
-- select p.proname,
--        has_function_privilege('anon', p.oid, 'EXECUTE')         as anon_exec,
--        has_function_privilege('service_role', p.oid, 'EXECUTE') as service_exec
-- from pg_proc p join pg_namespace n on n.oid = p.pronamespace
-- where n.nspname = 'public'
--   and p.proname in ('run_post_sync_pipeline','refresh_neighborhood_subdivisions',
--                     'refresh_video_tours_cache','rls_auto_enable');
