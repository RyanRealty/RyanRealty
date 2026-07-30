/**
 * searchShapes — the map-shapes subsystem of searchListingsAll (Phase 2 map
 * search — SEARCH_OPTIMIZATION_PLAN_2026-07-29). Pure extraction from
 * searchListingsAll.ts (file-size budget split): shape zod schemas, shape
 * cache-key normalization, the search_listing_keys_in_shapes RPC key
 * resolution, the shapes execution paths (exact RPC key-set path + in-memory
 * bbox fallback), and the shared listing_search_mv row → ListingTile
 * projection.
 *
 * The query core (applySearchFilters / applySort) stays in
 * searchListingsAll.ts and is injected via ShapeSearchDeps, so the only
 * imports pointing back at searchListingsAll are type-only (no runtime cycle).
 */

import { z } from 'zod'
import type { supabaseAnon } from '@/lib/data/client'
import { TILE_MV_SELECT_COLUMNS } from '@/lib/listing-tile-projections'
import { getShapeSetBounds, isPointInShapeSet, type MapShapeSet } from '@/lib/map-polygon'
import type { ListingTile, ListingStatus } from '@/lib/data/types/listing'
import type {
  ParsedSearchListingsAllFilter,
  SearchListingsAllResult,
} from '@/lib/data/listings/searchListingsAll'

// ── Map shapes (Phase 2 map search — SEARCH_OPTIMIZATION_PLAN_2026-07-29) ──
// Mirrors the SQL contract of public.search_listing_keys_in_shapes
// (supabase/migrations/20260730011000_search_shapes_rpc.sql): coords are
// GeoJSON-ordered [lng, lat]; result = union(include) minus union(exclude).
// NO .catch() here on purpose: silently dropping a malformed shape set would
// WIDEN the result set to the whole bbox — a correctness failure, so bad
// shapes reject the whole query instead.

const CoordTupleSchema = z.tuple([
  z.number().min(-180).max(180), // lng
  z.number().min(-90).max(90), // lat
])

const ShapeSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('polygon'),
    coords: z.array(CoordTupleSchema).min(3).max(2000),
  }),
  z.object({
    type: z.literal('circle'),
    center: CoordTupleSchema,
    /** Meters on the ground (geography ST_DWithin). RPC caps at 200 km. */
    radius_m: z.number().positive().max(200_000),
  }),
])

export const ShapesSchema = z
  .object({
    include: z.array(ShapeSchema).min(1).max(50),
    exclude: z.array(ShapeSchema).max(50).optional(),
  })
  .refine((s) => s.include.length + (s.exclude?.length ?? 0) <= 50, {
    message: 'max 50 shapes total (include + exclude)',
  })

export type SearchShape = z.infer<typeof ShapeSchema>
export type SearchShapes = z.infer<typeof ShapesSchema>

/** MV row shape — listing_search_mv carries every listing_tile_mv column. */
export type ListingSearchMvRow = {
  listing_key: string
  list_number: string | null
  standard_status: ListingStatus
  list_price: number | null
  close_price: number | null
  close_date: string | null
  beds: number | null
  baths: number | null
  sqft: number | null
  street_number: string | null
  street_name: string | null
  street_suffix: string | null
  city: string | null
  postal_code: string | null
  subdivision_name: string | null
  lat: number | null
  lng: number | null
  photo_url: string | null
  property_type: string | null
  property_sub_type: string | null
  on_market_date: string | null
  modified_at: string | null
  price_per_sqft: number | null
  lot_size_acres: number | null
  year_built: number | null
  garage_spaces: number | null
  pool_yn: boolean | null
  has_virtual_tour: boolean | null
  dom: number | null
  price_drop_count: number | null
  address_slug: string | null
  boundary_city: string | null
  boundary_neighborhood: string | null
  boundary_subdivision: string | null
}

export function mvRowToTile(row: ListingSearchMvRow): ListingTile {
  const citySlug = row.city ? row.city.toLowerCase().replace(/\s+/g, '-') : null
  const subdivisionSlug = row.subdivision_name
    ? row.subdivision_name.toLowerCase().replace(/\s+/g, '-')
    : null
  return {
    listingKey: row.listing_key,
    listNumber: row.list_number,
    status: row.standard_status,
    listPrice: row.list_price,
    closePrice: row.close_price,
    closeDate: row.close_date,
    beds: row.beds,
    baths: row.baths,
    sqft: row.sqft,
    streetNumber: row.street_number,
    streetName: row.street_name,
    streetSuffix: row.street_suffix ?? null,
    city: row.city,
    citySlug,
    postalCode: row.postal_code,
    subdivisionName: row.subdivision_name,
    subdivisionSlug,
    lat: row.lat,
    lng: row.lng,
    photoUrl: row.photo_url,
    propertyType: row.property_type,
    propertySubType: row.property_sub_type,
    onMarketDate: row.on_market_date,
    modifiedAt: row.modified_at,
    pricePerSqft: row.price_per_sqft,
    lotSizeAcres: row.lot_size_acres,
    yearBuilt: row.year_built,
    garageSpaces: row.garage_spaces,
    poolYn: row.pool_yn,
    hasVirtualTour: row.has_virtual_tour,
    // listing_search_mv carries has_virtual_tour only; the scalar URL stays a
    // detail-page concern.
    tourUrl: null,
    dom: row.dom,
    priceDropCount: row.price_drop_count,
    addressSlug: row.address_slug,
    boundaryCity: row.boundary_city,
    boundaryNeighborhood: row.boundary_neighborhood,
    boundarySubdivision: row.boundary_subdivision,
  }
}

// ── Shapes execution (server-side PostGIS point-in-shape) ───────────────────
//
// Primary path: resolve the in-shape listing_key set via the
// search_listing_keys_in_shapes RPC (exact PostGIS predicate — no Node
// ray-cast, no overfetch distortion), then constrain the main MV query with
// .in('listing_key', keys) in chunks.
//
// CONSTRAINTS CALLERS MUST KNOW (the >1000-key policy):
//   * PostgREST caps EVERY response at db-max-rows = 1000, RPC setofs
//     included. The key set is therefore paged via .range() over the RPC's
//     deterministic listing_key ordering, up to MAX_SHAPE_KEYS (3000).
//   * <= MAX_SHAPE_KEYS keys → results and totalCount are EXACT. The .in()
//     constraint is chunked at SHAPE_KEY_CHUNK keys per query (URL-length
//     safety); each chunk returns every matching row (chunk size < 1000 cap),
//     so the merged set is complete and sorted in Node.
//   * > MAX_SHAPE_KEYS keys (a shape covering most of the ~10K-row MV), or
//     the RPC unavailable (migration not applied yet / transient error) →
//     legacy fallback: bbox overfetch capped at 1000 rows + in-memory shape
//     filter. totalCount is then a floor, surfaced via `capped: true`.

const SHAPE_KEY_PAGE = 1000
const MAX_SHAPE_KEYS = 3000
const SHAPE_KEY_CHUNK = 200

type AnonClient = NonNullable<ReturnType<typeof supabaseAnon>>

/**
 * Query-core callbacks injected by searchListingsAll (applySearchFilters /
 * applySort stay there) — keeps this module free of a runtime import cycle.
 */
export type ShapeSearchDeps = {
  applyFilters: <T>(builder: T, parsed: ParsedSearchListingsAllFilter) => T
  applySort: <T>(builder: T, sort: ParsedSearchListingsAllFilter['sort']) => T
}

/** Page the RPC's setof through PostgREST's 1000-row cap. null → fall back. */
async function resolveShapeKeysViaRpc(
  supabase: AnonClient,
  shapes: SearchShapes
): Promise<string[] | null> {
  const keys: string[] = []
  for (let offset = 0; offset < MAX_SHAPE_KEYS; offset += SHAPE_KEY_PAGE) {
    const { data, error } = await supabase
      .rpc('search_listing_keys_in_shapes', { p_shapes: shapes })
      .range(offset, offset + SHAPE_KEY_PAGE - 1)
    if (error) {
      // RPC missing (migration not yet applied) or transient — fall back to
      // the in-memory filter rather than failing the whole search.
      console.error('[searchListingsAll] shapes RPC unavailable, using in-memory fallback:', error.message)
      return null
    }
    const page = (data ?? []) as { listing_key: string }[]
    for (const row of page) keys.push(row.listing_key)
    if (page.length < SHAPE_KEY_PAGE) return keys
  }
  console.error(`[searchListingsAll] shapes matched more than ${MAX_SHAPE_KEYS} keys — using in-memory fallback`)
  return null
}

/** Node-side sort matching applySort exactly (nulls sink on every sort). */
function tileComparator(sort: ParsedSearchListingsAllFilter['sort']) {
  const cmp = (av: number | null, bv: number | null, ascending: boolean): number => {
    if (av == null && bv == null) return 0
    if (av == null) return 1
    if (bv == null) return -1
    return ascending ? av - bv : bv - av
  }
  const ts = (t: ListingTile): number | null => {
    if (!t.modifiedAt) return null
    const v = Date.parse(t.modifiedAt)
    return Number.isFinite(v) ? v : null
  }
  switch (sort) {
    case 'oldest':
      return (a: ListingTile, b: ListingTile) => cmp(ts(a), ts(b), true)
    case 'price_asc':
      return (a: ListingTile, b: ListingTile) => cmp(a.listPrice, b.listPrice, true)
    case 'price_desc':
      return (a: ListingTile, b: ListingTile) => cmp(a.listPrice, b.listPrice, false)
    case 'price_per_sqft_asc':
      return (a: ListingTile, b: ListingTile) => cmp(a.pricePerSqft, b.pricePerSqft, true)
    case 'price_per_sqft_desc':
      return (a: ListingTile, b: ListingTile) => cmp(a.pricePerSqft, b.pricePerSqft, false)
    case 'year_newest':
      return (a: ListingTile, b: ListingTile) => cmp(a.yearBuilt, b.yearBuilt, false)
    case 'year_oldest':
      return (a: ListingTile, b: ListingTile) => cmp(a.yearBuilt, b.yearBuilt, true)
    default:
      return (a: ListingTile, b: ListingTile) => cmp(ts(a), ts(b), false)
  }
}

function chunkKeys(keys: string[], size: number): string[][] {
  const chunks: string[][] = []
  for (let i = 0; i < keys.length; i += size) chunks.push(keys.slice(i, i + size))
  return chunks
}

type RangeQuery = { range: (from: number, to: number) => unknown }

/**
 * Legacy fallback: bbox overfetch (1000-row PostgREST ceiling) + in-memory
 * point-in-shape filter. Approximate when the bbox holds > 1000 rows — the
 * same limitation the pre-Phase-2 Node ray-cast path had, kept ONLY as the
 * degraded mode for "RPC unavailable" and "> MAX_SHAPE_KEYS".
 */
async function fetchShapesFallbackInMemory(
  supabase: AnonClient,
  parsed: ParsedSearchListingsAllFilter,
  deps: ShapeSearchDeps
): Promise<SearchListingsAllResult> {
  const shapes = parsed.shapes as MapShapeSet
  const bbox = parsed.bbox ?? getShapeSetBounds(shapes) ?? undefined
  const fetchLimit = 1000
  let query = deps.applyFilters(
    supabase.from('listing_search_mv').select(TILE_MV_SELECT_COLUMNS),
    { ...parsed, bbox }
  )
  query = deps.applySort(query, parsed.sort)
  query = (query as unknown as RangeQuery).range(0, fetchLimit - 1) as unknown as typeof query
  const { data, error } = await query
  if (error) {
    throw new Error(`[searchListingsAll] shapes fallback supabase error: ${error.message}`)
  }
  const fetched = (data ?? []).map((row) => mvRowToTile(row as unknown as ListingSearchMvRow))
  const inShape = fetched.filter(
    (t) =>
      t.lat != null &&
      t.lng != null &&
      isPointInShapeSet({ lat: t.lat, lng: t.lng }, shapes)
  )
  const rows = inShape.slice(parsed.offset, parsed.offset + parsed.limit)
  return {
    rows,
    totalCount: inShape.length,
    // capped signals BOTH "more pages" and "the overfetch ceiling may hide
    // in-shape rows beyond the 1000 fetched".
    capped: fetched.length >= fetchLimit || inShape.length > parsed.offset + rows.length,
    countIsExact: fetched.length < fetchLimit,
  }
}

/** Exact shapes path: RPC key set + chunked .in() + Node-side sort. */
export async function fetchSearchListingsAllInShapes(
  supabase: AnonClient,
  parsed: ParsedSearchListingsAllFilter,
  deps: ShapeSearchDeps
): Promise<SearchListingsAllResult> {
  const keys = await resolveShapeKeysViaRpc(supabase, parsed.shapes as SearchShapes)
  if (keys === null) return fetchShapesFallbackInMemory(supabase, parsed, deps)
  if (keys.length === 0) return { rows: [], totalCount: 0, capped: false, countIsExact: true }

  const results = await Promise.all(
    chunkKeys(keys, SHAPE_KEY_CHUNK).map(async (chunk) => {
      const query = deps.applyFilters(
        // @canonical-key — chunk comes from search_listing_keys_in_shapes over the SAME MV.
        supabase.from('listing_search_mv').select(TILE_MV_SELECT_COLUMNS).in('listing_key', chunk),
        parsed
      )
      const { data, error } = await query
      if (error) {
        throw new Error(`[searchListingsAll] shapes chunk supabase error: ${error.message}`)
      }
      return (data ?? []) as unknown[]
    })
  )
  const tiles = results.flat().map((row) => mvRowToTile(row as ListingSearchMvRow))
  tiles.sort(tileComparator(parsed.sort))
  const totalCount = tiles.length
  const rows = tiles.slice(parsed.offset, parsed.offset + parsed.limit)
  return { rows, totalCount, capped: totalCount > parsed.offset + rows.length, countIsExact: true }
}

/**
 * Shapes head-count path: resolve the key set, then sum per-chunk head counts
 * (disjoint key chunks → the sum is exact). Same fallback policy as the row
 * path.
 */
export async function countSearchListingsAllInShapes(
  supabase: AnonClient,
  parsed: ParsedSearchListingsAllFilter,
  deps: ShapeSearchDeps
): Promise<number> {
  const keys = await resolveShapeKeysViaRpc(supabase, parsed.shapes as SearchShapes)
  if (keys === null) {
    const fallback = await fetchShapesFallbackInMemory(supabase, parsed, deps)
    return fallback.totalCount
  }
  if (keys.length === 0) return 0
  const counts = await Promise.all(
    chunkKeys(keys, SHAPE_KEY_CHUNK).map(async (chunk) => {
      const query = deps.applyFilters(
        supabase
          .from('listing_search_mv')
          .select('listing_key', { count: 'exact', head: true })
          // @canonical-key — chunk comes from search_listing_keys_in_shapes over the SAME MV.
          .in('listing_key', chunk),
        parsed
      )
      const { count, error } = await query
      if (error) {
        throw new Error(`[searchListingsAllCount] shapes chunk supabase error: ${error.message}`)
      }
      return count ?? 0
    })
  )
  return counts.reduce((total, c) => total + c, 0)
}

const round4 = (n: number) => Math.round(n * 1e4) / 1e4

/**
 * Shapes in the cache key follow the bbox precedent: coords rounded to 4
 * decimals (~11 m) and radii to whole meters, so a re-drawn shape that is
 * visually identical shares one cache entry. Shape ORDER is preserved — it is
 * semantically irrelevant (set algebra) but reordering objects for a key is
 * not worth the complexity.
 */
function normalizeShapeForCacheKey(shape: SearchShape) {
  if (shape.type === 'circle') {
    return {
      type: 'circle',
      center: [round4(shape.center[0]), round4(shape.center[1])],
      radius_m: Math.round(shape.radius_m),
    }
  }
  return {
    type: 'polygon',
    coords: shape.coords.map(([lng, lat]) => [round4(lng), round4(lat)]),
  }
}

export function normalizeShapesForCacheKey(shapes: SearchShapes) {
  return {
    include: shapes.include.map(normalizeShapeForCacheKey),
    ...(shapes.exclude && shapes.exclude.length > 0
      ? { exclude: shapes.exclude.map(normalizeShapeForCacheKey) }
      : {}),
  }
}
