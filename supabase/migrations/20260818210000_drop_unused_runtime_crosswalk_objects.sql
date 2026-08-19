-- Runtime crosswalk 2026-08-18: drop unused hosted leftovers.
-- Hosted probe (service-role supabase-js against dwvlophlbvvygjfxcrhm,
-- 2026-08-18): trending_scores exists with 0 rows; get_homepage_market_stats
-- is still in PostgREST OpenAPI. Neither has an app/, cron, or script reader.
-- Idempotent. Not applied in this pass — later push.

-- 1) trending_scores
-- Created speculatively in 20260309100007. 20260330100006 already DROPped it;
-- hosted still exposes the relation (0 rows, no last write). Trending Homes
-- reads listing_views via get_trending_listing_keys, not this table.
DROP TABLE IF EXISTS public.trending_scores CASCADE;

-- 2) get_homepage_market_stats(text)
-- March 2026 homepage single-scan RPC. Zero .rpc() callers (types/database.ts
-- only). Live homepage / city stats read market_pulse_live via the DAL.
-- Body is a listings seq-scan; keep the definition in
-- 20260314120000_homepage_market_stats_rpc.sql if it is ever needed again.
DROP FUNCTION IF EXISTS public.get_homepage_market_stats(text);
