---
name: optimize-data-loading
description: "Optimize slow server-side data loading by eliminating redundant DAL calls, creating slim query variants, and parallelizing independent fetches with Promise.all. Use proactively when writing or reviewing page.tsx data loading or lib/data/ DAL functions, or when triaging a slow page load."
---

# Optimize data loading

Adapted from the `optimize-loader` skill in Matt Pocock's `course-video-manager` (reviewed 2026-07-11) — his React Router loaders map to our server components and `lib/data/` DAL functions. The three anti-patterns are identical; the wiring is this repo's.

## Anti-patterns to catch

### 1. Re-fetching data the caller already has

If a page fetches a record (e.g. a listing via the DAL) and then passes just the **ID** to a downstream function that re-fetches the same record internally — change the downstream function's signature to accept the already-fetched object.

```typescript
// BAD — getNeighborhoodStats internally re-fetches the listing to read its subdivision
const listing = await getListingByKey(key)
const stats = await getNeighborhoodStats(key)

// GOOD — pass what was already fetched
const listing = await getListingByKey(key)
const stats = await getNeighborhoodStats({ subdivision: listing.subdivision, city: listing.city })
```

When refactoring signatures, type the parameter as the **minimal shape the function actually reads**, not the full row type. This keeps callers honest and makes the dependency visible.

### 2. Over-fetching nested data

If a consumer only needs IDs, slugs, and one or two display fields but the DAL function selects a wide row (or `*`) — create a slim DAL variant instead of reusing the fat one. `listings` is 589K rows × ~800 fields; wide selects are never free.

Slim variant checklist:

- `.select('...')` names only the columns the consumer reads (mind the mixed-case quoting on `listings` columns)
- `limit` relations/windows to what's displayed (latest N, not all)
- Keep the `where` filters and ordering of the fat variant intact — slim means fewer columns, not different rows
- Prefer the cache tables (`market_pulse_live`, `market_stats_cache`) and MVs (`listing_tile_mv`, `listing_search_mv`) over raw `listings` aggregation — that's the standing CLAUDE.md rule, and it's also the fast path

### 3. Sequential independent fetches

If a page or DAL composition awaits multiple independent calls one after another, parallelize:

```typescript
// BAD — sequential, total time = sum
const pulse = await getMarketPulse({ geoType, geoSlug })
const featured = await getFeaturedListings(city)

// GOOD — parallel, total time = max
const [pulse, featured] = await Promise.all([
  getMarketPulse({ geoType, geoSlug }),
  getFeaturedListings(city),
])
```

Only serialize when a later call genuinely consumes an earlier result. In JSX, pushing independent fetches down into separate `<Suspense>`-wrapped server components achieves the same overlap with streaming.

## Wiring a new slim query (repo rules)

1. Add the function to the right module under `lib/data/` and export it — raw `.from()` outside `lib/data/` fails G1.
2. Wrap it in `unstable_cache` with an explicit key, TTL, and tags, matching the module's existing conventions (check `docs/DAL_INDEX.md` for the house patterns and to confirm no existing function already covers the access path).
3. Refresh the DAL index: `npm run ci:data-access -- --refresh`, commit the regenerated index alongside the code.
4. Verify the page actually got faster in the browser (network panel / server timing), not just in theory.
