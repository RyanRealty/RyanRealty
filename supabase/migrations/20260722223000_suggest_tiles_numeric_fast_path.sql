-- Numeric fast path for search suggestions (W4.1 follow-through, 2026-07-22).
--
-- A purely numeric suggestion query ("3480") is pathological for the
-- listing_tile_mv search_vector GIN index: every address number shares the
-- token prefix, so '3480:*' costs 1.35-1.75s at origin (vs 0.11s for
-- 'awbrey:*'), transiently past the anon 3s statement_timeout. When it timed
-- out, the empty fail-soft result was pinned by the route's s-maxage and the
-- client suggestion cache — an empty dropdown for every user for up to 12
-- minutes.
--
-- searchListingSuggestTiles now routes numeric input to street_number /
-- postal_code prefix LIKE instead of tsvector. text_pattern_ops btree indexes
-- make those prefix scans index-range reads. Plain CREATE INDEX (not
-- CONCURRENTLY): migrations run in a transaction and the MV write-lock during
-- apply is brief.
--
-- MV refresh note: indexes on a materialized view persist across REFRESH
-- MATERIALIZED VIEW (CONCURRENTLY included) — no refresh-pipeline change.
--
-- Target is listing_tile_mv_src — the actual materialized view. The
-- listing_tile_mv NAME is the coming-soon-lockdown security view over it
-- (migration 20260721164833), and Postgres cannot index a plain view; the
-- planner pushes the view's predicate down to the src MV's indexes.

create index if not exists idx_listing_tile_mv_street_number_prefix
  on public.listing_tile_mv_src (street_number text_pattern_ops);

create index if not exists idx_listing_tile_mv_postal_code_prefix
  on public.listing_tile_mv_src (postal_code text_pattern_ops);
