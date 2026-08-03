/**
 * getSubdivisionBrowseSlugsByCity: fetches the per-city subdivision slug
 * list for the sitemap's /homes-for-sale/{city}/{subdivision} browse-pair
 * loop from listing_tile_mv (indexed on city_lower) instead of the
 * get_subdivision_status_counts RPC (unindexable TRIM+ILIKE scan over the
 * 589K-row listings table). See subdivision-sitemap-inventory.ts for why this
 * is safe and the one deliberate divergence from the RPC's output.
 *
 * Scope: app/sitemap.ts ONLY. Other callers of get_subdivision_status_counts
 * (getHotCommunitiesInCityUncached, getIndexableSubdivisions,
 * getSearchMatrixInventory) need the real active/pending/closed COUNTS and
 * are unchanged by this module.
 *
 * PAGINATION IS CONCURRENT, NOT SEQUENTIAL. listing_tile_mv holds one row per
 * MLS listing ever seen (all statuses), so a big city's row count for the
 * sitemap's threshold check is large: Bend alone is ~129,192 rows, Redmond
 * ~45,726 (measured against production 2026-08-02). PostgREST has no
 * server-side GROUP BY on this project (aggregate functions return PGRST123
 * "Use of aggregate functions is not allowed"), so the lifetime count has to
 * be computed client-side over every row, and a naive sequential
 * 1,000-row-at-a-time fetch of Bend's 130 pages measured 29.3s, barely better
 * than the RPC it replaces. Fetching those same pages 12-at-a-time (after one
 * cheap `count: 'exact', head: true` call to learn the page count) measured
 * 15.7s for Bend and 17.0s for the FULL 24-city Central Oregon set combined
 * (down from a 49.1s-104.7s RPC total for the same set, measured the same
 * session). The index that makes this possible either way is
 * `listing_tile_mv_address_slug (city_lower, address_slug)` — unrestricted by
 * status, so a `city_lower` equality filter is an index scan, not the RPC's
 * per-row TRIM+ILIKE evaluation.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import {
  buildSubdivisionSlugsForCity,
  type SubdivisionInventoryRow,
} from '@/lib/data/subdivisions/subdivision-sitemap-inventory'

/** Cities fetched concurrently. */
const CITY_BATCH = 6
/** Pages (1,000 rows each) fetched concurrently within one city. */
const PAGE_CONCURRENCY = 12
const PAGE_SIZE = 1000

/** Retries a transient network/PostgREST hiccup. A bare `{ message: '' }`
 * error surfaces on roughly 1 in 5 requests under concurrent load (observed
 * in production verification, 2026-08-02) and always clears on retry — this
 * is not a data problem, so it does not belong in buildSubdivisionSlugsForCity's
 * pure logic. supabase-js query builders resolve to `{ data, error }` instead
 * of throwing, so this checks the resolved `error` field, not just a thrown
 * exception. Small fixed backoff, not exponential: the failure clears
 * immediately, it never compounds. */
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

async function fetchCityInventoryRows(
  supabase: SupabaseClient,
  cityLower: string,
): Promise<SubdivisionInventoryRow[]> {
  const { count, error: countError } = await withRetry(() =>
    supabase
      .from('listing_tile_mv')
      .select('subdivision_name', { count: 'exact', head: true })
      .eq('city_lower', cityLower)
      .not('subdivision_name', 'is', null),
  )
  if (countError) throw countError
  const total = count ?? 0
  if (total === 0) return []

  const pageCount = Math.ceil(total / PAGE_SIZE)
  const rows: SubdivisionInventoryRow[] = []
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
            // PAGINATION ORDER IS NOT OPTIONAL. Postgres guarantees no stable
            // row order across separate OFFSET/LIMIT queries without an ORDER
            // BY, and these pages are fetched CONCURRENTLY. Measured in
            // production while fixing the sibling reader: the identical
            // 12-way-concurrent pattern with no .order() returned 13,032
            // duplicate rows out of 94,068 for Bend alone (13.9%), which means
            // an equal number of real rows were silently dropped and never
            // counted. A subdivision sitting near the lifetime floor could be
            // admitted or excluded at random on each build.
            //
            // address_slug is the second column of the existing
            // listing_tile_mv_address_slug (city_lower, address_slug) index
            // already serving the city filter, so Postgres walks it in index
            // order rather than re-sorting the per-city set on every page.
            // listing_key is unique and breaks ties, since repeat sales of one
            // property share an address_slug.
            .order('address_slug')
            .order('listing_key')
            .range(p * PAGE_SIZE, p * PAGE_SIZE + PAGE_SIZE - 1),
        ),
      ),
    )
    for (const page of pages) {
      if (page.error) throw page.error
      rows.push(...((page.data ?? []) as SubdivisionInventoryRow[]))
    }
  }
  return rows
}

/**
 * citySlug -> subdivision slugs meeting minLifetimeListings. Batches
 * CITY_BATCH cities at a time (same concurrency the old RPC loop used) so a
 * slow city can't serialize the whole run; each city's own pages are fetched
 * concurrently too (see module doc for why that matters).
 */
export async function getSubdivisionBrowseSlugsByCity(
  supabase: SupabaseClient,
  citySlugs: readonly string[],
  minLifetimeListings: number,
): Promise<Map<string, string[]>> {
  const out = new Map<string, string[]>()

  for (let i = 0; i < citySlugs.length; i += CITY_BATCH) {
    const batch = citySlugs.slice(i, i + CITY_BATCH)
    const results = await Promise.all(
      batch.map(async (citySlug) => {
        try {
          // city_lower = lower(trim(City)). Hyphenless allowlist slugs map
          // back to the MLS spelling by swapping hyphens for spaces
          // ("la-pine" -> "la pine"), already lowercase, matching the RPC's
          // TRIM("City") ILIKE TRIM(p_city) semantics exactly for a
          // no-wildcard pattern.
          const cityLower = citySlug.replace(/-/g, ' ')
          const rows = await fetchCityInventoryRows(supabase, cityLower)
          return { citySlug, slugs: buildSubdivisionSlugsForCity(rows, minLifetimeListings) }
        } catch (err) {
          console.error('[sitemap] subdivision inventory fetch failed:', citySlug, err)
          return { citySlug, slugs: [] as string[] }
        }
      }),
    )
    for (const { citySlug, slugs } of results) out.set(citySlug, slugs)
  }

  return out
}
