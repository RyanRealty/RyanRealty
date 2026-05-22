# ADR-001: Ryan Realty Data Layer — Sub-1s LCP Architecture

**Status:** Proposed
**Date:** 2026-05-21
**Scope:** Listing detail, city/neighborhood/community LP routes, homepage

---

## Performance targets

| Route | TTFB p50 | TTFB p95 | LCP |
|---|---|---|---|
| Listing detail | < 80ms | < 200ms | < 1500ms |
| City / neighborhood / community LP | < 100ms | < 300ms | < 2000ms |
| Homepage | < 60ms | < 120ms | < 1800ms |
| Search results | < 100ms | < 200ms | < 2500ms |

---

## Current state — the bugs

- **Listing detail**: 9+ serial round-trips. ~135ms pure network latency before any query time. Cold TTFB 250–400ms.
- **City LP**: `.ilike('City', name)` does NOT use the `lower(trim("City"))` expression index. Sequential scan on 589K rows. Cold TTFB 2–5s.
- **Community LP**: Same `.ilike` bug + a second full scan for pending counts. Cold TTFB 1–3s.
- **Neighborhood LP**: 4-hop serial chain through `properties` (which has 0 rows). Returns empty for every neighborhood.
- **Zero materialized views** anywhere in the schema.
- **Missing indexes**: `(SubdivisionName, City, StandardStatus)`, trgm GIN on City/SubdivisionName, `ListAgentEmail`, all-listing geospatial, address slug.

---

## Decision: 4 materialized views + 5 indexes + ILIKE→EQ rewrite

### MV 1 — `listing_tile_mv`
Compact projection per listing for tiles + cards. Replaces 50+ column projection. Address slug pre-computed. Geospatial point pre-computed. Refreshed `CONCURRENTLY` on every Spark sync (~8s).

### MV 2 — `geo_snapshot_mv`
One row per city + per community with active count, median list price, pending count, community count, banner URL. Replaces the paginated full scan in city LP. Refreshed on Spark sync (~4s).

### MV 3 — `listing_detail_mv`
Wide pre-joined row per listing: full RETS fields + photos JSONB + agent fields + community context (3-hop join pre-resolved). Refreshed per-row via trigger on listings INSERT/UPDATE.

### MV 4 — `similar_listings_mv`
Precomputed nearest 12 per active listing. Scope to `StandardStatus = 'Active'` only (~2K rows). Refreshed nightly.

### Missing indexes (all CONCURRENTLY, no downtime)

```sql
CREATE INDEX CONCURRENTLY idx_listings_sub_city_status
  ON public.listings ("SubdivisionName", "City", "StandardStatus");

CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX CONCURRENTLY idx_listings_city_trgm
  ON public.listings USING gin ("City" gin_trgm_ops);
CREATE INDEX CONCURRENTLY idx_listings_subdivision_trgm
  ON public.listings USING gin ("SubdivisionName" gin_trgm_ops);

CREATE INDEX CONCURRENTLY idx_listings_list_agent_email
  ON public.listings ("ListAgentEmail")
  WHERE "ListAgentEmail" IS NOT NULL;

CREATE INDEX CONCURRENTLY idx_listings_city_active_tile
  ON public.listings ("City", "StandardStatus", "ModificationTimestamp" DESC NULLS LAST,
    "ListPrice", "BedroomsTotal", "BathroomsTotal", "TotalLivingAreaSqFt",
    "SubdivisionName", "PhotoURL", "StreetNumber", "StreetName",
    "PostalCode", "Latitude", "Longitude")
  WHERE "StandardStatus" IN ('Active', 'Coming Soon', 'Active Under Contract', 'Pending');
```

---

## Step 1 — Zero-risk ILIKE → EQ rewrite (DO THIS FIRST)

Replace every `.ilike('"City"', name)` with `.eq('"City"', exactName)` using the canonical name from a known list. Same for `SubdivisionName`. See `/tmp/ILIKE_TO_EQ_PATCH.md` for the full patch — ~52 call sites, mechanical fix, 60-80% TTFB improvement immediately.

**No schema changes. No migrations. Reversible by single git revert.**

---

## Migration plan

1. **Step 1 (today, zero-risk):** Apply ILIKE → EQ patch. Ship. Measure.
2. **Step 2 (this week):** Add 5 missing indexes CONCURRENTLY.
3. **Step 3:** Create `listing_tile_mv` + indexes. Refactor tile reads to use it.
4. **Step 4:** Create `geo_snapshot_mv`. Refactor city/community LP header stats.
5. **Step 5:** Wire MV refresh into post-sync pipeline (`/api/cron/sync-delta`). Fallback `*/30` cron.
6. **Step 6:** Create `listing_detail_mv` + per-row re-insert trigger. Refactor listing detail reads.
7. **Step 7:** Backfill `boundary_neighborhood` via `tag_all_listings_boundaries()`. Add per-row tagging trigger. Refactor neighborhood LP.
8. **Step 8:** Create `similar_listings_mv`. Refactor similar listings reads.
9. **Step 9:** Add Redis address-slug caching (10-min TTL) for listing-key resolution.
10. **Step 10:** Add Supabase Realtime subscription on `activity_events` for homepage activity feed.

Each step is independently deployable and reversible. No big-bang migration.

---

## Search infrastructure decision

**PostgreSQL FTS on `listing_tile_mv`. No external search service.**

```sql
-- Add to listing_tile_mv:
search_vector tsvector GENERATED ALWAYS AS (
  setweight(to_tsvector('english', coalesce(street_number, '')), 'A') ||
  setweight(to_tsvector('english', coalesce(street_name, '')), 'A') ||
  setweight(to_tsvector('english', coalesce(city, '')), 'B') ||
  setweight(to_tsvector('english', coalesce(subdivision_name, '')), 'B') ||
  setweight(to_tsvector('english', coalesce(postal_code, '')), 'C')
) STORED;

CREATE INDEX listing_tile_mv_search ON public.listing_tile_mv USING gin (search_vector);
```

Algolia / Typesense are not justified at our query volume.

---

## Real-time decision

**Supabase Realtime on `activity_events` (385 rows) for homepage activity feed. No SSE, no polling.**

Client component subscribes to INSERT events, prepends to feed, slices to 10. SSR renders initial state.

---

## Risk register

| Risk | Mitigation |
|---|---|
| `listing_detail_mv` ~3 GB storage | Cap photos JSONB to 20 items in MV; full array fetched on-demand only |
| MV refresh delays sync completion | `CONCURRENTLY` doesn't lock reads; defer 30s after sync completes |
| Per-row trigger breaks under concurrent updates | Use `ON CONFLICT (listing_key) DO UPDATE` not DELETE+INSERT |
| `tag_all_listings_boundaries()` OOM on 589K rows | Batch 10K rows with `pg_sleep(0.1)` between batches |
| Stale MV if cron silently fails | Add `refreshed_at` column to each MV; alert if stale > 1h |
| Vercel ISR not invalidating after MV refresh | Call `revalidateTag()` from post-sync pipeline |
