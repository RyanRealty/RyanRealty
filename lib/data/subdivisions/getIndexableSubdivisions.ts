/**
 * getIndexableSubdivisions — the live indexable-subdivision set feeding the
 * sitemap, llms.txt, and the /subdivisions/[slug] noindex decision.
 *
 * Sources (both already deployed — no new migration required for this read):
 *   1. public.boundaries geo_type='subdivision' (3,213 Deschutes County GIS
 *      plat polygons) — paginated via fetchAllRows (PostgREST 1,000-row cap).
 *   2. listing_tile_mv per Central Oregon city, filtered to closed-ish rows
 *      (`.ilike('standard_status', '%closed%')`) — NOT the
 *      get_subdivision_status_counts(p_city) RPC. That RPC filters
 *      `TRIM("City") ILIKE TRIM(p_city)` over the 589K-row `listings` table,
 *      an unindexable expression forcing a sequential scan per call: measured
 *      against production 2026-08-02, Bend 41.3s + Sisters 32.0s + Redmond
 *      14.6s + six more cities = 104.7s for eight cities alone, the root
 *      cause of the /sitemaps/*.xml 504s (maxDuration 300). See
 *      getSubdivisionBrowseSlugsByCity.ts (the sibling fix for the sitemap's
 *      browse-pair loop) for the full measurement and the index that makes
 *      this possible: `listing_tile_mv_address_slug (city_lower,
 *      address_slug)` is unrestricted by status, so a `city_lower` equality
 *      filter is an index scan, not the RPC's per-row TRIM+ILIKE evaluation.
 *
 * This module only needs the LIFETIME CLOSED count per subdivision
 * (buildIndexableSubdivisions reads `row.closed`, never `active`/`pending`),
 * so the server-side filter narrows to closed-ish rows before pagination —
 * far fewer rows per city than the browse-pair loop fetches (which needs
 * every status). Every fetched row is still re-classified client-side with
 * classifyLifetimeBuckets() (the exact same per-row logic
 * subdivision-sitemap-inventory.ts uses, verified byte-for-byte against the
 * RPC's `LOWER(COALESCE("StandardStatus",'')) LIKE '%closed%'` FILTER clause)
 * before it counts, so a syntactically-loose ILIKE never silently overcounts.
 *
 * ONE deliberate divergence, not a bug (same as the browse-pair fix):
 * listing_tile_mv is defined `WHERE permit_internet_yn IS DISTINCT FROM false
 * AND idx_participant IS DISTINCT FROM false`
 * (supabase/migrations/20260729193000_...). The RPC scans raw `listings` and
 * has no such filter. A subdivision whose closed-sale count only clears the
 * threshold via internet-display-opted-out or non-IDX-participant listings
 * can therefore show a lower (or zero) count here than the RPC would report.
 * See the scratch verification script referenced from this fix's commit for
 * production counts of this delta.
 *
 * PAGINATION ORDER IS NOT OPTIONAL. Every paginated page query below carries
 * `.order('address_slug').order('listing_key')`. Without ANY stable order,
 * concurrent range()/OFFSET-LIMIT pages have no guaranteed stable row order
 * in Postgres — verified in production while building this fix: the
 * identical 12-way-concurrent pagination pattern with no `.order()` at all
 * returned 13,032 duplicate rows out of 94,068 fetched for Bend's closed-ish
 * set alone (13.9%), meaning an equal count of real closed sales were
 * silently dropped from a different page and never counted. That is a
 * §0-grade defect, not a cosmetic ordering nicety. address_slug (not
 * listing_key alone) is the sort key because it's the second column of the
 * same listing_tile_mv_address_slug (city_lower, address_slug) index already
 * serving the city_lower filter, so Postgres walks that index in-order
 * instead of sorting the whole per-city closed-row set from scratch on every
 * page request (44.1s vs 34.8s for Bend, same correctness either way);
 * listing_key breaks ties since a property's repeat closed sales over MLS
 * history share one address_slug.
 *
 * The intersection + threshold logic is pure and lives in
 * lib/data/subdivisions/subdivision-index.ts (vitest-pinned). Cached 6h via
 * makeResilientCached: the fetch THROWS on any transient error so a blip is
 * never cached as "zero indexable subdivisions" (which would noindex 3,213
 * pages and empty the sitemap section for the whole TTL) — one uncached retry,
 * then the [] fallback for that single render only.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { createServiceClient } from '@/lib/data/client'
import { fetchAllRows } from '@/lib/supabase/paginate'
import { CENTRAL_OREGON_CITY_SLUGS } from '@/lib/central-oregon'
import { makeResilientCached } from '@/lib/data/cache/resilient'
import { CACHE_WINDOWS, cacheTag } from '@/lib/data/cache/unstable-cache'
import {
  classifyLifetimeBuckets,
  type SubdivisionInventoryRow,
} from '@/lib/data/subdivisions/subdivision-sitemap-inventory'
import {
  buildIndexableSubdivisions,
  type CitySubdivisionCounts,
  type IndexableSubdivision,
  type SubdivisionStatusCountRow,
} from '@/lib/data/subdivisions/subdivision-index'

/** Cities fetched concurrently — same concurrency the old RPC loop used. */
const CITY_BATCH = 6
/** Pages (1,000 rows each) fetched concurrently within one city, mirroring
 * getSubdivisionBrowseSlugsByCity's pagination (see that file's module doc
 * for why sequential pagination is too slow at this row scale). */
const PAGE_CONCURRENCY = 12
const PAGE_SIZE = 1000

/** Retries a transient network/PostgREST hiccup — same rationale and shape as
 * the identically-named helper in getSubdivisionBrowseSlugsByCity.ts (not
 * shared code: that module is frozen, this one has its own copy). */
async function withRetry<T extends { error: unknown }>(fn: () => PromiseLike<T>, attempts = 3): Promise<T> {
  let last: T | undefined
  for (let i = 0; i < attempts; i++) {
    try {
      const result = await fn()
      if (!result.error) return result
      last = result
    } catch (err) {
      last = { error: err } as T
    }
    if (i < attempts - 1) await new Promise((r) => setTimeout(r, 150))
  }
  return last as T
}

/**
 * Per-city lifetime CLOSED count per subdivision name, sourced from
 * listing_tile_mv instead of the RPC. Returns [] for a city with genuinely
 * zero closed-ish rows (not an error — small cities can have none). Throws
 * on a real fetch failure so the 6h cache is never poisoned with a false
 * zero (same contract the RPC call used to provide).
 */
async function fetchCityClosedSubdivisionCounts(
  supabase: SupabaseClient,
  citySlug: string,
): Promise<SubdivisionStatusCountRow[]> {
  // Hyphenless allowlist slugs map back to the MLS spelling by swapping
  // hyphens for spaces ("la-pine" -> "la pine"), matching the RPC's
  // TRIM("City") ILIKE TRIM(p_city) semantics for a no-wildcard pattern —
  // identical mapping to getSubdivisionBrowseSlugsByCity.
  const cityLower = citySlug.replace(/-/g, ' ')

  const { count, error: countError } = await withRetry(() =>
    supabase
      .from('listing_tile_mv')
      .select('subdivision_name', { count: 'exact', head: true })
      .eq('city_lower', cityLower)
      .not('subdivision_name', 'is', null)
      .ilike('standard_status', '%closed%'),
  )
  if (countError) {
    throw new Error(
      `getIndexableSubdivisions: listing_tile_mv count failed for ${citySlug}: ${countError.message}`,
    )
  }
  const total = count ?? 0
  if (total === 0) return []

  const pageCount = Math.ceil(total / PAGE_SIZE)
  const closedBySubdivisionName = new Map<string, number>()
  for (let start = 0; start < pageCount; start += PAGE_CONCURRENCY) {
    const pageIndexes: number[] = []
    for (let p = start; p < Math.min(start + PAGE_CONCURRENCY, pageCount); p++) pageIndexes.push(p)
    const pages = await Promise.all(
      pageIndexes.map((p) =>
        withRetry(() =>
          supabase
            .from('listing_tile_mv')
            .select('subdivision_name,standard_status')
            .eq('city_lower', cityLower)
            .not('subdivision_name', 'is', null)
            .ilike('standard_status', '%closed%')
            // ORDER BY a stable key is NOT optional here. Concurrent
            // range()/OFFSET-LIMIT pages with no ORDER BY have no guaranteed
            // stable row order in Postgres — verified in production: the
            // same 12-way-concurrent pagination with no `.order()` returned
            // 13,032 duplicate listing_key rows out of 94,068 for Bend alone
            // (13.9%), meaning an equal number of rows were silently dropped
            // from a different page. That is a §0-grade defect (undercounted
            // closed sales -> wrong indexability verdicts), not a cosmetic
            // ordering nicety.
            //
            // Order by (address_slug, listing_key), not listing_key alone.
            // address_slug is the SECOND column of the same
            // listing_tile_mv_address_slug (city_lower, address_slug) index
            // that already serves the city_lower filter, so Postgres can walk
            // that index in-order instead of materializing and sorting the
            // whole per-city closed-row set (~94K rows for Bend) fresh on
            // every one of the ~95 page requests — measured 44.1s for Bend
            // ordering by listing_key alone vs 34.8s ordering by
            // (address_slug, listing_key), same correctness (zero dups
            // either way). listing_key breaks ties: address_slug repeats
            // across a property's multiple closed sales over MLS history
            // (same address, different listing_key), so address_slug alone
            // is not a unique sort key.
            .order('address_slug', { ascending: true })
            .order('listing_key', { ascending: true })
            .range(p * PAGE_SIZE, p * PAGE_SIZE + PAGE_SIZE - 1),
        ),
      ),
    )
    for (const page of pages) {
      if (page.error) {
        throw new Error(
          `getIndexableSubdivisions: listing_tile_mv page fetch failed for ${citySlug}: ${page.error.message}`,
        )
      }
      for (const row of (page.data ?? []) as SubdivisionInventoryRow[]) {
        const name = (row.subdivision_name ?? '').trim()
        if (!name) continue
        // Defense in depth: re-verify 'closed' client-side with the exact
        // same per-row logic subdivision-sitemap-inventory.ts uses (byte-for-
        // byte the RPC's own FILTER clause) rather than trusting the
        // server-side ILIKE alone — a row the server matched but this
        // reclassifies as not-closed is dropped, never miscounted.
        if (!classifyLifetimeBuckets(row.standard_status).includes('closed')) continue
        closedBySubdivisionName.set(name, (closedBySubdivisionName.get(name) ?? 0) + 1)
      }
    }
  }

  return Array.from(closedBySubdivisionName, ([subdivision_name, closed]) => ({
    subdivision_name,
    closed,
  }))
}

async function fetchIndexableSubdivisions(): Promise<IndexableSubdivision[]> {
  // SERVICE client, not anon, verified 2026-07-22: public.boundaries RLS hides
  // subdivision rows from anon (anon read = 0 rows, service = 3,213). All
  // three consumers (sitemap, llms.txt, generateMetadata robots) are
  // server-only, and the output is non-sensitive (plat slugs + aggregate
  // counts).
  const supabase = createServiceClient()

  // 1. Every plat slug with an authoritative polygon.
  const boundaryRows = await fetchAllRows<{ geo_slug?: string | null }>(
    supabase,
    'boundaries',
    'geo_slug',
    (q) => q.eq('geo_type', 'subdivision'),
  )
  const boundarySlugs = new Set(
    boundaryRows.map((r) => (r.geo_slug ?? '').trim()).filter((s) => s.length > 0),
  )
  if (boundarySlugs.size === 0) {
    // 3,213 plats exist in production — an empty read here is a failed read,
    // not a genuine empty. Throw so makeResilientCached never caches it.
    throw new Error('getIndexableSubdivisions: boundaries returned 0 subdivision slugs')
  }

  // 2. Per-city lifetime closed counts from listing_tile_mv, batched like the
  // sitemap's browse-pair loop (CITY_BATCH cities concurrently, each city's
  // own pages fetched PAGE_CONCURRENCY at a time — see fetchCityClosedSubdivisionCounts).
  const citySlugs = [...CENTRAL_OREGON_CITY_SLUGS]
  const cityCounts: CitySubdivisionCounts[] = []
  for (let i = 0; i < citySlugs.length; i += CITY_BATCH) {
    const batch = citySlugs.slice(i, i + CITY_BATCH)
    const results = await Promise.all(
      batch.map(async (citySlug) => ({
        citySlug,
        rows: await fetchCityClosedSubdivisionCounts(supabase, citySlug),
      })),
    )
    cityCounts.push(...results)
  }

  return buildIndexableSubdivisions(boundarySlugs, cityCounts)
}

/**
 * The cached indexable set. 6h TTL (CACHE_WINDOWS.marketStats) — the inputs
 * (closed-sale counts) only move on closings, and the sitemap itself
 * regenerates hourly, so 6h staleness is invisible.
 */
export const getIndexableSubdivisions = makeResilientCached(
  fetchIndexableSubdivisions,
  ['indexable-subdivisions-v1'],
  {
    revalidate: CACHE_WINDOWS.marketStats,
    tags: [cacheTag.market, 'boundaries'],
  },
  [],
)

/**
 * Page-side membership check for the /subdivisions/[slug] noindex decision.
 * Below-threshold (or polygon-less) slugs still render — they just carry
 * noindex via pageMetadata.
 */
export async function isSubdivisionIndexable(slug: string): Promise<boolean> {
  const set = await getIndexableSubdivisions()
  return set.some((s) => s.slug === slug)
}
