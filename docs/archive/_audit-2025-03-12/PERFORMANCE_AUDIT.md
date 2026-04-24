# RyanRealty — Speed & Performance Audit

**Date:** March 2025  
**Focus:** Code audit for speed improvements.

---

## Implemented (quick wins)

- **Parallelized geocode calls** — `app/listings/page.tsx` and `app/search/[...slug]/page.tsx` now run `getGeocodedListings(listings)` and `getGeocodedListings(mapListingsRaw)` in a single `Promise.all`, so both batches run in parallel instead of sequentially.
- **Loading skeletons** — Added `loading.tsx` for `app/search/[...slug]/`, `app/reports/`, `app/area-guides/`, and `app/open-houses/` so the shell appears immediately and layout shift is reduced.
- **Lighter count queries** — In `app/actions/listings.ts`, count-only queries now use `select('ListingKey', { count: 'exact', head: true })` (or `listing_key` for `listing_history`) instead of `select('*', ...)` to reduce work.
- **Lower map default** — `getListingsForMap` default `mapLimit` reduced from 2000 to 1000 (cap still 3000 when explicitly passed).
- **ListingTile memo** — `components/ListingTile.tsx` is wrapped in `React.memo` to cut re-renders in search, feed, and listings grids.

---

## Executive summary

**Top 5–7 high-impact improvements**

1. **Cache and dedupe `getBrowseCities()`** — Called from many places (sitemap, search, home, cities, banners, etc.); each call runs a query with `limit(50000)`. Wrap in `unstable_cache` (e.g. 5–10 min) and reuse; avoid re-fetch in `getCityFromSlug` when you already have the list.
2. **Reduce geocoding load and sequential work** — `getGeocodedListings()` issues one Google request per listing missing lat/lng (up to 200 on home, more on search/listings). Add in-DB or in-memory caching for geocode results, batch where possible, and run the two `getGeocodedListings` calls on listings and map listings **in parallel** on `/listings` and search.
3. **Parallelize and cache home/secondary fetches** — On the home page, run `getGeocodedListings(mapListingsRaw)` and `getEngagementCountsBatch(allListingKeys)` in parallel with each other. Batch or cache `getOrCreatePlaceBanner` for community highlights instead of N separate calls.
4. **Add `loading.tsx` for heavy routes** — Add for `/search/[...slug]`, `/`, `/reports`, `/open-houses`, `/area-guides`, and other data-heavy routes so the shell appears immediately and layout shift is minimized.
5. **Lazy-load heavy client libs (maps, charts)** — Use `next/dynamic` for map and chart components (`ListingMapGoogle`, `SearchMapClustered`, `ExploreClient` / recharts) so the main bundle stays smaller and map/chart JS loads after first paint.
6. **Optimize listing key resolution** — `getListingByKey` can run many sequential DB calls; prefer a single indexed lookup and dedupe the listing fetch between `generateMetadata` and the page.
7. **Tighten count and map queries** — Use `select('ListingKey', { count: 'exact', head: true })` instead of `select('*', ...)` for count-only queries. Cap `getListingsForMap` default (e.g. 500–1000) where full 2000 isn’t needed.

---

## 1. Data fetching & server

### Sequential / waterfall fetches

- **`app/page.tsx` (home)** — After first `Promise.all`, `getGeocodedListings(mapListingsRaw)` then `getEngagementCountsBatch(allListingKeys)` run sequentially. Second block does per-community `getOrCreatePlaceBanner` (up to 6 calls). **Fix:** Run geocode and engagement in parallel; batch or cache banner lookups.
- **`app/listings/page.tsx`** — `getGeocodedListings(listings)` then `getGeocodedListings(mapListingsRaw)` are sequential. **Fix:** `Promise.all([getGeocodedListings(listings), getGeocodedListings(mapListingsRaw)])`.
- **`app/search/[...slug]/page.tsx`** — Second geocode batch runs after the first; `getCitiesForIndex()` refetched for map view. **Fix:** Include both geocode calls in same `Promise.all`; pass or cache cities.

### Missing caching

- **`getBrowseCities()`** (`app/actions/listings.ts`) — No `unstable_cache`; used by sitemap, search, home, cities, banners, geo. Query `limit(50000)`. **Fix:** Wrap in `unstable_cache(..., { revalidate: 300 })`.
- **Listing detail** — `generateMetadata` and page may both fetch listing; rely on request deduplication or fetch once.

### Over-fetching / N+1

- **Count queries** — Several use `select('*', { count: 'exact', head: true })`. **Fix:** Use `select('ListingKey', { count: 'exact', head: true })`.
- **`getListingByKey`** — Up to 4 sequential Supabase calls per `tryKey`; slug loop can repeat. **Fix:** Prefer one canonical key and single query.
- **Search hot-community banners** — Up to 10 separate `getBannerUrl` calls. **Fix:** Batch or cache.

### Heavy queries

- **`getListingsForMap`** — Default `mapLimit` up to 2000; search/listings don’t pass limit. **Fix:** Lower default to 500–1000 or pass explicit limit.

---

## 2. Client bundle & code splitting

- **`@react-google-maps/api`** — Used in ListingMapGoogle, ListingDetailMapGoogle, SearchMapClustered, MapListingsPage, CommunityMap; all statically imported. **Fix:** `next/dynamic` with `ssr: false` for map components.
- **`recharts`** — Used in ExploreClient, SalesReportCharts, CommunityMarketStats, CityMarketStats. **Fix:** Dynamically import chart components.
- **`@react-pdf/renderer`** — Server-only; no client change.

---

## 3. Images & media

- **next/image** — Config and priority/sizes generally good. Hero, listing hero, and above-the-fold images use `priority` and appropriate `sizes`.
- **Raw video** — HomeHero and search hero use `<video>`; acceptable. Optional: `preload="metadata"` to save bandwidth.

---

## 4. Rendering & React

- **ListingTile** — Not wrapped in `React.memo`; long lists (search, feed) can re-render often. **Fix:** `React.memo(ListingTile)`.
- **FeedInfiniteList / SearchResults** — No virtualization; 50+ items all in DOM. **Fix:** Consider `@tanstack/react-virtual` for long lists.
- **Client vs server** — Heavy features (maps, charts) should stay behind dynamic imports; no full-page conversions required.

---

## 5. Routing & loading

- **Root layout** — `dynamic = 'force-dynamic'`; awaits `getSession()` and `getBrokerageSettings()` so every request blocks on those. Consider root `loading.tsx` for a minimal shell.
- **Missing loading.tsx** — Add for: `app/search/[...slug]/`, `app/reports/`, `app/open-houses/`, `app/area-guides/`, and optionally home, buy, sell, team, contact, about.

---

## 6. Build & config

- No bundle analyzer. **Fix:** Add `@next/bundle-analyzer` in dev to verify map/chart lazy-loading.
- Dependencies (recharts, maps, pdf) are substantial but justified; lazy-load entry points.

---

## Quick wins (implement first)

1. Parallelize the two `getGeocodedListings` calls on listings and search pages.
2. Add `loading.tsx` for search, reports, open-houses, area-guides (and optionally home).
3. Count queries: use `select('ListingKey', { count: 'exact', head: true })` in listings actions.
4. Lower default `mapLimit` in `getListingsForMap` (e.g. 1000) or pass 500/1000 from search and listings.
5. Wrap `ListingTile` in `React.memo`.

---

## Medium effort

1. Cache `getBrowseCities` with `unstable_cache`.
2. Dynamic import for map and chart components.
3. Geocode caching (short TTL or DB) keyed by address.
4. Batch banner lookups for community highlights.

---

## Larger refactors

1. `getListingByKey`: reduce to one or two queries; single canonical key.
2. Root layout: root `loading.tsx` and/or streaming so session/brokerage don’t block shell.
3. Virtualize FeedInfiniteList and SearchResults for 50+ items.
4. Home page: one coherent parallel block (geocode + engagement + banner batch) and cached cities/banners.
