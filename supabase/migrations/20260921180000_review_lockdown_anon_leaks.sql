-- Deep-audit 2026-09-20 remaining criticals (C3/C4/C5) + D11 write grants.
-- C1 (Oregon 8pm SMS) and C2 (sale_pricing_facts_sfr) already shipped 32af7d2c4.
--
-- C4 liked_communities: drop USING (true) SELECT that leaked user_id to anon.
--    Mirror likes: authenticated own-row SELECT. Anon has no SELECT.
-- C5 content_briefs: compatibility VIEW over marketing_brain_actions, owner-run
--    (not security_invoker), so table RLS never applied. Anon SELECT returned
--    977+ internal briefs (comms:matt_summary, body, payload, executor_response).
-- C3 remaining VOLATILE SECURITY DEFINER mutators still GRANT EXECUTE TO PUBLIC.
--    Keep the documented public read RPC allowlist (listings_in_boundary,
--    taxlots_near_point, get_market_report, search_listings_advanced, …).
-- D11: listing_tile_mv / listing_boundary_xref_mv SELECT is the accepted public
--    tile surface; INSERT/UPDATE/DELETE/TRUNCATE to anon was not.
-- listing_history: keep anon SELECT (DAL supabaseAnon reads it); drop writes.

-- ── C4 liked_communities ────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Public read liked_communities" ON public.liked_communities;

DROP POLICY IF EXISTS "Authenticated read own liked_communities" ON public.liked_communities;
CREATE POLICY "Authenticated read own liked_communities"
  ON public.liked_communities
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

REVOKE ALL ON TABLE public.liked_communities FROM anon;
REVOKE ALL ON TABLE public.liked_communities FROM public;
GRANT SELECT, INSERT, DELETE ON TABLE public.liked_communities TO authenticated;
GRANT ALL ON TABLE public.liked_communities TO service_role;

COMMENT ON TABLE public.liked_communities IS
  'User likes per community (entity_key = city:subdivision). SELECT is own-row for authenticated; anon has no SELECT.';

-- ── C5 content_briefs view ──────────────────────────────────────────────────
ALTER VIEW public.content_briefs SET (security_invoker = true);

REVOKE ALL ON TABLE public.content_briefs FROM anon;
REVOKE ALL ON TABLE public.content_briefs FROM authenticated;
REVOKE ALL ON TABLE public.content_briefs FROM public;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.content_briefs TO service_role;

COMMENT ON VIEW public.content_briefs IS
  'Compatibility view of marketing_brain_actions. Service-role only. security_invoker so table RLS applies.';

-- ── D11 + listing_history writes ────────────────────────────────────────────
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON TABLE public.listing_tile_mv FROM anon, authenticated, public;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON TABLE public.listing_boundary_xref_mv FROM anon, authenticated, public;
GRANT SELECT ON TABLE public.listing_tile_mv TO anon, authenticated;
GRANT SELECT ON TABLE public.listing_boundary_xref_mv TO anon, authenticated;

REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON TABLE public.listing_history FROM anon, authenticated, public;
GRANT SELECT ON TABLE public.listing_history TO anon, authenticated;

-- ── C3 mutators + PII / admin RPCs ──────────────────────────────────────────
do $$
declare
  r record;
  targets text[] := array[
    -- named in the 2026-09-20 audit
    'bulk_activate_newsletter_subscribers',
    'upsert_boundary',
    'repair_boundary_geometry',
    'upsert_trail_line',
    'crm_advance_round_robin',
    'crm_advance_group_round_robin',
    'crm_claim_bulk_job',
    'crm_claim_import',
    'crm_release_cron_lease',
    'crm_try_cron_lease',
    'backfill_conversation_model',
    'backfill_conversation_participants',
    'backfill_group_participants',
    'recompute_conversation_rollups',
    'compute_market_metrics_hud_windows_shadow',
    'compute_market_metrics_monthly_neighborhood_shadow',
    'compute_market_metrics_monthly_shadow',
    'compute_market_metrics_monthly_zip_shadow',
    'compute_subdivision_period_stats',
    -- admin / PII, not on the public read path
    'crm_person_ids_by_email_ci',
    'get_listings_breakdown',
    'get_listing_sync_status_breakdown',
    'get_city_status_counts',
    'get_subdivision_status_counts',
    'report_listing_history_row_count',
    'report_listings_missing_both_dates_count',
    'caller_has_admin_role',
    'caller_is_superuser',
    'get_market_report_for_period',
    'crm_conversation_on_message',
    'crm_conversation_sync_participants'
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
  end loop;
end $$;
