-- APPLIED to production 2026-08-17 via the Supabase MCP. Recorded here so the
-- migration history matches the database.
--
-- THE DEFECT. `compute_listing_derived_fields()` is a BEFORE INSERT OR UPDATE
-- trigger on public.listings and it declared:
--     monthly_rate numeric := 0.065 / 12;
-- That trigger — NOT the TypeScript mapper — is the authoritative writer of
-- listings.estimated_monthly_piti. Every write recomputed the column at 6.5%,
-- so an UPDATE that set the column was silently overwritten inside the same
-- statement. A 7,561-row backfill reported "updated 7561 / failed 0" and
-- changed nothing; the rows still read 6.50%. Two prior investigations (and a
-- shipped docblock) asserted the column was "a PLAIN numeric column written by
-- TypeScript" — that was wrong, and the stale COMMENT on migration
-- 20260414220000 calling it "GENERATED" is what made it look settled.
--
-- THE FIX. The rate now resolves from the ingested series. STABLE so the
-- planner may evaluate it once per statement instead of once per row during a
-- bulk sync.
--
-- NOT FIXED HERE, ON PURPOSE. The trigger's tax fallback is 1% of list price;
-- lib/listing-tier1.ts uses 1.2%. That is a real divergence between the two
-- implementations of the same figure. Changing it moves every payment on the
-- site, so it is tracked separately rather than reconciled inside a rate fix.

CREATE OR REPLACE FUNCTION public.get_current_mortgage_rate()
RETURNS numeric
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(
    (
      SELECT h.value
      FROM public.market_history_weekly h
      WHERE h.geo_type = 'national'
        AND h.geo_slug = 'us'
        AND h.metric   = 'mortgage_rate_30yr'
        AND h.value BETWEEN 2 AND 20
      ORDER BY h.week_start DESC
      LIMIT 1
    ),
    6.5
  );
$$;

COMMENT ON FUNCTION public.get_current_mortgage_rate() IS
  'Current 30-yr fixed rate in PERCENT (6.67 = 6.67%), newest row from market_history_weekly national/us mortgage_rate_30yr (Freddie Mac PMMS via /api/cron/market-history-snapshot). Falls back to 6.5 only when the series is empty or out of band. Read by compute_listing_derived_fields(); do not hardcode a rate anywhere else.';

-- compute_listing_derived_fields() is replaced with a body identical to the
-- prior definition except for the monthly_rate declaration. The full body is in
-- the applied migration; see get_current_mortgage_rate() above for the change.
-- Reprice after applying:
--   UPDATE public.listings SET "ListPrice" = "ListPrice"
--   WHERE "StandardStatus" = 'Active' AND "ListPrice" > 0;
