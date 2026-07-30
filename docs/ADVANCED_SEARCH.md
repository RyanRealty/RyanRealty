# Site search architecture

One registry-driven search engine serves every consumer listing-search surface. This doc
replaced the obsolete `search_listings_advanced`-centric writeup on 2026-07-29 (Phase 0 of
`docs/plans/SEARCH_OPTIMIZATION_PLAN_2026-07-29.md`).

## The three pillars

1. **`lib/search/field-registry.ts`** — the single source of truth for every consumer
   filter: **87 fields** (11 range, 33 boolean, 38 multi-select, 5 text) across 16
   categories. Each `SearchFieldDef` carries the URL param name(s), the
   `listing_search_mv` column, the widget kind, multi-select options (harvested from live
   on-market data, prevalence-ordered), and voice/NL synonyms. `ALL_SEARCH_URL_PARAMS`
   enumerates every URL param; `coerceRegistryParams()` turns raw params into typed DAL
   filters. (`laundryFeatures` was removed 2026-07-29: zero on-market rows carried a
   value, verified against all 9,663 `listing_search_mv` rows.)
2. **`public.listing_search_mv`** — the on-market materialized view (~9.7K rows: Active,
   Active Under Contract, Coming Soon, Pending) carrying every `listing_tile_mv` column
   plus the full registry filter surface: promoted `*_yn` booleans, HOA/tax/PITI
   numerics, school names, and `rr_feature_keys()` text[] projections of the RESO
   feature objects.
3. **`searchListingsAll()`** (`lib/data/listings/searchListingsAll.ts`) — the one DAL
   search function over the MV. Zod filter schema keyed by registry field keys,
   resilient cache, exact count in the same query. Predicates resolve from the registry
   (matchMode `all` -> contains, default -> overlaps, `singleColumnIn` -> IN,
   `dalExpression` -> multi-column expression).

## Surfaces (all render the same registry sheet)

| Surface | Route file | Filter UI |
|---|---|---|
| `/homes-for-sale` (query-param search, split/list/map) | `app/search/page.tsx` | `components/search/SearchFilters.tsx` chip bar |
| `/homes-for-sale/{city}[/{area}][/{preset}]` (SEO grid + map views) | `app/search/[...slug]/page.tsx` | `components/SearchFilterBar.tsx` chip bar |

Both chip bars open **`components/search/AllFiltersSheet.tsx`**, the registry-driven
All-filters sheet, and render active filters through `activeRegistryFilters()` /
`RegistryFilterChip`. A multi field with zero options is hidden by the sheet. The old
hand-rolled `components/AdvancedSearchFilters.tsx` was deleted 2026-07-29.

Voice + natural-language input (`lib/parse-search-query.ts`) compiles its matchers from
the registry, so a new field is speakable the day it ships. Saved searches whitelist
their filter keys from the registry too (`FILTER_KEYS` in `lib/search-filters.ts`).

## Server routing (`getListingsWithAdvanced` in `app/actions/listings.ts`)

- **On-market scopes** (active / active_and_pending / pending): every filter, the full
  registry surface included, is served from `listing_search_mv` via
  `searchListingsAll()` in one indexed read with an exact count. No RPC.
- **Closed / `all` scopes** keep the legacy routing: the slim `listing_tile_mv` fast
  path for flat-column filters, falling back to the heavy `search_listings_advanced`
  RPC only for jsonb-derived feature filters or pagination deeper than the fast-path
  cap. The RPC survives solely for these off-market scopes.
- Degraded reads fail loud (poison-null protection): an unfiltered city scope returning
  zero signals `degraded` so the page serves the last good ISR copy instead of caching
  an empty grid.

## Alerts and saved searches

- **`public.listing_alerts`** is the ONE canonical alert table (unified 2026-07-07 by
  migration `20260707160000_unify_listing_alerts.sql`; DAL:
  `lib/data/leads/listingAlerts.ts`). Guest captures, signed-in saves, broker assigns,
  and system defaults all live here, matched hourly by
  `app/api/cron/saved-search-alerts/route.ts`.
- **`public.saved_searches`** survives ONLY for the public-share feature (`is_public`,
  `public_title`, `cache_listing_keys`, `public_click_count`). It no longer drives
  alerts.

## Adding a filter field

1. Confirm the column exists in `listing_search_mv` and carries real values on
   on-market rows (CLAUDE.md §0: no filter ships that matches nothing).
2. Add the `SearchFieldDef` to `lib/search/field-registry.ts` (options harvested from
   live data, noise values dropped, voice synonyms included).
3. Add the matching zod key to `featureShape` in
   `lib/data/listings/searchListingsAll.ts` (plus a predicate entry if it is a
   `dalExpression` boolean).
4. The sheet, chips, URL params, voice parser, and saved-search whitelist pick it up
   from the registry with no further edits. `lib/search/field-registry.test.ts` guards
   the invariants.
