-- Allow anon read on the two market-stats tables that already feed
-- listing-detail + LP / city / community pages.
--
-- Both tables had RLS enabled with ZERO policies, which silently
-- blocked anon-role queries (anon got null on every call). The
-- server-side cookies-in-cache fix that ships alongside this
-- migration switches getMarketPulse + getMarketStats to use
-- supabaseAnon (because the existing supabaseServer + unstable_cache
-- combo is forbidden in Next.js). With anon now in the read path,
-- they need at least SELECT permission.
--
-- These are PUBLIC market-summary tables (city / neighborhood /
-- community / zip / region aggregates). No PII, no per-user data,
-- no row-owner concept. Anon read is the right policy. Writes stay
-- restricted to service-role + the cron pipeline.
--
-- Per CLAUDE.md "Same pipeline as Cursor": migrations apply with the
-- code that depends on them; this migration ships in the same
-- commit as the market DAL schema fix + listing-detail Wave 3
-- rebuild.

CREATE POLICY IF NOT EXISTS "anon_read_market_pulse_live"
  ON public.market_pulse_live
  FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY IF NOT EXISTS "anon_read_market_stats_cache"
  ON public.market_stats_cache
  FOR SELECT
  TO anon, authenticated
  USING (true);
