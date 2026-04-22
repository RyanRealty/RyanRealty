<!--
  DATA ARCHITECTURE PLAN - Ryan Realty
  Last content update: 2026-04-05 (architecture narrative in body below)
  Header reconciled: 2026-04-22 — execution status removed from this header

  IMPORTANT - STATUS IS NOT MAINTAINED IN THIS FILE.

  Phase/task status lives in `docs/plans/task-registry.json` (BL-009 through
  BL-018 correspond to Phases 1-13 in this document, see mapping below).
  Use `npx tsx scripts/orchestrate.ts next` to see the next open task.
  Do not trust any status stamp in this file's body - the body is the
  architecture reference, not the tracker.

  PHASE-TO-BACKLOG MAPPING:
  - Phase 0A/0B: Documentation + cursor rules (complete; task-registry: BL-006, BL-007, BL-008)
  - Phase 1:  Schema foundation        -> BL-009
  - Phase 2:  Stats computation RPCs   -> BL-010
  - Phase 3:  URL migration            -> BL-011
  - Phase 4:  Geographic hierarchy     -> BL-012
  - Phase 5:  Breadcrumbs              -> BL-013
  - Phase 6:  Listing detail perf      -> BL-014
  - Phase 7:  Search/city/community    -> BL-015
  - Phase 8+9: Cache + historical      -> BL-016
  - Phase 10+11: CMA + reports         -> BL-017
  - Phase 12+13: Cleanup + verify      -> BL-018
-->

# Data Architecture, Performance, and SEO Optimization Plan

## Research Foundation

This plan is grounded in documented best practices from authoritative sources, not guesses. A cursor rule (`.cursor/rules/data-architecture.mdc`) will be created as the first execution step to codify these decisions so no future agent contradicts them.

### Sources Consulted
- **PostgreSQL 16**: CREATE INDEX, Partial Indexes, JSONB Types, Aggregate Functions (percentile_cont), Materialized Views, statement_timeout
- **PostGIS**: ST_DWithin radius search FAQ, spatial index strategies
- **Supabase**: Query Optimization, Debugging Performance, Row Level Security, Connection Pooling (Supavisor), pg_cron, Data REST API / PostgREST
- **Next.js 16**: Caching (Cache Components), Revalidating, Fetching Data, Streaming, Metadata (generateMetadata deduplication via React.cache), Server/Client Components
- **Google Search Central**: URL Structure, SEO Starter Guide, Breadcrumb Structured Data, Product Structured Data, Canonicalization, Faceted Navigation
- **Industry analysis**: Zillow, Redfin, Realtor.com URL patterns and structured data

### Key Research-Backed Decisions

**1. Summary tables over materialized views (PostgreSQL docs)**
PostgreSQL `REFRESH MATERIALIZED VIEW` blocks readers unless `CONCURRENTLY` is used, which requires a unique index and can only run one at a time. For incremental per-geography updates on a 15-minute cycle, summary tables with `INSERT ... ON CONFLICT DO UPDATE` are the documented correct pattern. The existing `market_stats_cache` table design is correct -- the computation that fills it is wrong.

**2. percentile_cont does not parallelize (PostgreSQL docs, Table 9.61)**
Ordered-set aggregates including `percentile_cont` have `Partial Mode: No`. Computing true medians at request time over 100K+ rows will never be fast. Pre-computation into summary tables is a performance requirement, not a preference.

**3. JSONB width increases I/O even when not projected (PostgreSQL docs, Section 8.14)**
PostgreSQL reads the full heap tuple including TOAST pointers. Wide JSONB columns increase I/O per row on sequential scans even when the query only projects scalar columns. Promoting hot fields to top-level columns and excluding `details` from tile selects is backed by documentation.

**4. ST_DWithin is index-friendly; ST_Distance is not (PostGIS FAQ)**
The PostGIS radius search FAQ explicitly states `ST_DWithin` leverages spatial indexes while `ST_Distance` filtering does not. The current CMA RPC correctly uses `ST_DWithin`.

**5. Partial indexes must match query predicates exactly (PostgreSQL docs, Section 11.8)**
PostgreSQL's planner has "no general theorem prover." Parameterized queries (`WHERE status = $1`) may not match a partial index predicate (`WHERE status = 'Closed'`). Index predicates must be written to match how queries are actually constructed.

**6. React.cache for generateMetadata deduplication (Next.js 16 docs)**
The Next.js Metadata documentation explicitly recommends wrapping shared data fetches in `React.cache()` so `generateMetadata` and the page component share one execution per request. This is the documented solution for the duplicate `getListingDetailData` call.

**7. URL structure: stable ID + address slug (Google + industry)**
Google states keywords in URLs have "very little ranking effect." Zillow, Redfin, and Realtor.com all use internal stable IDs plus address slugs. For Ryan Realty, `ListNumber` (MLS ID) is both stable and recognizable to users, making it the right choice for the URL identifier. The address slug provides human readability.

**8. BreadcrumbList must match visible breadcrumbs (Google docs)**
Google's Breadcrumb structured data documentation explicitly requires that JSON-LD `BreadcrumbList` match the visible breadcrumb trail on the page. Mismatches can result in markup being ignored or flagged.

**9. Product + Offer is the documented rich-result path (Google docs)**
Google has NO documented rich-result type for `RealEstateListing` (schema.org type exists but no Google Search Central guide). The documented path for listing-page enrichment is `Product` + `Offer` with `BreadcrumbList`. `RealEstateListing` and `SingleFamilyResidence` add semantic clarity but have no guaranteed rich-result treatment.

**10. Supabase has no query-result cache (Supabase docs)**
PostgREST maintains a schema cache, not row-level query caching. All caching must be at the application layer (Next.js ISR, `unstable_cache`, or `use cache` directive). This is why every public page needs `revalidate` and why summary tables are critical.

---

## Documentation Conflicts (Must Be Resolved Before Code Changes)

The codebase has **three competing URL narratives** and multiple stale/conflicting documents. If we change code without updating documentation, future agents will get contradictory instructions and undo our work.

### Conflict 1: Three URL Narratives

| Source | Listing URL Pattern | Status |
|--------|-------------------|--------|
| `seo-url-guardrails.mdc` + `AGENTS.md` | `listingDetailPath()` -> `/homes-for-sale/{city}/{community}/{key}-{zip}` | Currently enforced in code |
| `master-plan.md` Phase 0.1 | `/listing/{listingKey}-{slug}` | Written as spec, never fully implemented |
| `URL_ARCHITECTURE.md` | `/real-estate/us/oregon/{city}/{neighborhood}/{community}/{listing}` | Future-state doc, never implemented |
| `FEATURES.md` / `SEO.md` | `/search/{city}`, `/listing/[listingKey]` | Stale, references old routes |

**Resolution:** The new plan's URL scheme (`/homes-for-sale/{city}/{optional-neighborhood}/{community}/{address}-{mls}`) must become THE canonical spec. All other documents must be updated to reference it. Phase 0.1 in master-plan.md, URL_ARCHITECTURE.md, FEATURES.md, and SEO.md must all be reconciled.

### Conflict 2: Market Stats API References

| Source | What It Says |
|--------|-------------|
| `supabase-data-layer.mdc` | Use `getCachedStats` / `getLiveMarketPulse`, not `getCityMarketStats` |
| `master-plan-protocol.mdc` CR-5 | Same: use cached stats, not `getCityMarketStats` |
| `REPORTING_AND_ANALYTICS.md` | Describes RPCs like `get_city_period_metrics` as a parallel system |
| Actual code | `getCityMarketStats` is still imported and used as a fallback in several places |

**Resolution:** The plan removes `getCityMarketStats` entirely (Phase 12). All docs already say don't use it. The code needs to catch up.

### Conflict 3: Geographic Hierarchy Terminology

| Source | Term Used | Meaning |
|--------|----------|---------|
| MLS / Spark API | `SubdivisionName` | A specific development |
| `communities` table | `communities` | Same thing |
| `neighborhoods` table | `neighborhoods` | Broader area containing communities |
| `seo-url-guardrails.mdc` | neighborhood, community | Separate URL segments |
| `AGENTS.md` / `FEATURES.md` | subdivision | Used interchangeably with community |
| Search route (`resolveSlug`) | subdivision | 2nd segment, no neighborhood concept |

**Resolution:** Standardize terminology in ALL docs. In user-facing content and URLs: "community". In database and code comments: "community (MLS: SubdivisionName)". "Neighborhood" is always the higher-level grouping.

### Documents That Must Be Updated (Phase 0A)

| Document | What Changes | Priority |
|----------|-------------|----------|
| `.cursor/rules/seo-url-guardrails.mdc` | Update canonical listing URL to MLS + address format; document optional neighborhood segment; update structured data requirements | Critical |
| `.cursor/rules/master-plan-protocol.mdc` | Update file ownership matrix (`[listingKey]` -> route may rename); update filter link spec; update phase status | Critical |
| `.cursor/rules/supabase-data-layer.mdc` | Add stats computation rules (ClosePrice, percentile_cont, closed-only filter); add geo_slug format spec | Critical |
| `AGENTS.md` | Update Key Architecture section with new listing URL format; update listing URL description | Critical |
| `docs/plans/master-plan.md` | Update header (phase status is stale); rewrite Phase 0.1 listing URL spec; reconcile with seo-url-guardrails | Critical |
| `docs/plans/phase-0-brief.md` | Rewrite Task 0.1 to match new URL scheme | High |
| `docs/plans/task-registry.json` | Add new tasks for data architecture work; update T2-008 if filter routes change | High |
| `docs/FEATURES.md` | Major refresh - all route references are stale | High |
| `docs/SEO.md` | Update sitemap URLs, canonical URL examples | High |
| `docs/GOALS_AND_UI_AUDIT.md` | Update URL checklist items to match new format | High |
| `docs/URL_ARCHITECTURE.md` | Either update to match new plan or mark as superseded | High |
| `docs/ENTITY_OPTIMIZATION.md` | Update structured data URL references | Medium |
| `docs/CONSOLIDATED_AUDIT_AND_PLAN.md` | Mark resolved conflicts; add new ones if any | Medium |
| `.cursor/rules/cma-data-model.mdc` | Verify ClosePrice rules align with stats computation rules | Low |
| `.cursor/rules/blog-voice.mdc` | Update internal link examples if routes change | Low |

### New Cursor Rule: `.cursor/rules/data-architecture.mdc` (Phase 0B)

This new rule codifies:
- Stats computation rules (ClosePrice, percentile_cont, closed-only, summary tables)
- geo_slug format (`city:community` colon-separated)
- JSONB strategy (no `details` in tile queries, promote hot fields)
- Query patterns (parallelize, React.cache for dedup, no fetchAllRows on hot paths)
- Listing URL structure (MLS + address, optional neighborhood)
- Geographic hierarchy terminology (city > optional neighborhood > community)
- Caching strategy (ISR revalidate on all public pages)
- Performance non-negotiables (max round-trips, no select(*), cap geocoding)

---

## Problem Statement

Four interrelated systems need to be fixed together. Fixing one without the others leaves the site in an inconsistent state.

1. **Data accuracy**: Stats computation uses `ListPrice` instead of `ClosePrice`, doesn't filter for closed sales, computes averages labeled as medians.
2. **Page performance**: Listing detail page makes 15-35+ DB round-trips (many sequential), fetches 26KB `details` JSONB via `select('*')`, runs duplicate queries. Other pages have similar issues.
3. **URL and SEO structure**: Listing URLs use an internal `ListingKey` (Spark system ID) that nobody recognizes, not the MLS number (`ListNumber`). URLs don't include the full address. Breadcrumbs don't consistently match URL structure.
4. **Geographic hierarchy**: Two parallel systems (MLS `SubdivisionName` vs `properties.neighborhood_id`), inconsistent terminology ("subdivision" vs "community" vs "neighborhood"), mismatched `geo_slug` formats, and breadcrumb/URL divergence between neighborhood and community routes.

---

## Part A: URL Structure and Listing Identification

### Current State

**How listing URLs work today:**
- `listingDetailPath()` in [lib/slug.ts](lib/slug.ts) builds URLs using `ListingKey` (Spark internal ID) as the primary identifier
- With full location data: `/homes-for-sale/{city}/{subdivision}/{ListingKey}-{zip}` (e.g. `/homes-for-sale/bend/northwest-crossing/20240801234567890-97702`)
- Without location: `/homes-for-sale/listing/{ListingKey}`
- The `ListingKey` is a long alphanumeric string that has no meaning to anyone outside Spark's system

**What people actually recognize:**
- `ListNumber` is the MLS number (e.g. `220189456`) -- this is what agents, buyers, and the MLS use
- Street addresses are what everyone searches for

**The identifier used in links today** ([components/ListingTile.tsx](components/ListingTile.tsx)):
```
const canonicalListingKey = (row.ListingKey ?? row.listing_key ?? ...).toString().trim()
const linkKey = canonicalListingKey  // <-- always prefers ListingKey
```

### Target URL Structure

Neighborhoods are optional. The URL adapts based on what geographic data exists for the listing.

**When neighborhood exists for the community:**
```
/homes-for-sale/{city}/{neighborhood}/{community}/{street-address}-{mls-number}
```
Example: `/homes-for-sale/bend/westside/northwest-crossing/2145-nw-cascade-view-dr-220189456`

**When no neighborhood exists (most common):**
```
/homes-for-sale/{city}/{community}/{street-address}-{mls-number}
```
Example: `/homes-for-sale/bend/northwest-crossing/2145-nw-cascade-view-dr-220189456`

**When community/subdivision is missing:**
```
/homes-for-sale/{city}/{street-address}-{mls-number}
```
Example: `/homes-for-sale/bend/2145-nw-cascade-view-dr-220189456`

**When insufficient location data:**
```
/homes-for-sale/listing/{mls-number}
```

This gives us:
- **City** in the URL for geographic SEO
- **Neighborhood** when it exists (optional segment, gracefully omitted when absent)
- **Community** (subdivision) in the URL for subdivision-level SEO
- **Full street address** slugified for long-tail search
- **MLS number** as the terminal identifier (recognizable, unique, searchable)

The `listingDetailPath()` function must check: does this community have a `neighborhood_id`? If yes, include the neighborhood slug. If no, skip it. This is a database lookup that can be cached (community -> neighborhood mapping rarely changes).

### Files That Must Change for URL Structure

| File | Change |
|------|--------|
| [lib/slug.ts](lib/slug.ts) | Rewrite `listingDetailPath()` to build address + MLS slug; add `listingAddressSlugWithMls()` helper |
| [lib/slug.ts](lib/slug.ts) | Update `listingKeyFromSlug()` to parse MLS number from the new format |
| [next.config.ts](next.config.ts) | Update rewrite patterns for `{address}-{mls}` format; add 301 redirects from old `{ListingKey}-{zip}` URLs to new format |
| [app/listing/by-address/[...slug]/page.tsx](app/listing/by-address/[...slug]/page.tsx) | Update resolver to extract MLS from new slug format |
| [app/actions/listing-detail.ts](app/actions/listing-detail.ts) | Update `resolveListingKeyFromSlug` to try `ListNumber` first (since MLS is now in the URL), then `ListingKey` as fallback |
| [components/ListingTile.tsx](components/ListingTile.tsx) | Change `linkKey` to prefer `ListNumber` over `ListingKey`; pass address data to `listingDetailPath` |
| [app/sitemap.ts](app/sitemap.ts) | Update `listingDetailPath` call to use `ListNumber` as primary key |
| [lib/structured-data.ts](lib/structured-data.ts) | Update `generateListingSchema` URL generation |
| [components/listing/ListingJsonLd.tsx](components/listing/ListingJsonLd.tsx) | Align listing ID in schema with MLS number |
| [app/listing/[listingKey]/page.tsx](app/listing/[listingKey]/page.tsx) | Update canonical URL generation in `generateMetadata` |
| Every component that calls `listingDetailPath` | Ensure `ListNumber` and address data are passed (search results for `listingDetailPath` show ~15 call sites) |

### Backward Compatibility

Old URLs with `ListingKey` must 301-redirect to new URLs. The resolver already supports both `ListingKey` and `ListNumber` lookups, so:
1. Old URL hits the page
2. Resolver finds the listing via `ListingKey`
3. Page generates the canonical URL using `ListNumber` + address
4. If current URL does not match canonical, issue a 301 redirect

This is standard SEO practice: one canonical URL, everything else redirects.

---

## Part B: Geographic Hierarchy

### Current State (Two Parallel Systems)

**System 1: MLS-driven (subdivision = "community" in the site)**
- `listings."SubdivisionName"` is the MLS subdivision field
- Drives `/communities/{city-subdivision}` pages
- Drives `/homes-for-sale/{city}/{subdivision}` search pages
- `communities` table links to these via `ilike('name', subdivision)` (no FK)
- `subdivision_flags` keys use `city:subdivision` format
- `subdivision_aliases` handle messy MLS name variants

**System 2: Property-graph-driven (neighborhoods)**
- `neighborhoods` table with `city_id` FK to `cities`
- `properties.neighborhood_id` links addresses to neighborhoods
- Drives `/cities/{city}/{neighborhood}` pages
- Query path is via `properties` join, completely different from subdivision queries

**The correct model:**
- **Neighborhoods** are higher-level areas that contain one or more **communities** (subdivisions)
- A community/subdivision is a specific development (Tetherow, Broken Top, etc.)
- A neighborhood is a geographic area (Westside, Southeast Bend, etc.)
- **Not every city has defined neighborhoods.** All cities have subdivisions/communities. Neighborhoods are optional and can be added to the database at any time.
- The system must handle both cases gracefully: when a neighborhood exists for a community, it appears in URLs/breadcrumbs/JSON-LD. When it doesn't exist, those layers skip it entirely with no broken UI or bad data.

**Current database supports this** through FKs: `communities.neighborhood_id -> neighborhoods.id` and `communities.city_id -> cities.id`. The problem is that the app code doesn't consistently use this hierarchy, and the optional-neighborhood case is not handled uniformly.

### Terminology Standardization

| Concept | Database | MLS | URL | UI Label | Code | 
|---------|----------|-----|-----|----------|------|
| Neighborhood | `neighborhoods` table | (no direct field) | `/cities/{city}/{neighborhood}` | "Neighborhood" | Consistent |
| Community (subdivision) | `communities` table + `listings."SubdivisionName"` | `SubdivisionName` | `/homes-for-sale/{city}/{community}` and `/communities/{slug}` | "Community" | Mixed: code says "subdivision" in many places |

### What Changes

**Routes:** No route changes needed. The existing routes are correct:
- `/cities/{city}/{neighborhood}` - neighborhood page (broader area)
- `/homes-for-sale/{city}/{community}` - community listings (specific subdivision)
- `/communities/{slug}` - community marketing page

**Breadcrumb alignment** (see Part C below)

**geo_slug standardization for stats cache:**

The `market_stats_cache` and `market_pulse_live` tables use `geo_slug` to key stats. Currently inconsistent:

| Consumer | Current geo_slug | Correct geo_slug |
|----------|-----------------|-----------------|
| `market-stats.ts` `getMarketStatsForSubdivision` | `citySlug:subSlug` (colon) | `citySlug:subSlug` (keep this format) |
| Search page `getLiveMarketPulse` | `city-subdivision` (hyphen) | `citySlug:subSlug` (colon, match cache) |
| Community page `getLiveMarketPulse` | `city-subdivision` (hyphen) | `citySlug:subSlug` (colon, match cache) |
| SQL `compute_and_cache_period_stats` | `lower(SubdivisionName)` (name only, no city) | `citySlug:subSlug` (colon, city-qualified to avoid collisions) |
| `reporting_cache` | `geo_type = 'community'` | Align with `geo_type = 'subdivision'` or rename to `'community'` consistently |

**Decision:** Use `city:community` (colon-separated slugs) as the canonical `geo_slug` for community/subdivision level data everywhere. Update:
- SQL RPCs to pass city-qualified slug
- All TS consumers to use `subdivisionEntityKey()` consistently
- `subdivisionEntityKey()` already produces `citySlug:subSlug` -- just ensure all callers use it

---

## Part C: Breadcrumb and URL Alignment

### Current Inconsistencies Found

1. **JSON-LD first crumb**: Some pages use "Home", others "Ryan Realty", neighborhood page uses "Ryan Realty" while city page uses "Home"
2. **Neighborhood breadcrumb link target**: Community page breadcrumb links neighborhood to `/homes-for-sale/{city}/{neighborhood}` (search route) instead of `/cities/{city}/{neighborhood}` (the actual neighborhood page)
3. **Guide detail breadcrumb**: Visible nav omits "Home" while JSON-LD includes it
4. **Multiple BreadcrumbList schemas**: Resort search pages emit two `BreadcrumbList` JSON-LD blocks
5. **Breadcrumb implementations**: Mix of `BreadcrumbStrip` component, custom `<nav>` elements, and JSON-LD-only (no visible breadcrumb)
6. **Housing market breadcrumbs**: Start from "Housing Market" not "Home"

### Target Breadcrumb Hierarchy

Every page follows a consistent pattern where **visible breadcrumbs match JSON-LD match URL hierarchy**. Neighborhoods are included when they exist and omitted when they don't. The system must never show a broken or empty breadcrumb segment.

**Listing detail (with neighborhood):**
```
Home > Homes for Sale > {City} > {Neighborhood} > {Community} > {Street Address}
URL: /homes-for-sale/{city}/{neighborhood}/{community}/{address}-{mls}
```

**Listing detail (without neighborhood -- most common):**
```
Home > Homes for Sale > {City} > {Community} > {Street Address}
URL: /homes-for-sale/{city}/{community}/{address}-{mls}
```

**Listing detail (no community data):**
```
Home > Homes for Sale > {City} > {Street Address}
URL: /homes-for-sale/{city}/{address}-{mls}
```

**Community/subdivision search:**
```
Home > Homes for Sale > {City} > {Community}
URL: /homes-for-sale/{city}/{community}
```

**City search:**
```
Home > Homes for Sale > {City}
URL: /homes-for-sale/{city}
```

**Neighborhood page:**
```
Home > Cities > {City} > {Neighborhood}
URL: /cities/{city}/{neighborhood}
```

**Community marketing page (with neighborhood):**
```
Home > Communities > {City} > {Neighborhood} > {Community}
URL: /communities/{city-community}
```

**Community marketing page (without neighborhood):**
```
Home > Communities > {City} > {Community}
URL: /communities/{city-community}
```

**Housing market:**
```
Home > Housing Market > {City or Geo}
URL: /housing-market/{slug}
```

### How Neighborhood Resolution Currently Works (Verified End-to-End)

The codebase already has optional-neighborhood logic in most places. Here is the exact behavior today:

**`subdivisionListingsPath()` in `lib/slug.ts` (lines 52-66):**
- If `neighborhood` is empty/null OR `slugify(neighborhood) === slugify(subdivision)`: produces `/homes-for-sale/{city}/{subdivision}` (2 segments)
- If `neighborhood` is non-empty and slug differs from subdivision: produces `/homes-for-sale/{city}/{neighborhood}/{subdivision}` (3 segments)
- This is correct and should be preserved.

**`listingDetailPath()` in `lib/slug.ts` (lines 141-177):**
- Reads `location.neighborhood` -- if non-empty, passes to `subdivisionListingsPath`; if null/empty, skipped
- This is correct.

**Listing detail page breadcrumbs (`buildListingBreadcrumbItems`, lines 66-100):**
- Neighborhood crumb only shown when BOTH `neighborhoodName` AND `neighborhoodSlug` are non-null
- Community crumb correctly passes `neighborhoodName || null` to `subdivisionListingsPath`
- This is correct.

**Where neighborhood data comes from on listing detail (`listing-detail.ts`, lines 1016-1073):**
- Looks up `communities` by `slugify(SubdivisionName)`
- If community has `neighborhood_id`: fetches `neighborhoods` row for name + slug
- If no community row, no `neighborhood_id`, or no neighborhood row: fields stay `null`
- This is correct.

**Community page (`communities/[slug]/page.tsx`):**
- Guards neighborhood display with `community.neighborhoodName && community.neighborhoodSlug`
- This is correct.

### What Needs to Change for Neighborhood Resolution

The current logic is sound but incomplete in several callers:

**1. Sitemap (`app/sitemap.ts`):** Currently passes NO neighborhood to `listingDetailPath`. Fix: Look up community -> neighborhood mapping and pass it. This means sitemap URLs will include the neighborhood segment when one exists.

**2. ListingTile (`components/ListingTile.tsx`):** Uses `getNeighborhoodName` from optional MLS fields, which may not match the database `neighborhoods` table. Fix: Use the `communities -> neighborhoods` join path consistently, not MLS fields.

**3. `generateListingSchema` (`lib/structured-data.ts`):** Omits neighborhood entirely. Fix: Include when available, so schema URLs match canonical URLs.

**4. Activity feed cards:** Call `listingDetailPath` with no location data at all. Fix: Pass available location data so links use hierarchy URLs, not fallback `/homes-for-sale/listing/{key}` paths.

**5. Search page:** `resolveSlug` has NO neighborhood concept -- it interprets 2nd segment as subdivision or preset. This is architecturally correct for search routes (you search by community, not by neighborhood). No change needed.

**6. `neighborhoodPagePath` collision:** This function produces `/homes-for-sale/{city}/{neighborhood}` which is the SAME shape as `/homes-for-sale/{city}/{subdivision}`. The search router can't distinguish them. This is an existing issue but not being changed in this plan -- the neighborhood editorial page lives at `/cities/{city}/{neighborhood}` which IS distinct.

### Caching Strategy for Neighborhood Lookups

Community-to-neighborhood mapping is stable (changes only when admin adds/reassigns neighborhoods). Cache the mapping:

```ts
// Cached at the module level or via unstable_cache
const getCommunityNeighborhood = unstable_cache(
  async (communitySlug: string) => {
    // communities -> neighborhoods join
    // returns { name, slug } or null
  },
  ['community-neighborhood'],
  { revalidate: 3600, tags: ['community-neighborhood'] }
)
```

Called from `listingDetailPath`, breadcrumb builders, and sitemap generation. One DB query per unique community slug, cached for 1 hour.

### Files That Must Change for Breadcrumbs

| File | Change |
|------|--------|
| [app/listing/[listingKey]/page.tsx](app/listing/[listingKey]/page.tsx) | Update `buildListingBreadcrumbItems` to use address in final crumb; ensure neighborhood link goes to `/cities/{city}/{neighborhood}` |
| [app/search/[...slug]/page.tsx](app/search/[...slug]/page.tsx) | Standardize breadcrumb items to use "Home" as first crumb |
| [app/search/[...slug]/SearchPageJsonLd.tsx](app/search/[...slug]/SearchPageJsonLd.tsx) | Change first crumb from "Ryan Realty" to "Home" to match visible |
| [app/search/[...slug]/ResortCommunityJsonLd.tsx](app/search/[...slug]/ResortCommunityJsonLd.tsx) | Remove duplicate BreadcrumbList (one per page is correct) |
| [app/communities/[slug]/page.tsx](app/communities/[slug]/page.tsx) | Fix neighborhood link to point to `/cities/{city}/{neighborhood}` not `/homes-for-sale/...` |
| [app/cities/[slug]/[neighborhoodSlug]/page.tsx](app/cities/[slug]/[neighborhoodSlug]/page.tsx) | Change "Ryan Realty" to "Home" in first crumb |
| [app/housing-market/[...slug]/page.tsx](app/housing-market/[...slug]/page.tsx) | Add "Home" as first crumb |
| [app/guides/[slug]/page.tsx](app/guides/[slug]/page.tsx) | Add "Home" to visible breadcrumb to match JSON-LD |
| [app/reports/[slug]/page.tsx](app/reports/[slug]/page.tsx) | Add "Home" as first crumb |
| [app/reports/[slug]/[geoName]/page.tsx](app/reports/[slug]/[geoName]/page.tsx) | Add "Home" as first crumb |
| [app/zip/[zip]/page.tsx](app/zip/[zip]/page.tsx) | Fix breadcrumb to start with "Home" |
| [lib/structured-data.ts](lib/structured-data.ts) | Ensure `generateBreadcrumbSchema` always uses "Home" for position 1 |

---

## Part D: Data Accuracy (Stats Computation)

### Critical Bug: Stats Are Computing the Wrong Thing

`compute_and_cache_period_stats` in the most recent migration ([supabase/migrations/20260326075000_market_rpcs_fast_compute.sql](supabase/migrations/20260326075000_market_rpcs_fast_compute.sql)):

- Filters by `OnMarketDate`/`ListDate` (when listing went on market), **not** `CloseDate` (when it sold)
- Uses `ListPrice`, **not** `ClosePrice`
- No filter on `StandardStatus` for closed sales
- Labels `avg()` results as "median"
- `sale_to_list_ratio` is hardcoded to 1

Every stat on the site that reads from `market_stats_cache` is currently wrong.

### What the Corrected Function Must Do

| Metric | Current (Wrong) | Corrected |
|--------|-----------------|-----------|
| sold_count | All listings on-market in period | `WHERE "StandardStatus" ILIKE '%Closed%' AND "CloseDate" BETWEEN period_start AND period_end` |
| median_sale_price | `avg(ListPrice)` | `percentile_cont(0.5) WITHIN GROUP (ORDER BY COALESCE("ClosePrice", (details->>'ClosePrice')::numeric))` |
| avg_sale_to_list_ratio | Hardcoded 1 | `avg(COALESCE("ClosePrice", (details->>'ClosePrice')::numeric) / NULLIF("ListPrice", 0))` |
| median_dom | `avg(details->>'DaysOnMarket')` | `percentile_cont(0.5) WITHIN GROUP (ORDER BY ("CloseDate" - COALESCE("OnMarketDate", "ListDate")))` |
| speed_p25/p50/p75 | All = median_dom | Separate `percentile_cont(0.25/0.5/0.75)` on DOM |
| median_ppsf | `avg(ListPrice/sqft)` | `percentile_cont(0.5) WITHIN GROUP (ORDER BY ClosePrice / NULLIF(sqft, 0))` |

### Other Data Accuracy Fixes

| Issue | File | Fix |
|-------|------|-----|
| Weekly report uses `ListPrice` for closed sales | [app/actions/market-reports.ts](app/actions/market-reports.ts) `closedListingToReportListing` | Use `COALESCE(ClosePrice, details->>'ClosePrice', ListPrice)` |
| Time series RPC uses `ListPrice` for medians | Migration `get_city_metrics_timeseries` | Use ClosePrice with fallback chain |
| Beacon RPCs use `ListPrice` for some aggregates | Migration `get_city_period_metrics` / `get_city_price_bands` | Align with ClosePrice |
| `guides.ts` column names don't match cache | [app/actions/guides.ts](app/actions/guides.ts) | Fix `avg_days_on_market` to `median_dom`, `geo_name` to `geo_slug` |

---

## Part E: Page Performance

### Listing Detail Page ([app/listing/[listingKey]/page.tsx](app/listing/[listingKey]/page.tsx))

**Current problems (15-35+ DB round-trips):**
1. `getListingDetailData` called twice (metadata + page) -- **duplicate full fetch**
2. `select('*')` on listings -- **26KB `details` JSONB loaded**
3. Photo/agent/OH/video queries are **sequential** (4 separate queries)
4. Community resolution is **3 sequential queries** (communities -> neighborhoods -> cities)
5. Engagement metrics fetched twice (inside detail data + separate call)
6. No `revalidate` -- **fully dynamic on every request**
7. `getVacationRentalPotential` is **sequential** after two `Promise.all` blocks

**Fixes:**
1. New `getListingMetadata()` lean function for `generateMetadata` (title, photo, price only)
2. Replace `select('*')` with explicit column list (extract specific `details` fields via `details->>'Remarks'` etc.)
3. Parallelize photo + agent + OH + video into one `Promise.all`
4. Single JOIN for community -> neighborhood -> city
5. Remove duplicate engagement fetch
6. Add `export const revalidate = 60`
7. Move vacation rental into main `Promise.all`

**Files:** [app/actions/listing-detail.ts](app/actions/listing-detail.ts), [app/listing/[listingKey]/page.tsx](app/listing/[listingKey]/page.tsx)

### Search Page ([app/search/[...slug]/page.tsx](app/search/[...slug]/page.tsx))

**Current problems:**
1. `getListings` + `getActiveListingsCount` run **sequentially**
2. `getGeocodedListings` fires **100+ parallel Google Geocode API calls**
3. ~~`getListingsInBounds` selects `details` JSONB for every map listing~~ **Done:** `LISTING_BOUNDS_SELECT` is flat columns only (see `lib/listing-tile-projections.ts` + `app/actions/listings.ts`).
4. Banner lookups are sequential in a `for` loop

**Fixes:**
1. Parallelize list + count (or combine into one RPC)
2. Cap geocode batch to 10 max; background-sync the rest
3. ~~Strip `details` from `LISTING_BOUNDS_SELECT`~~ **Done**
4. Parallelize banner lookups

**Files:** [app/actions/listings.ts](app/actions/listings.ts), [app/actions/geocode.ts](app/actions/geocode.ts)

### City Page ([app/cities/[slug]/page.tsx](app/cities/[slug]/page.tsx))

**Current problems:**
1. `getNeighborhoodsInCity` runs but **result is destructured and discarded** (wasted N+1 query)
2. ~~`HOME_TILE_SELECT` includes `details` on 24 tiles~~ **Done:** city sliders use `CITY_LISTING_TILE_SELECT` from `lib/listing-tile-projections.ts` (no `details` JSONB).
3. `getCommunitiesInCity` uses `fetchAllRows` (full table scan) + sequential banner lookups

**Fixes:**
1. Remove unused `getNeighborhoodsInCity` from `Promise.all`
2. ~~Strip `details` from city tile select~~ **Done**
3. Use `market_pulse_live` for community counts; parallelize banners

**Files:** [app/actions/cities.ts](app/actions/cities.ts), [app/cities/[slug]/page.tsx](app/cities/[slug]/page.tsx)

### Community Page ([app/communities/[slug]/page.tsx](app/communities/[slug]/page.tsx))

**Current problems:**
1. ~~`HOME_TILE_SELECT` includes `details` on 24 tiles~~ **Done:** community listings use `COMMUNITY_LISTING_TILE_SELECT` (no `details` JSONB).
2. Listing-scan fallbacks for stats

**Fixes:**
1. ~~Strip `details` from tile select~~ **Done**
2. Use `market_stats_cache` for community stats

**Files:** [app/actions/communities.ts](app/actions/communities.ts)

### Video/Virtual Tour Detection Without `details`

Stripping `details` from tile selects impacts video detection in `ListingTile`. Solution: add a `has_virtual_tour` boolean column to `listings`, backfill from `details->>'VirtualTourURLUnbranded'`, and update during sync. This is a one-time migration + sync pipeline change.

---

## Part F: Cache Layer and Historical Data

### Populate Stats at Every Level

Currently `refresh_market_pulse` SQL only aggregates by city. It must also aggregate by community (subdivision). And `compute_and_cache_period_stats` must be called for every active community, not just cities.

### Refresh Schedule

| What | Frequency | Trigger |
|------|-----------|---------|
| Current month stats (region + cities + communities) | Every 15 min | After delta sync |
| Rolling 12 months | Nightly | Cron |
| Historical years (2020-present) | Once (backfill) | Manual then monthly |
| Pulse (active counts, list prices) | Every 15 min | After delta sync |

### Historical Year-Over-Year

Backfill `period_type = 'yearly'` rows in `market_stats_cache` for every city and community that has closed sales. This enables:
- Year-over-year median price charts
- Year-over-year DOM trends
- Historical volume comparison

Replace `get_city_metrics_timeseries` (live scan) with a simple `SELECT` from `market_stats_cache ORDER BY period_start`.

---

## Part G: CMA Engine

### Remove `properties` Table Dependency

Current `get_cma_comps` RPC requires a `properties.id` to find lat/lon. Many listings don't have a matching `properties` row, causing CMA to silently fail.

Fix: Add `get_cma_comps_by_listing_key(p_listing_key text, ...)` that reads lat/lon directly from `listings."Latitude"` / `"Longitude"`.

### Pre-Compute CMAs for Active Listings

Background job (after delta sync):
1. Find active listings without a fresh CMA (< 7 days)
2. Compute CMA and store in `valuations` / `valuation_comps`
3. Listing pages display pre-computed CMAs instantly

### Home Valuation Flow

Currently requires matching to `properties` table. Add a path that geocodes the submitted address and runs `get_cma_comps` directly with the lat/lon.

---

## Complete File Impact Map

### Database (New Migrations)

| Migration | Purpose |
|-----------|---------|
| CREATE TABLE `market_stats_cache` IF NOT EXISTS | Missing DDL |
| CREATE TABLE `market_pulse_live` IF NOT EXISTS | Missing DDL |
| Backfill `ClosePrice` from `details` JSON | Data normalization |
| Add `has_virtual_tour` boolean to `listings` | Strip `details` from tiles |
| Rewrite `compute_and_cache_period_stats` | Correct stats computation |
| Rewrite `refresh_market_pulse` with community support | Subdivision-level pulse |
| Rewrite `get_city_metrics_timeseries` | Use ClosePrice |
| Add `get_cma_comps_by_listing_key` | CMA without `properties` |
| Add `backfill_all_historical_stats` | Year-over-year data |
| Composite partial indexes for closed-sale analytics | Query performance |

### Server Actions

| File | Changes |
|------|---------|
| [app/actions/market-stats.ts](app/actions/market-stats.ts) | Standardize geo_slug; remove fallback to deprecated stats |
| [app/actions/listings.ts](app/actions/listings.ts) | Remove `getCityMarketStats`; parallelize list+count; strip `details` from selects |
| [app/actions/listing-detail.ts](app/actions/listing-detail.ts) | Replace `select('*')`; parallelize subsidiary queries; deduplicate; lean metadata function |
| [app/actions/reports.ts](app/actions/reports.ts) | Verify RPC wrappers with corrected RPCs |
| [app/actions/market-reports.ts](app/actions/market-reports.ts) | Fix `closedListingToReportListing` to use ClosePrice |
| [app/actions/home.ts](app/actions/home.ts) | Remove RPC fallback in `getMarketSnapshot` |
| [app/actions/cities.ts](app/actions/cities.ts) | Remove `fetchAllRows`; use pulse for counts; strip `details` |
| [app/actions/communities.ts](app/actions/communities.ts) | Use cache for stats; strip `details` |
| [app/actions/guides.ts](app/actions/guides.ts) | Fix column name mismatch |
| [app/actions/geocode.ts](app/actions/geocode.ts) | Cap batch size |
| [app/actions/recently-sold.ts](app/actions/recently-sold.ts) | Verify ClosePrice in select |
| [lib/cma.ts](lib/cma.ts) | Add `computeCMAByListingKey` |
| [lib/slug.ts](lib/slug.ts) | Rewrite `listingDetailPath` for MLS + address; update `listingKeyFromSlug` |
| [lib/structured-data.ts](lib/structured-data.ts) | Align listing URLs and breadcrumb schemas |

### Pages

| Page | Changes |
|------|---------|
| [app/listing/[listingKey]/page.tsx](app/listing/[listingKey]/page.tsx) | Add revalidate; deduplicate detail fetch; update canonical URL; fix breadcrumbs for address; redirect old URLs |
| [app/listings/[listingKey]/page.tsx](app/listings/[listingKey]/page.tsx) | Same as canonical listing page |
| [app/listing/by-address/[...slug]/page.tsx](app/listing/by-address/[...slug]/page.tsx) | Update resolver for new slug format |
| [app/search/[...slug]/page.tsx](app/search/[...slug]/page.tsx) | Fix breadcrumbs; strip sequential count |
| [app/search/[...slug]/SearchPageJsonLd.tsx](app/search/[...slug]/SearchPageJsonLd.tsx) | Standardize first crumb |
| [app/search/[...slug]/ResortCommunityJsonLd.tsx](app/search/[...slug]/ResortCommunityJsonLd.tsx) | Remove duplicate BreadcrumbList |
| [app/cities/[slug]/page.tsx](app/cities/[slug]/page.tsx) | Remove wasted neighborhood query; strip details from tiles |
| [app/cities/[slug]/[neighborhoodSlug]/page.tsx](app/cities/[slug]/[neighborhoodSlug]/page.tsx) | Standardize breadcrumb first crumb |
| [app/communities/[slug]/page.tsx](app/communities/[slug]/page.tsx) | Fix neighborhood link; strip details; use cache |
| [app/page.tsx](app/page.tsx) | Remove RPC fallback |
| [app/housing-market/[...slug]/page.tsx](app/housing-market/[...slug]/page.tsx) | Add revalidate; fix breadcrumbs |
| [app/housing-market/page.tsx](app/housing-market/page.tsx) | Benefits from cache-backed browse |
| [app/housing-market/central-oregon/page.tsx](app/housing-market/central-oregon/page.tsx) | Benefits from corrected pulse |
| [app/reports/page.tsx](app/reports/page.tsx) | Benefits from corrected RPCs |
| [app/reports/explore/page.tsx](app/reports/explore/page.tsx) | Benefits from corrected RPCs |
| [app/reports/[slug]/[geoName]/page.tsx](app/reports/[slug]/[geoName]/page.tsx) | Verify reporting_cache alignment |
| [app/sell/page.tsx](app/sell/page.tsx) | Verify market condition |
| [app/home-valuation/page.tsx](app/home-valuation/page.tsx) | Benefits from CMA engine fix |
| [app/guides/[slug]/page.tsx](app/guides/[slug]/page.tsx) | Fix breadcrumb |
| [app/zip/[zip]/page.tsx](app/zip/[zip]/page.tsx) | Fix breadcrumb |
| OG image routes | Benefits from corrected data |
| [app/sitemap.ts](app/sitemap.ts) | Update listing URLs to MLS + address format |

### Components

| Component | Changes |
|-----------|---------|
| [components/ListingTile.tsx](components/ListingTile.tsx) | Use ListNumber for links; pass address to path builder; use `has_virtual_tour` instead of `details` |
| [components/listing/ListingJsonLd.tsx](components/listing/ListingJsonLd.tsx) | Align listing ID with MLS |
| [components/listing/AreaMarketContext.tsx](components/listing/AreaMarketContext.tsx) | Benefits from correct stats |
| [components/listing/ListingValuationSection.tsx](components/listing/ListingValuationSection.tsx) | Use listing_key CMA path |
| [components/reports/LivePulseBanner.tsx](components/reports/LivePulseBanner.tsx) | Benefits from correct data |
| [components/geo-page/GeoMarketOverview.tsx](components/geo-page/GeoMarketOverview.tsx) | Benefits from correct stats |
| All stat display components | Benefits from correct data flowing through |

### Configuration

| File | Changes |
|------|---------|
| [next.config.ts](next.config.ts) | Update rewrite patterns; add 301 redirects for old ListingKey URLs |

### Cron Routes

| Route | Changes |
|-------|---------|
| [app/api/cron/sync-delta/route.ts](app/api/cron/sync-delta/route.ts) | Trigger targeted cache refresh; detect closed-sale transitions |
| [app/api/cron/sync-full/route.ts](app/api/cron/sync-full/route.ts) | Add `refresh_current_period_stats` call |
| [app/api/cron/optimization-loop/route.ts](app/api/cron/optimization-loop/route.ts) | Extend freshness check to stats cache |
| New: nightly stats refresh | Backfill rolling 12 months |
| New: CMA pre-compute | Background CMA generation for active listings |

---

## Execution Order

Phases must execute in this order (later phases depend on earlier ones):

**Phase 0A: Documentation reconciliation** (before any code changes)
- Update all 15 documents listed in the conflict section above
- Establish ONE canonical URL specification that all docs reference
- Standardize geographic hierarchy terminology across all docs
- Remove or mark superseded any competing URL architecture documents
- This is the foundation -- if docs contradict each other, agents will undo each other's work

**Phase 0B: Cursor rules** (immediately after docs)
- Create `.cursor/rules/data-architecture.mdc` codifying all research-backed decisions
- Update `.cursor/rules/seo-url-guardrails.mdc` with new listing URL format
- Update `.cursor/rules/master-plan-protocol.mdc` with corrected file references
- Update `.cursor/rules/supabase-data-layer.mdc` with stats computation rules
- These rules are enforced by every agent session -- they must be correct

**Phase 1-2: Database foundation** (no app code, no frontend impact)
- Create missing DDL, backfill ClosePrice, add indexes
- Fix stats computation RPCs

**Phase 3: URL structure** (high SEO impact, should be done early)
- Rewrite `listingDetailPath` for MLS + address
- Update resolvers, rewrites, redirects
- Update all `listingDetailPath` callers
- Update sitemap

**Phase 4: Geographic hierarchy** (terminology and geo_slug standardization)
- Standardize geo_slug to `city:community` everywhere
- Align `reporting_cache` geo_type with `market_stats_cache`

**Phase 5: Breadcrumbs** (depends on Phase 3 URLs and Phase 4 hierarchy)
- Standardize all breadcrumbs to start with "Home"
- Align visible breadcrumbs with JSON-LD
- Fix neighborhood link targets
- Remove duplicate BreadcrumbList schemas

**Phase 6-7: Performance** (can run in parallel)
- Listing detail optimization
- Search + city + community optimization

**Phase 8-9: Cache and historical data** (depends on Phase 2)
- Populate community-level stats
- Backfill historical years

**Phase 10-11: CMA and reports** (depends on Phase 1 for ClosePrice)
- CMA engine improvements
- Report alignment

**Phase 12: Cleanup** (depends on everything above)
- Remove all legacy fallbacks
- Add `revalidate` everywhere missing
- Full SEO lint pass

**Phase 13: Verification** (final)

---

## Verification Checklist (Phase 13)

Every page type visited, screenshotted, and verified:

**URL and SEO:**
- [ ] Listing URL contains MLS number and address slug
- [ ] Old ListingKey URLs 301-redirect to new format
- [ ] Sitemap uses new URL format
- [ ] Canonical URLs match visible URLs
- [ ] JSON-LD listing ID uses MLS number
- [ ] `npm run lint:seo-routes` passes

**Breadcrumbs:**
- [ ] All pages start breadcrumb with "Home"
- [ ] Visible breadcrumbs match JSON-LD breadcrumbs
- [ ] Listing breadcrumb: Home > Homes for Sale > City > Community > Address
- [ ] Community breadcrumb links correctly
- [ ] Neighborhood breadcrumb links to `/cities/{city}/{neighborhood}`
- [ ] No duplicate BreadcrumbList schemas

**Data accuracy:**
- [ ] Listing detail stats show ClosePrice-based data
- [ ] City page stats are correct (spot-check 3 cities)
- [ ] Community page stats are correct (spot-check 3 communities)
- [ ] Housing market stats correct
- [ ] Weekly report shows sold prices, not list prices
- [ ] Year-over-year data available for at least 2 years

**Performance:**
- [ ] Listing detail TTFB < 1s
- [ ] Search page TTFB < 1.5s
- [ ] City page TTFB < 1s
- [ ] No `select('*')` on listing queries (except where justified)
- [ ] No `details` JSONB in tile/card selects

**CMA:**
- [ ] CMA works without `properties` table match
- [ ] Pre-computed CMAs display instantly
- [ ] Home valuation form produces CMA

**LLM and AI search optimization:**
- [ ] `robots.ts` allows OAI-SearchBot, PerplexityBot, Claude-SearchBot
- [ ] `/llms.txt` serves curated index of key content areas
- [ ] Listing pages have key facts (price, beds, baths, sqft, address, MLS#) in clean HTML near top of page
- [ ] JSON-LD on listing pages matches visible on-page content exactly
- [ ] Open Graph tags include hero photo, price in description, canonical URL

**Build:**
- [ ] `npm run build` passes
- [ ] `npm run lint:design-tokens` passes
- [ ] `npm run lint:seo-routes` passes
- [ ] No console errors on verified pages

**Documentation consistency:**
- [ ] All 15 conflicting documents reconciled (Phase 0A checklist)
- [ ] All cursor rules aligned with implementation
- [ ] `AGENTS.md` Key Architecture Decisions match actual implementation
- [ ] `.cursor/rules/data-architecture.mdc` exists and is authoritative
- [ ] `.cursor/rules/supabase-data-layer.mdc` stats references are correct
- [ ] `.cursor/rules/seo-url-guardrails.mdc` URL contracts match actual URLs
- [ ] `.cursor/rules/master-plan-protocol.mdc` constraints are current
- [ ] `docs/plans/master-plan.md` header reflects post-Phase-6 status
- [ ] `docs/URL_ARCHITECTURE.md` reflects chosen URL direction
- [ ] `docs/FEATURES.md` reflects current state of the site
- [ ] `docs/ENTITY_OPTIMIZATION.md` schema examples match implementation
- [ ] `docs/GOALS_AND_UI_AUDIT.md` audit criteria reference new patterns
- [ ] `docs/plans/task-registry.json` has new tasks registered
- [ ] No two documents contradict each other on URL format, stats functions, or geographic hierarchy

---

## Part H: Documentation and Rule Merge Strategy

### The Problem

The stats function mandate (`getCachedStats()` / `getLiveMarketPulse()`) appears in **three separate documents**: `supabase-data-layer.mdc`, `AGENTS.md`, and `master-plan-protocol.mdc`. The listing URL canonical format appears in **two documents**: `seo-url-guardrails.mdc` and `AGENTS.md`. There is also a **competing URL migration plan** in `docs/URL_ARCHITECTURE.md` that proposes a `/real-estate/{country}/{state}/{city}/` hierarchy. All of these must be updated atomically or agents will receive contradictory instructions.

Additionally, `docs/FEATURES.md` is **over a year behind** and `docs/plans/master-plan.md` has stale header metadata (still says Phase 0). The task registry has all 36 tasks complete and needs new entries for this work.

### What Gets Updated and How

#### Cursor Rules (Updated in Phase 0)

| Rule File | What Changes | Why |
|-----------|-------------|-----|
| **`.cursor/rules/supabase-data-layer.mdc`** | Update stats function references to reflect corrected computation; add geographic column naming guidance (`geo_slug` format); add JSONB strategy rules; reinforce `getCachedStats()` / `getLiveMarketPulse()` as the API (function signatures stay the same, what they return becomes accurate) | Stats functions keep same names but return correct data; new rule must not contradict this one |
| **`.cursor/rules/seo-url-guardrails.mdc`** | Rewrite listing detail canonical contract from `{key}-{zip}` to `{address-slug}-{mls-number}`; document neighborhood-optional URL segments; update redirect policy for old-to-new URL migration | URL format is changing; this rule defines the contract |
| **`.cursor/rules/master-plan-protocol.mdc`** | Update Key Constraints to reference new URL format; update file ownership if route paths change; note that all prior phases (1-6) are complete and this is new post-phase-6 work | Constraints reference old URL patterns |
| **`.cursor/rules/cma-data-model.mdc`** | Verify price fallback chain is compatible; no changes expected | Compatibility check only |
| **`.cursor/rules/sync-pipeline.mdc`** | Add note about `has_virtual_tour` column population during sync; verify post-sync hook descriptions match updated stats refresh | New column needs sync pipeline awareness |
| **NEW: `.cursor/rules/data-architecture.mdc`** | Create comprehensive rule covering: stats computation requirements (closed-only, ClosePrice, true medians), geographic hierarchy (city > neighborhood > community), geo_slug format, JSONB strategy, query parallelization, caching strategy, URL structure, SEO schemas, performance non-negotiables | This is the authoritative rule that overrides any conflicting guidance in older docs |

**Critical: The new `data-architecture.mdc` rule must be created BEFORE any code changes. All other rule updates happen in the same Phase 0 commit. This ensures every subsequent agent operation follows the correct patterns.**

#### Key Architecture Decisions in AGENTS.md

`AGENTS.md` Section "Key Architecture Decisions" has 6 items. Items 1, 2, and 6 must be updated:

| Decision | Current | Updated |
|----------|---------|---------|
| #1 Market stats | "Always use `getCachedStats()` and `getLiveMarketPulse()`" | Same function names, but add: "These functions read from corrected cache tables that use ClosePrice for closed-sale stats, true percentile medians, and city:community geo_slug format" |
| #2 Listing URL | "`/homes-for-sale/{city}/{subdivision}/{key}-{zip}`. Fallback: `/homes-for-sale/listing/{key}`" | "`/homes-for-sale/{city}/[{neighborhood}/]{community}/{address-slug}-{mls-number}`. Neighborhood segment is included only when a neighborhood is defined for the community. Fallback: `/homes-for-sale/listing/{mls-number}`. `ListNumber` (MLS ID) is the public identifier; `ListingKey` (Spark ID) is internal only." |
| #6 Filter page links | "Browse-by UI components link to `/search/{city}/{filter}` routes" | No change needed (city slug stays the same) |

#### Planning Documents

| Document | Action | Detail |
|----------|--------|--------|
| **`docs/plans/master-plan.md`** | Update header metadata; add Phase 7 appendix for data architecture work | Header currently says "Phase 0" and "Branch: unified-plan" -- both stale. Add section documenting this as the continuation of the master plan. |
| **`docs/plans/task-registry.json`** | Register new tasks via orchestrator `add` command | One task per phase of this plan, with acceptance criteria and file lists. ~13 new backlog items (BL-006 through BL-018). |
| **`docs/URL_ARCHITECTURE.md`** | Reconcile with this plan's URL strategy; mark the `/real-estate/` hierarchy as superseded | This doc proposes a future `/real-estate/us/oregon/{city}/` pattern with a `geo_places` table. Our plan uses `/homes-for-sale/{city}/{community}/{address}-{mls}` instead. The `geo_places` table concept is useful for geographic hierarchy but the URL prefix change is not being adopted. Document should be updated to reflect the actual chosen direction. |
| **`docs/FEATURES.md`** | Full refresh to reflect Phase 1-6 features plus new architecture | Currently a year behind. Must document: market stats pipeline, activity feed, demand indicators, housing market hub, programmatic filter pages, CMA engine, and all new URL/breadcrumb patterns. |
| **`docs/ENTITY_OPTIMIZATION.md`** | Update BreadcrumbList schema examples; update listing schema URL patterns | Breadcrumb alignment and URL changes affect schema output. |
| **`docs/GOALS_AND_UI_AUDIT.md`** | Update audit criteria for sections 5 (listing detail), 7 (city/community), 12 (SEO), 13 (performance) | Criteria must reference new URL format, new breadcrumb structure, new performance targets. |
| **`docs/SYNC_HANDOFF_PLAYBOOK.md`** | Update post-sync hook description if stats refresh changes; add `has_virtual_tour` backfill note | Minor updates to reflect corrected stats refresh and new sync column. |

### Merge Order

All documentation updates happen in Phase 0 alongside the cursor rule creation. This is a single commit that:

1. Creates `.cursor/rules/data-architecture.mdc` (new, authoritative)
2. Updates `.cursor/rules/supabase-data-layer.mdc` (stats function context)
3. Updates `.cursor/rules/seo-url-guardrails.mdc` (URL contracts)
4. Updates `.cursor/rules/master-plan-protocol.mdc` (constraints)
5. Updates `AGENTS.md` Key Architecture Decisions
6. Updates `docs/plans/master-plan.md` header + Phase 7 appendix
7. Updates `docs/URL_ARCHITECTURE.md` to reflect chosen direction
8. Registers new tasks in `docs/plans/task-registry.json`

This commit establishes the new ground truth before any functional code changes begin. Every subsequent phase references these updated rules and docs.

### Reconciliation with URL_ARCHITECTURE.md

The existing `docs/URL_ARCHITECTURE.md` proposes:
- Future URL: `/real-estate/us/oregon/bend/tetherow/listing/123-main-st`
- `geo_places` table for geographic hierarchy
- 5-step implementation plan (unimplemented)

**Decision:** We are NOT adopting the `/real-estate/` prefix or the country/state segments. Reasons:
1. The site serves Central Oregon only -- country and state segments add no SEO value and make URLs longer
2. `/homes-for-sale/` is already indexed, has link equity, and matches user expectations
3. The `geo_places` table concept has merit for normalizing geographic hierarchy but is not required for the URL migration

**What we keep from URL_ARCHITECTURE.md:**
- The concept of a neighborhood-optional segment in the URL hierarchy
- The redirect strategy (301 from old to new, update canonical + sitemap in same release)
- The general principle of geographic hierarchy in URLs

**What we replace:**
- `/real-estate/us/oregon/{city}/` becomes `/homes-for-sale/{city}/`
- `{key}` as listing identifier becomes `{address-slug}-{mls-number}`
- `geo_places` table is deferred -- we use existing `cities` / `neighborhoods` / `communities` tables with `SubdivisionName` mapping

### What Stays the Same

These function signatures and APIs are NOT changing (preserving backward compatibility):
- `getCachedStats()` -- same name, same parameters, same return type. The data it returns becomes accurate.
- `getLiveMarketPulse()` -- same name, same parameters, same return type. Subdivision pulse data becomes populated.
- `listingDetailPath()` -- same function name, same parameter shape. The output URL format changes. All callers already pass the data needed for the new format.
- `subdivisionListingsPath()` -- same function, already handles optional neighborhood correctly.
- Filter page routes at `/search/{city}/{filter}` -- unchanged.
- City page routes at `/cities/{city}` -- unchanged.
- Neighborhood page routes at `/cities/{city}/{neighborhood}` -- unchanged.
- Community page routes at `/communities/{slug}` -- unchanged.

---

## Part H: LLM and AI Search Optimization

### Research Findings (Documented Sources)

**Google AI Overviews** ([Google: AI features and your website](https://developers.google.com/search/docs/appearance/ai-features)):
- No special markup, files, or schema required beyond standard Search eligibility
- Pages must be indexed and eligible for normal search snippets
- Depth of coverage, internal linking, and crawlability drive inclusion
- Standard structured data that matches visible content is recommended

**LLM search bots** (documented by each vendor):
- `OAI-SearchBot` (ChatGPT search) -- disallowing means site won't appear in ChatGPT answers
- `PerplexityBot` (Perplexity search) -- indexes and surfaces sites
- `Claude-SearchBot` (Claude search) -- respects robots.txt
- `Perplexity-User` and `ChatGPT-User` -- user-triggered fetches, may ignore robots.txt
- **Your `robots.ts` already allows all of these** -- no change needed

**Rich card display**: No vendor publishes a guaranteed "card schema." LLM search engines render results from crawled page content, structured data, and meta tags. The levers are: clean HTML with key facts (price, beds, baths, sqft, address, photo) prominently displayed + JSON-LD + Open Graph + fast page load.

**llms.txt**: Community proposal at [llmstxt.org](https://llmstxt.org/), not a standard. Google explicitly says it's NOT needed for AI Overviews. Useful as a curated index for AI agents and documentation discovery.

### What We'll Implement

**1. Listing pages optimized for LLM extraction (all part of existing plan)**

The performance and structured data work in Phases 3-7 directly serves LLM optimization:
- Clean, fast HTML with price/beds/baths/sqft/address in visible text (not trapped in JS)
- Accurate JSON-LD (`Product` + `Offer` + `BreadcrumbList`) matching visible content
- Strong Open Graph tags with hero photo, price in description, canonical URL
- Internal linking from community -> city -> listing pages (topical clusters)
- Sub-1s TTFB so crawlers get content quickly

**2. `llms.txt` and listing markdown summaries**

Create `/llms.txt` as a curated index pointing to key content areas:
```
# Ryan Realty - Central Oregon Real Estate

> Real estate brokerage serving Central Oregon. Search homes for sale in Bend, Redmond, Sisters, Sunriver, and surrounding areas.

## Active Listings
- [Homes for Sale](/homes-for-sale): Browse all active listings
- [Bend Homes](/homes-for-sale/bend): Homes for sale in Bend, Oregon
- [Redmond Homes](/homes-for-sale/redmond): Homes for sale in Redmond, Oregon
...

## Market Data
- [Housing Market](/housing-market): Current market conditions and statistics
- [Market Reports](/reports): Detailed market analysis and trends

## Communities
- [All Communities](/communities): Browse Central Oregon communities
...
```

**3. Listing page structured content for LLM parsing**

Each listing page should have a clean, machine-readable summary block in the HTML:

```html
<section aria-label="Property Summary">
  <h1>2145 NW Cascade View Dr, Bend, OR 97702</h1>
  <p>MLS# 220189456 | Listed at $725,000 | 3 Beds | 2.5 Baths | 2,100 Sq Ft</p>
  <p>Status: Active | Community: Northwest Crossing | City: Bend, Oregon</p>
</section>
```

This is NOT a new component -- it's ensuring the existing listing detail page has key facts in clean HTML at the top of the page, not buried in interactive components or client-side JS.

**4. MCP Server for Direct AI Access (Future Phase)**

An MCP server would allow AI assistants (Claude, ChatGPT, etc.) to directly query listings:

```
User: "Find me a 3-bedroom home in Bend under $500,000"
AI Assistant: [queries MCP server] -> Returns 5 matching listings with photos, prices, links
```

This is a separate initiative from the data architecture work but benefits enormously from it:
- Fast pre-computed stats in `market_stats_cache` power market questions
- Clean listing data with proper `ClosePrice` powers CMA questions
- MLS-based URLs provide meaningful links for users to click through

**Implementation approach**: Build a lightweight MCP server that exposes:
- `search_listings(city, min_price, max_price, beds, baths, ...)` -> listing results with photos and URLs
- `get_market_stats(city, community?)` -> current market data
- `get_listing_detail(mls_number)` -> full listing information
- `find_comparable_sales(address, radius_miles)` -> CMA-style comp search

This connects to the same Supabase database and uses the same cached data layer. The MCP server is read-only and rate-limited.

**Note**: MCP is for connected/installed users, not public search engines. It's a parallel track to SEO/web optimization.

### Files Impacted

| File | Change | Phase |
|------|--------|-------|
| `app/robots.ts` | Already allows AI bots -- verify and confirm | Phase 0B |
| New: `app/llms.txt/route.ts` or static file | Create llms.txt index | Phase 5 |
| `app/listing/[listingKey]/page.tsx` | Ensure key facts in clean HTML, not just in client components | Phase 6 |
| `components/listing/ListingJsonLd.tsx` | Verify JSON-LD matches visible content | Phase 5 |
| New: MCP server package | Listing search, market stats, CMA endpoints | Future phase |

---

## Part I: Continuous Enforcement (How to Ensure It's Always Done)

One-time fixes drift. The only way to guarantee ongoing quality is automated enforcement that blocks bad changes before they ship.

### CI Pipeline Additions

| Check | When | What It Does | Blocks Deploy? |
|-------|------|-------------|----------------|
| JSON-LD validation | Every PR | Playwright extracts `<script type="application/ld+json">` from listing/search/city/community templates, validates structure, asserts required fields | Yes |
| Structured data / visible content match | Every PR | Playwright scrapes JSON-LD price/address + DOM price/address on listing pages, asserts they match | Yes |
| Canonical URL consistency | Every PR | Script generates sitemap URLs, fetches sample pages, asserts `<link rel="canonical">` matches `listingDetailPath()` output | Yes |
| Meta tag completeness | Every PR | Check all public page routes export `generateMetadata` with `title`, `description`, `alternates.canonical`, `openGraph` | Yes |
| Breadcrumb parity | Every PR | Assert visible breadcrumb text matches `BreadcrumbList` JSON-LD for sample pages | Yes |
| Lighthouse CI | Every PR (preview URL) | LCP, INP, CLS, SEO, Accessibility scores meet thresholds | Warning (not blocking unless scores drop significantly) |
| Internal link crawl | Nightly on production | Crawl all internal links, flag 404s/broken links | Alert |
| Sitemap URL check | Nightly | Fetch every URL in sitemap.xml, assert 200 status | Alert |
| CrUX field data | Weekly | Pull Core Web Vitals from Chrome UX Report API, track regressions | Dashboard |

### Monitoring

| What | How | Frequency |
|------|-----|-----------|
| Google Search Console indexing | GSC API `searchAnalytics.query` for impressions/clicks/position | Daily pull |
| GSC URL Inspection | Rotating sample of listing URLs (2000/day limit) | Daily |
| Market stats freshness | `optimization-loop` cron checks `market_stats_cache.computed_at` and `market_pulse_live.updated_at` | Every 15 min |
| Structured data coverage | Count pages with valid JSON-LD vs total listing count | Weekly report |
| Sitemap freshness | Assert `lastmod` on listing URLs matches actual `ModificationTimestamp` from DB, not build time | Nightly |

### Enforcement Rules (Added to CI)

Extend existing `lint:seo-routes` and add new checks:

```
npm run lint:seo-routes        # Existing: canonical URL helpers
npm run lint:structured-data   # New: JSON-LD validation on template pages
npm run lint:meta-completeness # New: all routes have required metadata
npm run ci:lighthouse          # Existing: Lighthouse scores
npm run ci:a11y                # Existing: accessibility
```

These become part of the GitHub Actions pipeline documented in `AGENTS.md`.

---

## Part J: Blind Spots and Unknown Factors

Things the plan didn't originally cover that could undermine the entire effort if ignored.

### 1. Sold/Expired Listing Pages (SEO Strategy)

**The problem**: When a listing sells or expires, what happens to its URL? Currently undefined. Options:
- **410 Gone**: Google drops the page. Clean but loses all link equity.
- **Keep with noindex**: Page stays for users who bookmarked it, shows "Sold" status + related listings. Google removes from index over time. Best for UX.
- **301 to community page**: Misleading per Google guidelines. Don't do this.

**Recommendation**: Keep sold listing pages with `noindex`, update JSON-LD `Offer.availability` to `SoldOut`, show sold price and date, display related active listings. This serves both SEO (no dead links) and UX (users can still see the property info). After 12 months, optionally 410.

**Impact on plan**: Add logic to listing detail page for sold/expired state. Update `generateMetadata` to add `noindex` for non-active listings.

### 2. Image Alt Text (Currently Generic or Missing)

**The problem**: Listing photos likely have generic or missing alt text. Google Images is a significant traffic source for real estate. LLMs that process images rely on alt text for context.

**Recommendation**: Generate descriptive alt text for listing photos:
- Hero: `"Front exterior of 2145 NW Cascade View Dr, a 3-bedroom home in Northwest Crossing, Bend, Oregon"`
- Interior: `"Kitchen of 2145 NW Cascade View Dr"` (if room type is known from MLS data)
- Fallback: `"{address} - Photo {n} of {total}"`

**Impact on plan**: Add to listing detail page optimization (Phase 6).

### 3. Video Schema for Virtual Tours

**The problem**: Listings with virtual tours should have `VideoObject` schema. Currently `ListingJsonLd` may not include video structured data even when a virtual tour URL exists.

**Recommendation**: When `VirtualTourURLUnbranded` or video URL exists, add `VideoObject` to JSON-LD with `contentUrl`, `thumbnailUrl`, `name`, `description`.

**Impact on plan**: Add to structured data work (Phase 5).

### 4. Thin Content Pages

**The problem**: City or community pages with zero or minimal unique content are thin pages that Google may ignore or penalize. If a community page only shows listing tiles with no unique description, it's thin.

**Recommendation**: Set a minimum content threshold. Pages without a unique description of at least 100 words should either:
- Get content generated (from the place-content-pipeline)
- Be `noindex` until content is added

**Impact on plan**: Add content threshold check to CI. Already partially covered by `place-content-pipeline.ts`.

### 5. Server-Rendered Content for LLMs

**The problem**: LLM crawlers (GPTBot, PerplexityBot) are HTML fetchers, NOT full browsers. Any content that only appears after client-side JavaScript execution may be invisible to them.

**What to verify**: Key listing facts (price, address, beds/baths, MLS#, status) MUST be in the server-rendered HTML, not only in client components that hydrate after page load.

**Impact on plan**: Already addressed in Phase 6 (listing detail optimization). The plan replaces `select('*')` with explicit columns and renders key facts in server components. But we need to VERIFY this with a test that fetches pages without JavaScript and checks for key content.

### 6. Pagination and Infinite Scroll

**The problem**: Search results pages with many listings. LLMs can't scroll. Google has deprecated `rel=next/prev`.

**Current state**: The search page uses server-rendered tiles with pagination. This is correct. But verify:
- Each page of results has a unique URL (not just `?page=2` which could be `noindex`)
- Deep pagination pages aren't creating thin content
- The first page has enough listings to be meaningful

**Impact on plan**: Minor. Verify during Phase 13.

### 7. Content Freshness HTTP Headers

**The problem**: Beyond sitemap `lastmod`, HTTP headers like `Last-Modified` and `ETag` help crawlers understand when content changed. Next.js ISR handles some of this, but verify headers are correct.

**Impact on plan**: Minor. Verify during Phase 12.

### 8. FAQ Schema for Community/Neighborhood Pages

**The problem**: Community and neighborhood pages could include FAQ structured data for common questions ("What's the average home price in Northwest Crossing?", "How far is Broken Top from downtown Bend?"). This is a missed opportunity for rich results and AI citations.

**Recommendation**: Add FAQ sections with structured data to community pages where real Q&A content exists. Don't fabricate questions just for schema.

**Impact on plan**: Future enhancement, not part of current scope. Note for Phase 7 brief.

### 9. Agent/Office LocalBusiness Schema

**The problem**: Agent and team pages should have `RealEstateAgent` + `LocalBusiness` schema with NAP (Name, Address, Phone) consistency. This helps with local search and AI citations about the brokerage.

**Current state**: `components/JsonLd.tsx` includes `RealEstateAgent` + `LocalBusiness` site-wide. Team pages have `Person` schema. Verify consistency.

**Impact on plan**: Minor verification during Phase 13.

### 10. Sitemap `lastmod` From Actual Data

**The problem**: If sitemap `lastmod` is set to build time instead of actual `ModificationTimestamp` from the database, Google may ignore it. Google has publicly stated they ignore `lastmod` when it's unreliable.

**Recommendation**: Set `lastmod` from `listings.ModificationTimestamp` for listing URLs. For community/city pages, use the most recent listing modification in that geography.

**Impact on plan**: Add to sitemap update (Phase 3).

### Summary: Items Added to Plan Scope

| Blind Spot | Phase | Effort |
|-----------|-------|--------|
| Sold/expired listing page strategy | Phase 6 | Medium |
| Image alt text generation | Phase 6 | Small |
| Video schema for virtual tours | Phase 5 | Small |
| Thin content detection / enforcement | Phase 12 (CI) | Small |
| Server-rendered content verification | Phase 13 | Small |
| Sitemap `lastmod` from actual data | Phase 3 | Small |
| CI: JSON-LD validation | Phase 12 | Medium |
| CI: Structured data / content match | Phase 12 | Medium |
| CI: Meta tag completeness | Phase 12 | Small |
| GSC API monitoring setup | Phase 12 | Medium |
| CrUX tracking setup | Phase 12 | Small |

---

## Part K: Execution Safety (How to Avoid Hiccups)

Every code change in this repo passes through **15 automated gates** before it reaches production. If any gate rejects the change, the commit, push, PR, or deploy fails. The URL and data architecture changes WILL trigger many of these gates. The key is updating tests and enforcement scripts **in the same commit** as the code changes, not after.

### Automated Gates That Will Break

| Gate | Trigger | What Breaks | Update Simultaneously With |
|------|---------|-------------|---------------------------|
| **Pre-commit: `npm test`** | Every commit | `lib/slug.test.ts` asserts exact URL strings from `listingDetailPath()` | Phase 3 (URL structure changes) |
| **Pre-commit: `npm test`** | Every commit | `lib/canonical.test.ts` asserts canonical URL shapes | Phase 3 |
| **Pre-commit: `npm test`** | Every commit | `lib/sitemap.contract.test.ts` asserts sitemap contains `/homes-for-sale`, not `/listings` | Phase 3 |
| **Pre-commit: `npm test`** | Every commit | `lib/seo-route-contracts.test.ts` asserts route files contain `canonical` + metadata | Phase 5 |
| **Pre-commit: `npm test`** | Every commit | `lib/community-slug.test.ts` asserts community URL shapes | Phase 4 |
| **Pre-push: `build`** | Push to main | TypeScript compilation - any type errors from refactored code | Every phase |
| **Pre-push: `ci:design-tokens`** | Push to main | New UI that violates design system | Phases 6-7 (if adding UI) |
| **CI: `lint:seo-routes`** | Every PR | `check-seo-routes.mjs` forbids `/listings`, `/agents`, `/home-valuation` strings | Phase 3 (if touching those paths) |
| **CI: `lint:seo-routes`** | Every PR | `check-seo-authoring.mjs` requires metadata + canonical on routes under `app/search`, `app/listing`, `app/cities`, `app/communities` | Phase 3-5 |
| **CI: `lint:seo-routes`** | Every PR | `check-seo-authoring.mjs` requires `app/sitemap.ts` to reference `listingsBrowsePath()`, `teamPath()`, `valuationPath()` | Phase 3 |
| **CI: E2E** | Every PR | `e2e/critical-flows.spec.ts` asserts links contain `/listing/`, browses `/homes-for-sale/bend` | Phase 3 |
| **CI: build** | Every PR | `npm run build` - Next.js compilation | Every phase |
| **Post-deploy: smoke tests** | After merge to main | `.github/workflows/smoke-test.yml` curls `/homes-for-sale`, `/search/bend`, checks `og:title`, `canonical` | Phase 3 |
| **Nightly: Lighthouse** | `lighthouserc.cjs` | URLs: `/`, `/homes-for-sale/bend`, `/team`, `/about` | Phase 3 (if paths change) |
| **Nightly: pa11y** | `.pa11yci.json` | URL `/listings` (expects redirect to `/homes-for-sale`) | Phase 3 |

### The No-Hiccup Execution Rule

**Every commit must leave ALL gates green.** This means:

1. **Never change a URL helper without updating its tests in the same commit.** If `listingDetailPath()` now produces `/homes-for-sale/bend/nwx/2145-nw-cascade-view-dr-220189456` instead of `/homes-for-sale/bend/nwx/20240801234567890-97702`, then `lib/slug.test.ts` must be updated in the same commit.

2. **Never change a route without updating SEO scripts in the same commit.** If a new route pattern is added, `check-seo-authoring.mjs` PUBLIC_ROUTE_PREFIXES must include it.

3. **Never change redirects/rewrites without updating E2E tests in the same commit.** If `/listing/` URLs change shape, `e2e/critical-flows.spec.ts` assertions must match.

4. **Never push migrations without applying them.** Either `npm run db:push` first, or use `SKIP_DB_GUARD=1` on the push and apply immediately after.

5. **Run `npm run quality:full` locally before pushing.** This runs lint + design-tokens + seo-routes + test + build -- everything CI will check. Pre-push only runs a subset.

### Execution Order Within Each Phase

For each phase that touches URLs or tests:

```
1. Update lib/slug.ts (or other helpers)
2. Update tests in the same file batch (slug.test.ts, canonical.test.ts, etc.)
3. Run npm test locally -- must pass
4. Update next.config.ts redirects/rewrites if needed
5. Update check-seo-routes.mjs / check-seo-authoring.mjs if needed
6. Update E2E tests if needed
7. Update smoke-test.yml if needed
8. Run npm run quality:full -- must pass
9. Commit all together as one atomic change
10. npm run build -- must pass
11. Push
```

### Bypasses (When Needed)

| Env Variable | What It Skips | When to Use |
|-------------|--------------|-------------|
| `SKIP_LOCAL_GATES=1` | All pre-push checks | Emergency only; CI will still catch issues |
| `SKIP_DB_GUARD=1` | Migration drift check | When migrations are being applied separately |

### Files That Must Be Updated Atomically With URL Changes

These files form a **single unit of change** -- updating one without the others will break gates:

```
lib/slug.ts                              # URL builders
lib/slug.test.ts                         # URL builder tests
lib/canonical.test.ts                    # Canonical URL tests
lib/sitemap.contract.test.ts             # Sitemap URL tests
lib/community-slug.test.ts              # Community URL tests
lib/seo-route-contracts.test.ts         # SEO authoring tests
next.config.ts                           # Redirects + rewrites
app/sitemap.ts                           # Sitemap generation
scripts/check-seo-routes.mjs            # SEO URL lint rules
scripts/check-seo-authoring.mjs         # SEO metadata lint rules
e2e/critical-flows.spec.ts              # E2E URL assertions
e2e/user-journeys.spec.ts              # E2E journey paths
e2e/visual-regression.spec.ts          # Visual test paths
.github/workflows/smoke-test.yml       # Post-deploy URL checks
lighthouserc.cjs                        # Lighthouse target URLs
.pa11yci.json                           # Accessibility target URLs
```

All 16 files must be consistent. If `listingDetailPath()` output changes, all 16 must reflect that change in the same commit or the pipeline breaks.

---

## Part L: Scalability (Multi-MLS, Geographic Expansion, Growth)

The architecture must handle growth from one MLS to many, from one region to multiple states, and from thousands of listings to hundreds of thousands -- without requiring a rebuild.

### Current Scale and Future Trajectory

| Metric | Current (est.) | Near-term (2-3 MLS) | Growth target |
|--------|---------------|---------------------|---------------|
| Active listings | ~5-10K | ~15-30K | 50K+ |
| Total listing rows (incl. historical) | ~50-100K | ~200-500K | 1M+ |
| Cities | ~10-15 | ~30-50 | 100+ |
| Communities/subdivisions | ~100-200 | ~500-1000 | 2000+ |
| MLS sources | 1 (Central Oregon) | 2-3 (Portland, Salem, etc.) | 5+ |
| Daily listing changes | ~500-2K | ~5-10K | 20K+ |

### Design Decisions That Enable Scale (Build Now)

**1. MLS source identifier on all data**

The `listings` table needs an `mls_source` column (or equivalent) that identifies which MLS the listing came from. Currently everything comes from one Spark API feed so this isn't needed, but adding it now (default: `'central_oregon'`) costs nothing and prevents a painful migration later.

Similarly, `market_stats_cache` and `market_pulse_live` should have awareness of data source, so stats can be computed per-MLS or cross-MLS.

**Implementation**: Add `mls_source text NOT NULL DEFAULT 'central_oregon'` in Phase 1 migration. No app code changes needed yet -- it's just a column that exists.

**2. Dedupe-ready listing identity**

When a second MLS is added, the same property may appear in both feeds. The natural key `(mls_source, ListingKey)` is unique per MLS, but we need a way to group duplicate listings for the same physical property.

**Implementation**: Add `property_cluster_id uuid` column (nullable) to `listings` in Phase 1. Not populated yet, but ready for when dedupe logic is needed. When a second MLS comes online, a dedupe job populates this by matching on normalized address + parcel ID.

**3. URL structure that works for multiple regions**

The current URL scheme (`/homes-for-sale/{city}/{community}/...`) works fine for one region. When you expand to Portland or Salem, you might want `/homes-for-sale/or/portland/...` or `/homes-for-sale/portland/...`.

**The plan's URL scheme is forward-compatible**: Adding a state prefix later is a matter of:
- Adding an optional `state` parameter to `listingDetailPath()`
- Adding 301 redirects from old URLs to new ones
- The `{city}/{community}/{address}-{mls}` structure within a state doesn't change

**No code changes needed now.** The plan just needs to NOT hardcode assumptions that all listings are in Oregon.

**4. Incremental stats refresh (not full recompute)**

At 10 cities / 100 communities, computing stats for every segment takes seconds. At 50 cities / 500 communities, it takes minutes. At 100 cities / 2000 communities, a full recompute could timeout.

**Implementation built into Phase 8**:
- Add a `stats_dirty` flag (or `stats_stale_since timestamp`) to a segments table
- When delta sync changes a listing in city X / community Y, mark those segments dirty
- Stats refresh job processes only dirty segments, not all segments
- Chunked processing: 50 segments per batch, with `statement_timeout` per batch
- This scales O(changed segments) not O(all segments)

**5. Search scalability path**

PostgREST (Supabase REST API) is fine for the current scale. PostgreSQL can handle structured search with proper indexes well into hundreds of thousands of active listings. The plan's index work (Phase 1) ensures this.

When search becomes a bottleneck (typically before 1M active listings, or when you need fuzzy matching, typo tolerance, relevance ranking):
- Add Meilisearch or Typesense as a search index
- PostgreSQL remains source of truth
- Search index holds a searchable projection (key fields only, no `details` JSONB)
- Sync via CDC or batch from listing upserts

**No code changes needed now.** The plan's architecture (server actions returning typed results) makes swapping the search backend a localized change in `app/actions/listings.ts`.

**6. Database partitioning readiness**

PostgreSQL docs say partitioning is worthwhile when table size exceeds server RAM. For Supabase:
- Micro: 1GB RAM, consider partitioning at ~1GB table size
- Small: 2GB RAM
- Medium: 4GB RAM
- Large: 8GB RAM

The `listings` table is currently well under this threshold. When it approaches the RAM limit:
- Range partition `listing_history` by year (most natural, supports dropping old years)
- Optionally list partition `listings` by `mls_source` (only useful if queries always filter by MLS)

**No partitioning needed now.** The plan just needs to ensure queries always include partition-compatible predicates (e.g., always filter by city/status for listings, always include date range for history).

### Supabase-Specific Scaling Path

| Trigger | Action | Supabase Doc |
|---------|--------|-------------|
| Connection errors ("remaining slots") | Tune pooler settings, reduce client connections, or upgrade compute | [Performance](https://supabase.com/docs/guides/platform/performance) |
| DB > 4GB | Enable PITR backup | [Going into prod](https://supabase.com/docs/guides/platform/going-into-prod) |
| Read load saturates primary | Add read replicas for reporting/analytics queries | [Read Replicas](https://supabase.com/docs/guides/platform/read-replicas) |
| Disk IO budget consumed | Upgrade compute tier or switch to io2 disk | [Compute and Disk](https://supabase.com/docs/guides/platform/compute-and-disk) |
| Stats computation competes with OLTP | Route stats queries to read replica | Read Replicas doc |

### What We're NOT Over-Engineering

These are things that are NOT needed at current scale and should NOT be built now:

- **Elasticsearch/Meilisearch**: PostgreSQL search is sufficient for <100K active listings with proper indexes
- **Redis cache layer**: Next.js ISR + `unstable_cache` is sufficient for current traffic
- **Table partitioning**: Table sizes are well under RAM threshold
- **Separate ingest schema**: Single-MLS sync volume doesn't warrant it
- **Microservices**: Monolithic Next.js + Supabase is the right architecture at this scale
- **Kafka/event streaming**: Cron-based sync + summary table refresh is sufficient

The plan builds the foundation so that each of these CAN be added when the threshold is reached, without requiring a rewrite.

### Multi-MLS Field Mapping (Future Reference)

When MLS #2 is added, a mapping layer is needed:

```
MLS Feed → Per-MLS Transform → Canonical RESO Schema → listings table
```

Each MLS has its own:
- Status value mapping (e.g., "Sold" vs "Closed" vs "Settlement")
- Property type taxonomy
- Field name variants
- Photo URL patterns
- History event formats

This is handled by a `mls_field_mapping` table (or config file) per MLS, with the transform layer in the sync pipeline. The current `sparkListingToSupabaseRow` function in `lib/spark.ts` IS this transform for MLS #1. Adding MLS #2 means adding a second transform function, not changing the first.

---

## Expected Outcomes

| Area | Current | After |
|------|---------|-------|
| Listing URL (no neighborhood) | `/homes-for-sale/bend/nwx/20240801234567890-97702` | `/homes-for-sale/bend/northwest-crossing/2145-nw-cascade-view-dr-220189456` |
| Listing URL (with neighborhood) | `/homes-for-sale/bend/westside/nwx/20240801234567890-97702` | `/homes-for-sale/bend/westside/northwest-crossing/2145-nw-cascade-view-dr-220189456` |
| Listing detail TTFB | 2-4s | 400-800ms |
| Search TTFB | 1-3s | 500ms-1s |
| Stats accuracy | Wrong (ListPrice, no closed filter) | Correct (ClosePrice, closed-only, true medians) |
| Community stats | Often empty | Always pre-computed |
| Historical data | Not available | Year-over-year back to 2020 |
| CMA availability | Fails silently for most listings | Works for all, pre-computed for active |
| Breadcrumb consistency | 4+ different patterns | One consistent pattern |
| First crumb | "Home" or "Ryan Realty" or missing | Always "Home" |
