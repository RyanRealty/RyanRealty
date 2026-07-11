-- 20260711210000_listing_alerts_notified_keys.sql
--
-- "New" in a listing alert must mean NEWLY MATCHING THE SEARCH, not newly
-- listed (Matt directive 2026-07-11): a home whose price drops into the
-- subscriber's range, or comes back on market, has never been shown to them —
-- the old OnMarketDate freshness test silently discarded exactly those.
--
-- notified_listing_keys stores the listing keys already emailed (or absorbed
-- as already-matching) per alert row. The send engine diffs current matches
-- against this set; the DAL caps it at the newest 1,000 keys so standing
-- searches that run for years stay bounded. Rows created before this column
-- keep the timestamp heuristic for one cycle, then migrate onto the set
-- automatically (app/actions/saved-search-alerts.ts).
--
-- PROD APPLY NOTE (2026-07-11): applied to hosted dwvlophlbvvygjfxcrhm in the
-- same session. Purely additive.

ALTER TABLE public.listing_alerts
  ADD COLUMN IF NOT EXISTS notified_listing_keys jsonb NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.listing_alerts.notified_listing_keys IS
  'Listing keys already emailed for this alert. The send engine alerts on set-difference (newly matching wins over newly listed), capped at the newest 1,000 by the DAL.';
