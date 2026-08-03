/**
 * Search-matrix DAL reads (W3.2/3.3, 2026-07-22).
 *
 * Powers lib/seo/search-matrix.ts — the 3-segment
 * /homes-for-sale/{city}/{area}/{preset} emission logic. The design rule is
 * ONE aggregate inventory read, not a query per (geo x preset) combo: the
 * pure matcher in lib/seo/search-matrix.ts evaluates every combination in
 * memory against this slim row set.
 *
 * All exports use makeResilientCached with a `null` fallback so callers can
 * distinguish "no data" (a real empty result) from "read failed" (null) and
 * fail OPEN: an unknown inventory state must never noindex a live page or
 * silently drop the whole matrix from the sitemap on a transient blip.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { supabaseAnon } from '@/lib/data/client'
import { cacheTag } from '@/lib/data/cache/unstable-cache'
import { makeResilientCached } from '@/lib/data/cache/resilient'
import { SERVICE_AREA_CITIES_LOWER } from '@/lib/data/listings/service-area'
import { PUBLIC_ON_MARKET_STATUSES } from '@/lib/listing-status-public'
import {
  classifyLifetimeBuckets,
  type SubdivisionInventoryRow,
} from '@/lib/data/subdivisions/subdivision-sitemap-inventory'

/** Matches the hourly sitemap ISR window — the matrix is a sitemap input. */
const MATRIX_CACHE_SECONDS = 3600

/** PostgREST rows-per-request cap (project memory: 1000-row cap). */
const PAGE_SIZE = 1000

/** Defensive ceiling — the on-market service-area set is ~5-10K rows. */
const MAX_ROWS = 20000

/**
 * The slim column set the pure preset matcher needs. Deliberately excludes
 * public_remarks (keyword presets are not emitted at area scope — hauling
 * remarks would multiply the payload ~10x for nothing).
 */
export type SearchMatrixInventoryRow = {
  standard_status: string | null
  list_price: number | null
  city_lower: string | null
  subdivision_lower: string | null
  boundary_neighborhood: string | null
  property_type: string | null
  property_sub_type: string | null
  year_built: number | null
  lot_size_acres: number | null
  pool_yn: boolean | null
  fireplace_yn: boolean | null
  waterfront_yn: boolean | null
  view_types: string[] | null
  hoa_amenities: string[] | null
  parking_features: string[] | null
}

const INVENTORY_COLUMNS = [
  'standard_status',
  'list_price',
  'city_lower',
  'subdivision_lower',
  'boundary_neighborhood',
  'property_type',
  'property_sub_type',
  'year_built',
  'lot_size_acres',
  'pool_yn',
  'fireplace_yn',
  'waterfront_yn',
  'view_types',
  'hoa_amenities',
  'parking_features',
].join(', ')

async function fetchSearchMatrixInventory(): Promise<SearchMatrixInventoryRow[]> {
  const supabase = supabaseAnon()
  if (!supabase) throw new Error('[getSearchMatrixInventory] supabase not configured')

  const rows: SearchMatrixInventoryRow[] = []
  for (let offset = 0; offset < MAX_ROWS; offset += PAGE_SIZE) {
    const { data, error } = await supabase
      .from('listing_search_mv')
      .select(INVENTORY_COLUMNS)
      .in('city_lower', SERVICE_AREA_CITIES_LOWER)
      .in('standard_status', PUBLIC_ON_MARKET_STATUSES)
      .order('listing_key', { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1)
    if (error) {
      // THROW so a transient error is never cached as an empty inventory
      // (poison-null pattern — see lib/data/cache/resilient.ts).
      throw new Error(`[getSearchMatrixInventory] supabase error: ${error.message}`)
    }
    const page = (data ?? []) as unknown as SearchMatrixInventoryRow[]
    rows.push(...page)
    if (page.length < PAGE_SIZE) break
  }
  return rows
}

/**
 * The one aggregate inventory read: every public on-market row in the
 * Central Oregon service area, slim columns only. `null` = read failed
 * (callers fail open); an array is authoritative.
 *
 * DELIBERATELY NOT unstable_cache'd. This row set is ~2.3MB, over Next's 2MB
 * data-cache ceiling, so every write attempt failed with "items over 2MB can
 * not be cached" — the entry never populated, every call re-ran the paginated
 * scan, and a production build spent minutes looping on it while emitting that
 * error every 2-3 seconds (found 2026-07-28, it was stalling deploys).
 *
 * The cache boundary moved DOWNSTREAM to the derived matrix in
 * lib/seo/getSearchMatrixEntries.ts, which is a few KB of path→count instead of
 * every listing row. Callers that need the raw rows get one read per request
 * (React `cache()` memoizes within a request); nothing re-reads it per lookup.
 *
 * If you are tempted to wrap this again: check the payload size first.
 */
export async function getSearchMatrixInventory(): Promise<SearchMatrixInventoryRow[] | null> {
  try {
    return await fetchSearchMatrixInventory()
  } catch (e) {
    // Fail OPEN, matching the previous makeResilientCached fallback: a failed
    // read must never be mistaken for "zero inventory" (that would noindex live
    // pages and empty the sitemap).
    console.error('[getSearchMatrixInventory] read failed:', e instanceof Error ? e.message : e)
    return null
  }
}

// ---------------------------------------------------------------------------
// Subdivision lifetime counts (the D1 browse-URL persistence threshold input)
// ---------------------------------------------------------------------------

export type SubdivisionLifetimeCountRow = {
  subdivision_name: string | null
  active: number | null
  pending: number | null
  closed: number | null
}

/** Pages (1,000 rows each) fetched concurrently within one city — mirrors
 * getSubdivisionBrowseSlugsByCity.ts / getIndexableSubdivisions.ts. Those two
 * modules already replaced their own get_subdivision_status_counts(p_city)
 * calls with a listing_tile_mv scan for the identical reason documented in
 * their module docs: the RPC's `TRIM("City") ILIKE TRIM(p_city)` predicate is
 * unindexable and forces a sequential scan of the 589K-row `listings` table
 * per call (measured against production 2026-08-02: Bend 41.3s, Sisters
 * 32.0s, Redmond 14.6s, 104.7s for eight cities). listing_tile_mv carries the
 * same one-row-per-listing data with an indexed `city_lower` column
 * (`listing_tile_mv_address_slug (city_lower, address_slug)`), so a
 * `city_lower` equality filter is an index scan instead. */
const PAGE_CONCURRENCY = 12

/** Retries a transient network/PostgREST hiccup — same rationale and shape as
 * the identically-named helper in getSubdivisionBrowseSlugsByCity.ts /
 * getIndexableSubdivisions.ts (not shared code: each module keeps its own
 * copy, per those files' comments). A bare `{ message: '' }` error surfaces on
 * roughly 1 in 5 requests under concurrent load and always clears on retry. */
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
 * Every listing_tile_mv row (subdivision_name + standard_status only) for one
 * city, fetched via concurrent, ORDERED pagination.
 *
 * PAGINATION ORDER IS NOT OPTIONAL. `.order('address_slug').order('listing_key')`
 * on every page is required for correctness, not style: Postgres guarantees no
 * stable row order across separate OFFSET/LIMIT queries without an ORDER BY,
 * and these pages are fetched CONCURRENTLY. The sibling fix
 * (getSubdivisionBrowseSlugsByCity.ts) measured the consequence in production
 * for the identical unordered pattern: 13,032 duplicate rows out of 94,068 for
 * Bend alone (13.9%), meaning an equal number of real rows were silently
 * dropped from a different page and never counted — a subdivision sitting
 * near the D1 lifetime-sales threshold could be admitted or excluded at
 * random on each build. address_slug is the second column of the existing
 * listing_tile_mv_address_slug (city_lower, address_slug) index already
 * serving the city_lower filter, so Postgres walks it in index order rather
 * than re-sorting the per-city set on every page; listing_key breaks ties
 * since a property's repeat sales share one address_slug.
 */
async function fetchCityInventoryRowsForLifetimeCounts(
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
  if (countError) {
    throw new Error(
      `[getSubdivisionLifetimeCounts] listing_tile_mv count failed for ${cityLower}: ${countError.message}`,
    )
  }
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
            .order('address_slug')
            .order('listing_key')
            .range(p * PAGE_SIZE, p * PAGE_SIZE + PAGE_SIZE - 1),
        ),
      ),
    )
    for (const page of pages) {
      if (page.error) {
        throw new Error(
          `[getSubdivisionLifetimeCounts] listing_tile_mv page fetch failed for ${cityLower}: ${page.error.message}`,
        )
      }
      rows.push(...((page.data ?? []) as SubdivisionInventoryRow[]))
    }
  }
  return rows
}

async function fetchSubdivisionLifetimeCounts(
  citySlug: string,
): Promise<SubdivisionLifetimeCountRow[]> {
  // Anon, not service: listing_tile_mv is granted `select` to anon,
  // authenticated, AND service_role identically (the Coming Soon exclusion
  // baked into the view's WHERE clause applies to every role the same way —
  // see supabase/migrations/20260721091000_coming_soon_mv_lockdown.sql), and
  // app/sitemap.ts already reads this same view with the anon client
  // (getSubdivisionBrowseSlugsByCity). The service client here used to exist
  // ONLY because get_subdivision_status_counts ran ~3.1s per city, past the
  // anon role's 3s statement_timeout — that RPC call is gone, so that
  // justification is gone with it. Using the anon client matches every other
  // export in this file (fetchSearchMatrixInventory, etc.) and this module's
  // own supabaseAnon() import.
  const supabase = supabaseAnon()
  if (!supabase) throw new Error('[getSubdivisionLifetimeCounts] supabase not configured')

  // Matches the RPC's TRIM("City") ILIKE TRIM(p_city) semantics for a
  // no-wildcard pattern — hyphenless slugs map back to the MLS spelling by
  // swapping hyphens for spaces ('la-pine' -> 'la pine'), already lowercase
  // (listing_tile_mv.city_lower = lower(trim("City"))).
  const cityLower = citySlug.replace(/-/g, ' ')
  const rows = await fetchCityInventoryRowsForLifetimeCounts(supabase, cityLower)

  // Group by the RAW trimmed subdivision_name (case preserved, exactly like
  // the RPC's `COALESCE(TRIM("SubdivisionName"), '')` grouping key) — the
  // downstream consumer (buildSubdivisionGeos in getSearchMatrixEntries.ts)
  // does its own 'N/A'/'unknown'-slug filtering and lower-cases every name it
  // keeps, so this fetch must not pre-filter or normalize case: doing so
  // would silently change which rows the RPC used to return.
  const countsByName = new Map<string, { active: number; pending: number; closed: number }>()
  for (const row of rows) {
    const name = (row.subdivision_name ?? '').trim()
    // Mirrors the RPC's `TRIM(COALESCE("SubdivisionName", '')) <> ''` filter —
    // an empty subdivision name never gets a row, in either implementation.
    if (!name) continue
    const entry = countsByName.get(name) ?? { active: 0, pending: 0, closed: 0 }
    for (const bucket of classifyLifetimeBuckets(row.standard_status)) entry[bucket] += 1
    countsByName.set(name, entry)
  }

  return Array.from(countsByName, ([subdivision_name, counts]) => ({
    subdivision_name,
    ...counts,
  }))
}

/**
 * Per-city subdivision active/pending/closed counts, sourced from
 * listing_tile_mv instead of the get_subdivision_status_counts RPC (see
 * PAGE_CONCURRENCY's doc comment above for why). Semantics match the RPC
 * byte-for-byte via classifyLifetimeBuckets(), with one deliberate
 * divergence: listing_tile_mv excludes internet-display-opted-out /
 * non-IDX-participant listings that the RPC's raw `listings` scan includes
 * (same divergence as the sibling fixes in
 * lib/data/subdivisions/getSubdivisionBrowseSlugsByCity.ts and
 * getIndexableSubdivisions.ts). Lifetime = active + pending + closed.
 * `null` = failed.
 */
export const getSubdivisionLifetimeCounts = makeResilientCached<
  [string],
  SubdivisionLifetimeCountRow[] | null
>(
  fetchSubdivisionLifetimeCounts,
  ['search-matrix-subdivision-counts-v1'],
  { revalidate: MATRIX_CACHE_SECONDS, tags: [cacheTag.listings] },
  null,
)

// ---------------------------------------------------------------------------
// Depth-content presence reads
// ---------------------------------------------------------------------------

async function fetchSubdivisionDescriptionKeys(): Promise<string[]> {
  const supabase = supabaseAnon()
  if (!supabase) throw new Error('[getSubdivisionDescriptionKeys] supabase not configured')
  const keys: string[] = []
  for (let offset = 0; offset < MAX_ROWS; offset += PAGE_SIZE) {
    const { data, error } = await supabase
      .from('subdivision_descriptions')
      .select('entity_key, description')
      .not('description', 'is', null)
      .order('entity_key', { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1)
    if (error) {
      throw new Error(`[getSubdivisionDescriptionKeys] supabase error: ${error.message}`)
    }
    const page = (data ?? []) as Array<{ entity_key?: string | null; description?: string | null }>
    for (const row of page) {
      if (row.entity_key && (row.description ?? '').trim().length > 0) keys.push(row.entity_key)
    }
    if (page.length < PAGE_SIZE) break
  }
  return keys
}

/**
 * entity_key ('city-slug:subdivision-slug') of every subdivision with a real
 * stored description — the depth-content gate for plain-subdivision matrix
 * geos. `null` = read failed.
 */
export const getSubdivisionDescriptionKeys = makeResilientCached<[], string[] | null>(
  fetchSubdivisionDescriptionKeys,
  ['search-matrix-subdivision-description-keys-v1'],
  { revalidate: MATRIX_CACHE_SECONDS, tags: [cacheTag.listings] },
  null,
)

export type MatrixNeighborhoodRow = {
  name: string
  slug: string
  citySlug: string
  hasDescription: boolean
}

async function fetchMatrixNeighborhoods(): Promise<MatrixNeighborhoodRow[]> {
  const supabase = supabaseAnon()
  if (!supabase) throw new Error('[getMatrixNeighborhoods] supabase not configured')
  const { data, error } = await supabase
    .from('neighborhoods')
    .select('name, slug, description, cities(slug)')
    .order('name')
  if (error) {
    throw new Error(`[getMatrixNeighborhoods] supabase error: ${error.message}`)
  }
  const rows = (data ?? []) as Array<{
    name?: string | null
    slug?: string | null
    description?: string | null
    cities?: { slug?: string | null } | Array<{ slug?: string | null }> | null
  }>
  const out: MatrixNeighborhoodRow[] = []
  for (const row of rows) {
    const cityRel = Array.isArray(row.cities) ? row.cities[0] : row.cities
    const citySlug = (cityRel?.slug ?? '').trim()
    const name = (row.name ?? '').trim()
    const slug = (row.slug ?? '').trim()
    if (!citySlug || !name || !slug) continue
    out.push({
      name,
      slug,
      citySlug,
      hasDescription: (row.description ?? '').trim().length > 0,
    })
  }
  return out
}

/**
 * Curated boundary neighborhoods (the /cities/{city}/{neighborhood} set) with
 * their city slug and a depth-content flag. `null` = read failed.
 */
export const getMatrixNeighborhoods = makeResilientCached<[], MatrixNeighborhoodRow[] | null>(
  fetchMatrixNeighborhoods,
  ['search-matrix-neighborhoods-v1'],
  { revalidate: MATRIX_CACHE_SECONDS, tags: [cacheTag.listings] },
  null,
)
