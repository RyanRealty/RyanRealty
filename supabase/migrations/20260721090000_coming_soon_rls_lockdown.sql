-- Coming Soon lockdown, part 1 of 2: the raw `listings` table.
--
-- WHY: `listings` carried two stacked PERMISSIVE SELECT policies, both
-- `USING (true)`, for anon + authenticated. The anon key ships in the browser
-- bundle, so ANY visitor could copy it and read every Coming Soon listing —
-- full address, price, photo, agent, all ~800 columns — straight from
-- PostgREST, bypassing every application-layer filter.
--
-- Verified before this migration (anon key, 2026-07-21):
--   GET /rest/v1/listings?StandardStatus=eq.Coming%20Soon  -> 52 rows.
--
-- Coming Soon is an MLS pre-marketing state. Publishing it publicly is a
-- licensing violation for Ryan Realty.
--
-- SAFE FOR BROKERS: every admin / broker / sync / prospecting / expired /
-- cron read path uses SUPABASE_SERVICE_ROLE_KEY (audited 2026-07-21 across
-- lib/data/admin/*, lib/data/prospecting/*, lib/data/expired/*, lib/sync/*,
-- app/actions/sync-spark.ts, app/api/admin/**, app/api/cron/**). The
-- service_role bypasses RLS unconditionally, so broker visibility of
-- pre-marketing inventory is untouched. The "Super admin listings" policy
-- (FOR ALL TO authenticated USING (is_super_admin())) is left in place and,
-- being PERMISSIVE, still grants super admins the full row set.
--
-- App-layer equivalent: lib/listing-status-public.ts + gate G-COMINGSOON.
-- This migration is the defense-in-depth layer beneath it.

begin;

drop policy if exists "Allow public read on listings" on public.listings;
drop policy if exists "Public read listings" on public.listings;

-- One policy, one rule. Matches any casing/spacing the feed sends
-- ("Coming Soon", "ComingSoon", "coming soon").
create policy "Public read listings excludes coming soon"
  on public.listings
  for select
  to anon, authenticated
  using (
    coalesce("StandardStatus", '') !~* 'coming\s*soon'
  );

commit;
