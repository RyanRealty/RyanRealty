-- W4.3 (2026-07-22): drop the dark semantic-search stack.
--
-- The pgvector semantic-search feature (migration 20260326143000) shipped a
-- table + RPC that never gained a consumer:
--   * no API endpoint ever called match_listings_semantic (repo-wide grep: the
--     only non-migration hit was a comment in 20260530180000),
--   * the lone writer, lib/data upsertListingEmbedding, itself had zero
--     callers (no embedding generator, no cron, no backfill script), and is
--     deleted in the same commit as this file,
--   * search runs on listing_search_mv full-text + the field registry — no
--     embeddings anywhere in the read path.
--
-- Reads are provably gone before this drop, so no feature-detect is needed.
-- The orchestrator applies this file; code merged alongside it no longer
-- references listing_embeddings.

drop function if exists public.match_listings_semantic(vector(1536), int, text);

drop table if exists public.listing_embeddings;

-- The `vector` extension is intentionally LEFT INSTALLED: dropping an
-- extension is a project-wide action with blast radius beyond this feature
-- (Supabase tooling can hold references), and an unused installed extension
-- costs nothing. If a later audit wants it gone:
--   drop extension if exists vector;
