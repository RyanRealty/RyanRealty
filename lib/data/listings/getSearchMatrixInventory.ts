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

import { supabaseAnon } from '@/lib/data/client'
import { cacheTag } from '@/lib/data/cache/unstable-cache'
import { makeResilientCached } from '@/lib/data/cache/resilient'
import { SERVICE_AREA_CITIES_LOWER } from '@/lib/data/listings/service-area'
import { PUBLIC_ON_MARKET_STATUSES } from '@/lib/listing-status-public'
import { classifyLifetimeBuckets } from '@/lib/data/subdivisions/subdivision-sitemap-inventory'
import {
  citySlugToMlsCityLower,
  getSubdivisionCityInventoryByCityLower,
} from '@/lib/data/subdivisions/getSubdivisionCityInventory'

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

/**
 * Per-city subdivision active/pending/closed counts.
 *
 * SOURCE CHANGED 2026-09-09 (SITE-54). This used to page every row of
 * public.listing_tile_mv for the city through PostgREST — 1,000 rows at a time,
 * 12 pages concurrently, each failed page retried 3 times — and compute the
 * counts client-side, because PostgREST has no server-side GROUP BY on this
 * project (PGRST123). listing_tile_mv holds one row per MLS listing ever seen,
 * so that is ~129,192 rows for Bend alone, against an 8s PostgREST statement
 * timeout, while pg_cron job 164 holds the view under REFRESH ... CONCURRENTLY
 * for 13-21 minutes of every 30-minute slot overnight. Grouped by query_id over
 * 24h, that statement was the single largest statement-timeout source on the
 * whole database (19,655 page timeouts plus 1,136 for its count), it degraded
 * listing detail, tiles and blog through the connection pool, and it is what
 * put `[getSearchMatrixInventory] read failed` in every warm-sitemaps run.
 *
 * The identical aggregate is now computed once a night inside
 * public.subdivision_city_inventory_mv and read by
 * getSubdivisionCityInventory() — one filtered read of pre-counted rows,
 * shared with the sitemap's browse-pair loop, which paid this same bill twice.
 *
 * NOTHING ELSE MOVED. Same source rows (the MV aggregates listing_tile_mv),
 * same classifyLifetimeBuckets() classification, same grouping key (the RAW
 * TRIMMED subdivision name, case preserved, exactly like the RPC's
 * `COALESCE(TRIM("SubdivisionName"), '')`), and the same downstream
 * 'N/A'/'unknown'-slug filtering in buildSubdivisionGeos. The one deliberate
 * divergence from get_subdivision_status_counts is carried forward unchanged:
 * listing_tile_mv excludes internet-display-opted-out / non-IDX-participant
 * listings that the RPC's raw `listings` scan includes.
 *
 * Lifetime = active + pending + closed. `null` = read failed.
 */
async function fetchSubdivisionLifetimeCounts(
  citySlug: string,
): Promise<SubdivisionLifetimeCountRow[]> {
  const byCityLower = await getSubdivisionCityInventoryByCityLower()
  const entries = byCityLower.get(citySlugToMlsCityLower(citySlug)) ?? []

  const countsByName = new Map<string, { active: number; pending: number; closed: number }>()
  for (const entry of entries) {
    for (const row of entry.rows) {
      const name = (row.subdivision_name ?? '').trim()
      // Mirrors the RPC's `TRIM(COALESCE("SubdivisionName", '')) <> ''` filter
      // — an empty subdivision name never gets a row, in either implementation.
      if (!name) continue
      const raw = Number(row.n)
      const n = Number.isFinite(raw) && raw > 0 ? Math.trunc(raw) : 1
      const acc = countsByName.get(name) ?? { active: 0, pending: 0, closed: 0 }
      for (const bucket of classifyLifetimeBuckets(row.standard_status)) acc[bucket] += n
      countsByName.set(name, acc)
    }
  }

  return Array.from(countsByName, ([subdivision_name, counts]) => ({
    subdivision_name,
    ...counts,
  }))
}

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
