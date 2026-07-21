-- Coming Soon lockdown, follow-up: strip the Coming Soon branches from
-- search_listings_advanced.
--
-- APPLIED TO PRODUCTION 2026-07-21.
--
-- The listings RLS policy (20260721092000) already makes Coming Soon rows
-- invisible to anon, so the RPC returned an empty set — but the dead
-- 'coming_soon' branch still forced a scan that matched nothing and burned the
-- whole 3s anon statement_timeout, which made the compliance test ambiguous
-- (a timeout is not proof of an empty result).
--
-- Rewrites the LIVE definition in place via string substitution so every other
-- line of this large function is preserved byte-for-byte. The guards abort the
-- transaction if the expected text is missing or if any Coming Soon reference
-- survives, so a drifted definition fails loudly instead of silently
-- half-applying.
--
-- After: p_status_filter='coming_soon' returns [] immediately.

DO $mig$
DECLARE
  def text;
  newdef text;
BEGIN
  SELECT pg_get_functiondef(p.oid) INTO def
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname = 'search_listings_advanced';

  IF def IS NULL THEN
    RAISE EXCEPTION 'search_listings_advanced not found';
  END IF;

  -- 1. Drop Coming Soon from the active / active_and_pending OR-chains.
  newdef := replace(def, ' OR l."StandardStatus" ILIKE ''%Coming Soon%''', '');
  -- 2. Neutralise the dedicated coming_soon branch (kept structurally so the
  --    parameter still validates, but it can never match a row).
  newdef := replace(
    newdef,
    'OR (p_status_filter = ''coming_soon'' AND l."StandardStatus" ILIKE ''%Coming Soon%'')',
    'OR (p_status_filter = ''coming_soon'' AND false)'
  );

  IF newdef = def THEN
    RAISE EXCEPTION 'no Coming Soon branches matched — definition changed, aborting';
  END IF;
  IF newdef ILIKE '%Coming Soon%' THEN
    RAISE EXCEPTION 'Coming Soon still present after rewrite, aborting';
  END IF;

  EXECUTE newdef;
END
$mig$;
