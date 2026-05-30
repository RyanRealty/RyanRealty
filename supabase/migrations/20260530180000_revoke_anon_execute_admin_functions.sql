-- ============================================================================
-- Lock down anon/public EXECUTE on admin + mutation SECURITY DEFINER functions
-- Gates: DATA-07 / DATA-08  (cutover anon-exposure hole)
-- Author: pre-cutover security hardening, 2026-05-30
--
-- WHY: every SECURITY DEFINER function in `public` was created with the Postgres
-- default `GRANT EXECUTE ... TO PUBLIC`, so the anon role (the key the new site
-- publishes to every browser) can EXECUTE them. A read-only audit found the anon
-- role can call not just `_agent_schema_dump()` (full schema exfiltration) but
-- dozens of MUTATING/admin functions — cleanup, backfill, MV refresh, neighborhood
-- remap, boundary import. An anonymous caller with the public key could trigger
-- destructive or resource-exhausting operations. This is a privilege-escalation
-- surface the cutover is about to publish the anon key against.
--
-- SCOPE (verified safe — does NOT touch the site's read path):
--   * The new site's DAL (lib/data/**) reads PUBLIC market/listing data via the
--     anon key using READ RPCs (get_market_report, listings_in_boundary,
--     boundary_geojson, community_subdivisions, get_city_*, get_neighborhood*,
--     get_subdivision*, get_trending*, inventory_breakdown_*, search_listings_*,
--     match_listings_semantic, lookup_address_geo, get_cma_comps*) and the
--     listing materialized views. THOSE ARE LEFT ALONE — the data is public and
--     the anon read path is intentional. The "materialized_view_in_api" advisor
--     warnings are accepted (public listing data), not closed here.
--   * Every function revoked below is invoked ONLY by server-side callers that
--     use the service_role key: app/api/cron/* and app/actions/sync-* construct
--     their client via lib/supabase/service.ts (createServiceClient →
--     SUPABASE_SERVICE_ROLE_KEY). We REVOKE FROM PUBLIC (removes anon +
--     authenticated) and re-GRANT TO service_role so those crons keep working.
--   * `_agent_schema_dump()` is not called by the site or the ci:data-access gate
--     (that gate reads information_schema via PostgREST), so revoking anon is safe.
--
-- NOT INCLUDED (ambiguous — review against the live DB before locking):
--   compute_reporting_cache_payload, get_listings_breakdown,
--   get_listing_sync_status_breakdown, get_listing_media_counts,
--   is_broker_admin_or_above, is_super_admin (the last two are RLS helper
--   predicates that anon may legitimately need to evaluate row policies).
--
-- APPLY: review, then `supabase db push` (or apply_migration) against the prod
-- project dwvlophlbvvygjfxcrhm. AFTER applying, re-run the security advisor and
-- the verification query at the bottom; both should report zero anon-executable
-- entries from this set. Smoke-test the site read paths + a cron run.
-- ============================================================================

do $$
declare
  r record;
  targets text[] := array[
    -- schema exfiltration
    '_agent_schema_dump',
    -- data-mutation batch jobs
    'apply_close_price_from_history_batch',
    'apply_listing_dom_metrics_batch',
    'apply_original_list_price_from_details_batch',
    'backfill_all_historical_stats',
    'backfill_bend_listings_neighborhood',
    'backfill_bend_listings_neighborhood_scoped',
    'backfill_central_oregon_history_tick',
    'backfill_market_stats_period_range',
    'backfill_month',
    'backfill_rolling',
    'compute_and_cache_period_stats',
    'generate_market_narrative',
    -- destructive / admin maintenance
    'cleanup_old_events',
    'clear_listings_neighborhood_tag',
    'engagement_metrics_to_listings_sync',
    'import_bend_neighborhood_boundary',
    'map_communities_to_neighborhoods',
    'map_properties_to_neighborhood',
    -- materialized-view + cache refreshers (cron-only)
    'refresh_current_period_stats',
    'refresh_geo_snapshot_mv',
    'refresh_listing_boundary_xref_mv',
    'refresh_listing_detail_mv',
    'refresh_listing_tile_mv',
    'refresh_listing_year_sync_stats',
    'refresh_listings_breakdown',
    'refresh_market_pulse',
    'refresh_similar_listings_mv'
  ];
begin
  for r in
    select p.oid::regprocedure as sig
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = any(targets)
  loop
    -- Remove the implicit PUBLIC grant (covers anon + authenticated)...
    execute format('revoke execute on function %s from public', r.sig);
    execute format('revoke execute on function %s from anon', r.sig);
    execute format('revoke execute on function %s from authenticated', r.sig);
    -- ...but keep the server-side (service_role) callers working.
    execute format('grant execute on function %s to service_role', r.sig);
    raise notice 'locked down: %', r.sig;
  end loop;
end $$;

-- ── Verification (run after apply; expect ZERO rows) ────────────────────────
-- select n.nspname, p.proname,
--        has_function_privilege('anon', p.oid, 'EXECUTE') as anon_can_execute
-- from pg_proc p
-- join pg_namespace n on n.oid = p.pronamespace
-- where n.nspname = 'public'
--   and p.proname in (
--     '_agent_schema_dump','cleanup_old_events','clear_listings_neighborhood_tag',
--     'refresh_listing_tile_mv','backfill_month','map_properties_to_neighborhood'
--   )
--   and has_function_privilege('anon', p.oid, 'EXECUTE');
