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

import { createServiceClient, supabaseAnon } from '@/lib/data/client'
import { cacheTag } from '@/lib/data/cache/unstable-cache'
import { makeResilientCached } from '@/lib/data/cache/resilient'
import { SERVICE_AREA_CITIES_LOWER } from '@/lib/data/listings/service-area'
import { PUBLIC_ON_MARKET_STATUSES } from '@/lib/listing-status-public'

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

async function fetchSubdivisionLifetimeCounts(
  citySlug: string,
): Promise<SubdivisionLifetimeCountRow[]> {
  // Service client, not anon: get_subdivision_status_counts runs ~3.1s per
  // city, past the anon role's 3s statement_timeout — under anon every city
  // intermittently times out and this read silently returns the null fallback
  // (same failure sitemap.ts + getIndexableSubdivisions hit and fixed).
  // Server-only aggregate counts, nothing row-level leaves the DAL.
  const supabase = createServiceClient()
  if (!supabase) throw new Error('[getSubdivisionLifetimeCounts] supabase not configured')
  // The RPC matches TRIM("City") ILIKE — hyphenless slugs map back to the MLS
  // spelling by swapping hyphens for spaces ('la-pine' -> 'la pine').
  const { data, error } = await supabase.rpc('get_subdivision_status_counts', {
    p_city: citySlug.replace(/-/g, ' '),
  })
  if (error) {
    throw new Error(`[getSubdivisionLifetimeCounts] rpc error (${citySlug}): ${error.message}`)
  }
  return (Array.isArray(data) ? data : []) as SubdivisionLifetimeCountRow[]
}

/**
 * Per-city subdivision status counts from the get_subdivision_status_counts
 * RPC (the same server-side aggregate app/sitemap.ts uses for 2-segment
 * subdivision URLs). Lifetime = active + pending + closed. `null` = failed.
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
