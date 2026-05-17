-- ============================================================================
-- 20260515200000_db_canonical_reference_table_comments.sql
--
-- Layer 5 of the "every agent reads the doc" enforcement system.
--
-- Embeds the canonical-reference pointer (docs/DATABASE_FOR_AI_AGENTS.md) into
-- PostgreSQL table-level COMMENTs so any agent introspecting via psql \d,
-- Supabase Studio, pg_class, or information_schema sees the pointer at the
-- schema level — independent of whether the agent loaded CLAUDE.md, .cursor/
-- rules, or the SKILL.md.
--
-- See also (the other 5 enforcement layers):
--   1. .cursor/rules/database-canonical-reference.mdc (alwaysApply: true) —
--      forces Cursor to surface the rule in every session
--   2. .cursor/rules/supabase-data-layer.mdc — globs-targeted "Read first" block
--   3. CLAUDE.md (top of file) — pointer in the Data Accuracy rule block
--   4. .cursor/skills/database-canonical-reference/SKILL.md — auto-trigger on
--      market-report / listings / SQL / Supabase / community keywords
--   5. THIS FILE — schema-level table comments
--   6. supabase/README.md — pointer at the top of the migration entry-point
-- ============================================================================

COMMENT ON TABLE public.listings IS
'AGENTS: Read docs/DATABASE_FOR_AI_AGENTS.md before querying. Mixed-case columns ("ListingKey", "ListPrice", "StandardStatus", "City", "SubdivisionName") MUST be double-quoted. Don''t SELECT * or SELECT details on hot paths. For market reports use public.market_stats_cache or public.market_pulse_live — never aggregate this table directly.';

COMMENT ON TABLE public.market_stats_cache IS
'AGENTS: Period-anchored cache for market reports. Read docs/DATABASE_FOR_AI_AGENTS.md §0 + §3 before querying. One row per (geo_type, geo_slug, period_type, period_start). Refreshed every 6h by /api/cron/refresh-market-stats. Methodology version stamped on every row — current is v4-2026-05-15. geo_type: city|region|neighborhood|subdivision. For resort communities (Tetherow, Sunriver, Eagle Crest, etc.) use geo_type=neighborhood with bare slug.';

COMMENT ON TABLE public.market_pulse_live IS
'AGENTS: Live inventory snapshot for market reports. Read docs/DATABASE_FOR_AI_AGENTS.md §0 + §3 before querying. One row per (geo_type, geo_slug, property_type). Refreshed every 10-15 min by refresh_market_pulse() called from sync-delta cron. Currently city + region only — NOT neighborhoods. For neighborhood-level live inventory use market_stats_cache.end_of_period_inventory from the freshest period.';

COMMENT ON TABLE public.boundaries IS
'AGENTS: PostGIS polygons for cities (TIGER), neighborhoods (City of Bend GIS + 14 resort communities), subdivisions (Deschutes County GIS plats). Read docs/DATABASE_FOR_AI_AGENTS.md §2a before querying. Registry source-of-truth for resort communities: data/resort-communities.json.';

COMMENT ON TABLE public.neighborhood_subdivisions IS
'AGENTS: Parent→child SubdivisionName aliases for resort/neighborhood market reports. Read docs/DATABASE_FOR_AI_AGENTS.md §3a before querying. Each (neighborhood_slug, subdivision_label) row maps an MLS SubdivisionName to its parent community. Don''t invent aliases — query this table for the canonical list.';

COMMENT ON TABLE public.subdivision_flags IS
'AGENTS: is_resort flag per community. entity_key format is "city:slug" (e.g. bend:tetherow). Read docs/DATABASE_FOR_AI_AGENTS.md §2a + §3a. Used by getMarketStatsForSubdivision() to route resort communities to neighborhood-level cache.';

COMMENT ON TABLE public.cache_methodology_definitions IS
'AGENTS: Audit trail for every cache row. Each version (v3-2026-05-07, v4-2026-05-15, ...) documents the geography rule, property-type filter, manual overrides. Every cache row in market_stats_cache and market_pulse_live carries methodology_version. Read docs/DATABASE_FOR_AI_AGENTS.md §6 before changing methodology.';
