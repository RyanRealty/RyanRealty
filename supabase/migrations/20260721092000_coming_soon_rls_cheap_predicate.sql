-- Coming Soon lockdown, follow-up: make the RLS predicate cheap.
--
-- APPLIED TO PRODUCTION 2026-07-21.
--
-- INCIDENT: the policy created in 20260721090000 used a case-insensitive REGEX
--   coalesce("StandardStatus",'') !~* 'coming\s*soon'
-- evaluated per row on a 589K-row table. The `anon` role has a hard
-- statement_timeout of 3s (service_role 120s, authenticated 8s). The
-- search_listings_advanced RPC needs ~6.7s on a COLD run even as service_role,
-- so it already sat at the edge of anon's budget; the regex pushed cold runs
-- over it and they began returning 57014 (statement timeout).
--
-- Cold-run fragility of that RPC is PRE-EXISTING, not caused by this work —
-- app/search/[...slug]/page.tsx already wraps it in a 12s timeout with a
-- degraded fallback, and the primary search path is listing_search_mv, not the
-- RPC. This migration removes the extra cost this lockdown added.
--
-- Replacement: lower() + an ANCHORED LIKE ('coming%soon%' — no leading
-- wildcard, no regex engine). Same coverage for every spelling the feed can
-- send: 'Coming Soon', 'ComingSoon', 'coming soon', 'Coming Soon - Pending'.
--
-- Measured after (anon): listing detail 57-85ms, indexed city query 105ms,
-- warm search RPC 1.4s.
--
-- No supporting index: the predicate is a NEGATIVE match satisfied by ~99.99%
-- of rows, so an index would be strictly worse than the seq-scan filter.

drop policy if exists "Public read listings excludes coming soon" on public.listings;

create policy "Public read listings excludes coming soon"
  on public.listings
  for select
  to anon, authenticated
  using (
    lower(coalesce("StandardStatus", '')) not like 'coming%soon%'
  );
