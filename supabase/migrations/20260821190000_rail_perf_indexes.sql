-- Rail-performance index for the measured multi-second sub:video-tours read
-- (2026-08-21 runtime rail ship class; EXPLAIN ANALYZE traces in the commit).
--
-- The has_virtual_tour candidates query took 1.37s: the existing
-- idx_listings_has_virtual_tour yields ~10K rows across all cities and the
-- City + status filter then discards 97% of them row by row. This
-- city-leading partial index serves the exact shape (City IN (...) +
-- has_virtual_tour = true + ORDER BY "ModificationTimestamp" DESC LIMIT n)
-- as an ordered per-city walk: measured 1368ms -> 416ms cold, and the rail
-- now also runs behind getListingsWithVideosCached (300s), so the cold path
-- is rare.
--
-- NEGATIVE RESULT, do not re-add (measured 2026-08-21): a partial covering
-- index for the city_year_pricing()/city_quarter_sale_to_ask() aggregate
-- (sale_pricing_facts (city_slug, close_date) INCLUDE (...) WHERE
-- product_class='detached' ...) made that RPC WORSE — the planner preferred
-- the index-only scan (est. cost 11.8K vs 38.9K) but random I/O + 15K heap
-- fetches ran 5.75s against the seq scan's 1.77s. The seq scan over 32K pages
-- is the right plan for an 83%-selectivity aggregate; the RPC is SSG-skipped
-- and 6h-cached, and 1.8s cold sits well inside its 4000ms rail budget. The
-- index was built live, measured, and dropped the same hour.
--
-- PROD APPLY NOTE: applied to dwvlophlbvvygjfxcrhm 2026-08-21 as
-- CREATE INDEX CONCURRENTLY via the pg_cron single-statement channel (the MCP
-- connector cannot hold ~106s DDL; the build itself succeeded server-side).
-- This file records the identical end state for fresh environments, where
-- plain CREATE INDEX is fine.

create index if not exists idx_listings_city_vt_modts
  on public.listings ("City", "ModificationTimestamp" desc)
  where has_virtual_tour = true;
