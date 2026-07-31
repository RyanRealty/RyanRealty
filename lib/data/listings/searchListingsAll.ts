/**
 * searchListingsAll — the one search function over listing_search_mv.
 *
 * listing_search_mv is the on-market subset (~9.7K rows: Active, Active Under
 * Contract, Coming Soon, Pending) carrying every listing_tile_mv column PLUS
 * the full filter surface from the search field registry
 * (lib/search/field-registry.ts): promoted *_yn booleans, HOA/tax/PITI
 * numerics, school names, and the rr_feature_keys() text[] projections of the
 * RESO feature objects (appliances, view_types, parking_features, ...).
 *
 * Every predicate here maps 1:1 to a CONTRACT-search-field-exposure expression
 * (2026-07-11). Closed/sold searches never come here — they keep the legacy
 * RPC paths in app/actions/listings.ts.
 *
 * Modeled on getListingTiles: zod filter schema, makeResilientCached wrapper,
 * throw-on-error (never cache a poison-empty), exact count in the same query.
 */

import { z } from 'zod'
import { supabaseAnon } from '@/lib/data/client'
import { TILE_MV_SELECT_COLUMNS } from '@/lib/listing-tile-projections'
import { CACHE_WINDOWS, cacheTag } from '@/lib/data/cache/unstable-cache'
import { makeResilientCached } from '@/lib/data/cache/resilient'
import type { ListingTile, ListingStatus } from '@/lib/data/types/listing'
import { propertyTypeFilterToCodes } from '@/lib/property-type'
import { SERVICE_AREA_CITIES_LOWER } from '@/lib/data/listings/service-area'
import { PUBLIC_ACTIVE_STATUSES, PUBLIC_PENDING_STATUSES } from '@/lib/listing-status-public'
import {
  arrayLiteral,
  ilikeExact,
  resolveLegacyPropertySubType,
  BOOLEAN_PREDICATES,
  BOOLEAN_FILTER_KEYS,
  MULTI_FIELD_DEFS,
  TEXT_FIELD_COLUMNS,
  RANGE_FIELD_COLUMNS,
} from '@/lib/data/listings/searchPredicates'
import {
  ShapesSchema,
  mvRowToTile,
  fetchSearchListingsAllInShapes,
  countSearchListingsAllInShapes,
  normalizeShapesForCacheKey,
  type ListingSearchMvRow,
  type SearchShapes,
  type ShapeSearchDeps,
} from '@/lib/data/listings/searchShapes'

// Shape schemas/types + the shapes execution paths live in searchShapes.ts —
// re-exported here so existing importers (lib/data/index.ts) keep working.
export type { SearchShape, SearchShapes } from '@/lib/data/listings/searchShapes'

// Coming Soon is excluded by policy — see lib/listing-status-public.ts.
const ACTIVE_STATUSES: ListingStatus[] = PUBLIC_ACTIVE_STATUSES
const PENDING_STATUSES: ListingStatus[] = PUBLIC_PENDING_STATUSES

const bool = () => z.boolean().optional().catch(undefined)
const multi = () => z.array(z.string().min(1).max(80)).max(40).optional().catch(undefined)
const text = () => z.string().min(1).max(120).optional().catch(undefined)

/**
 * Registry-driven feature filters — key names are the registry keys, which are
 * also the URL params, so page-level SearchFilters and AdvancedListingsFilters
 * carry these fields under the same names and pass them straight through.
 */
const featureShape = {
  // Booleans (registry kind 'boolean') — predicate per BOOLEAN_PREDICATES below.
  hasFireplace: bool(),
  hasPool: bool(),
  hasWaterfront: bool(),
  hasView: bool(),
  hasGolfCourse: bool(),
  newConstruction: bool(),
  basement: bool(),
  horseProperty: bool(),
  seniorCommunity: bool(),
  noHoa: bool(),
  irrigationRights: bool(),
  hasVirtualTour: bool(),
  hasOpenHouse: bool(),
  priceReduced: bool(),
  ownerWillCarry: bool(),
  strAllowed: bool(),
  gatedCommunity: bool(),
  guestHouse: bool(),
  shop: bool(),
  rvParking: bool(),
  rvGarage: bool(),
  evCharging: bool(),
  heatedGarage: bool(),
  singleLevel: bool(),
  primaryOnMain: bool(),
  inLawFloorplan: bool(),
  fencedYard: bool(),
  onGolfCourse: bool(),
  adjoinsPublicLand: bool(),
  onWell: bool(),
  publicWater: bool(),
  onSeptic: bool(),
  publicSewer: bool(),
  // CF tranche (2026-07-30) — promoted *_yn columns, MV v3 migration.
  adu: bool(),
  aduPermitted: bool(),
  strPermit: bool(),
  ccrs: bool(),
  hasFloorPlan: bool(),
  hasVideo: bool(),
  // Multi-selects (registry kind 'multi') — column + match mode resolve from
  // the registry def (matchMode 'all' -> contains, default -> overlaps,
  // singleColumnIn -> IN on the scalar column).
  // Enumerated sub types (plan §4, 2026-07-30): exact canonical feed values,
  // applied as IN over property_sub_type via singleColumnIn. Max 25 covers
  // all 21 live values with headroom. Distinct from the legacy scalar
  // `propertySubType` param above, which is kept for old-URL compat.
  propertySubTypes: z.array(z.string().min(1).max(80)).max(25).optional().catch(undefined),
  appliances: multi(),
  flooring: multi(),
  heatingTypes: multi(),
  coolingTypes: multi(),
  interiorFeatures: multi(),
  exteriorFeatures: multi(),
  windowFeatures: multi(),
  securityFeatures: multi(),
  parkingFeatures: multi(),
  patioPorch: multi(),
  lotFeatures: multi(),
  viewTypes: multi(),
  fireplaceTypes: multi(),
  basementTypes: multi(),
  otherStructures: multi(),
  structureTypes: multi(),
  hoaAmenities: multi(),
  communityFeatures: multi(),
  accessibilityFeatures: multi(),
  waterfrontTypes: multi(),
  utilities: multi(),
  sewerTypes: multi(),
  waterSource: multi(),
  roadSurface: multi(),
  roofTypes: multi(),
  constructionMaterials: multi(),
  foundationTypes: multi(),
  architecturalStyles: multi(),
  levelsOptions: multi(),
  listingTerms: multi(),
  specialConditions: multi(),
  currentUse: multi(),
  irrigationSource: multi(),
  commonWalls: multi(),
  roadFrontage: multi(),
  poolFeatures: multi(),
  county: multi(),
  // CF tranche (2026-07-30) multis.
  floodZone: multi(),
  governmentOverlay: multi(),
  easements: multi(),
  roomsArr: multi(),
  bodyType: multi(),
  fencing: multi(),
  // Text (registry kind 'text') — case-insensitive exact match.
  elementarySchool: text(),
  middleSchool: text(),
  highSchool: text(),
  zoning: text(),
  irrigationDistrict: text(),
  // Max-only ranges (registry: min unused in the UI).
  hoaMonthlyMax: z.number().nonnegative().optional(),
  taxAnnualMax: z.number().nonnegative().optional(),
  monthlyPaymentMax: z.number().nonnegative().optional(),
  // CF tranche (2026-07-30) Min/Max ranges (DAL-canonical `${key}Min`/`${key}Max`).
  aduSqftMin: z.number().int().positive().optional().catch(undefined),
  aduSqftMax: z.number().int().positive().optional().catch(undefined),
  irrigationAcresMin: z.number().nonnegative().optional().catch(undefined),
  irrigationAcresMax: z.number().nonnegative().optional().catch(undefined),
  // walkScore/storiesTotal/fireplacesTotal/carportSpaces/parkingTotal ranges
  // removed 2026-07-30: source StandardFields are masked at our feed level,
  // columns 100% null (accuracy audit).
  photosCountMin: z.number().int().nonnegative().optional().catch(undefined),
  photosCountMax: z.number().int().nonnegative().optional().catch(undefined),
  prevListPriceMin: z.number().positive().optional().catch(undefined),
  prevListPriceMax: z.number().positive().optional().catch(undefined),
} as const

/**
 * The registry-driven slice of the filter surface. AdvancedListingsFilters
 * (app/actions/listings.ts) and the page-level SearchFilters
 * (app/actions/search.ts) both intersect this type so the fields flow through
 * every layer under one set of names. (FilterSchema below embeds featureShape,
 * so this Pick stays in lockstep with the schema.)
 */
export type SearchFeatureFilters = Pick<z.input<typeof FilterSchema>, keyof typeof featureShape>

export const SEARCH_FEATURE_FILTER_KEYS = Object.keys(featureShape) as readonly (keyof SearchFeatureFilters & string)[]

/**
 * Copy the feature-filter fields off a wider options object (skipping
 * null/undefined and empty arrays) so action-layer routers can forward them to
 * searchListingsAll without enumerating ~80 keys.
 */
export function pickSearchFeatureFilters(source: Partial<SearchFeatureFilters>): Partial<SearchFeatureFilters> {
  const record = source as Record<string, unknown>
  const out: Record<string, unknown> = {}
  for (const key of SEARCH_FEATURE_FILTER_KEYS) {
    const value = record[key]
    if (value == null) continue
    if (Array.isArray(value) && value.length === 0) continue
    out[key] = value
  }
  return out as Partial<SearchFeatureFilters>
}

const FilterSchema = z.object({
  // ── Geography (same semantics as getListingTiles) ─────────────────────────
  city: z.string().min(1).max(80).optional(),
  cities: z.array(z.string().min(1).max(80)).max(50).optional(),
  subdivision: z.string().min(1).max(120).optional(),
  /**
   * Alias set for a community with multiple MLS spellings (subdivision-aliases
   * getSubdivisionMatchNames) — matched via IN on subdivision_lower.
   */
  subdivisions: z.array(z.string().min(1).max(120)).max(20).optional(),
  postalCode: z.string().regex(/^\d{5}$/).optional().catch(undefined),
  /** Bend neighborhood LABEL (boundary_neighborhood on the MV). */
  neighborhood: z.string().min(1).max(120).optional(),
  bbox: z
    .object({
      west: z.number(),
      south: z.number(),
      east: z.number(),
      north: z.number(),
    })
    .optional(),
  /**
   * Drawn map shapes (multi-shape include/exclude, polygons + circles).
   * Resolved server-side via the search_listing_keys_in_shapes PostGIS RPC —
   * see lib/data/listings/searchShapes.ts for the >1000-key policy.
   */
  shapes: ShapesSchema.optional(),
  /** Service-area guard — same default logic as getListingTiles. */
  scope: z.enum(['service-area', 'all']).optional(),

  // ── Status / property type ────────────────────────────────────────────────
  status: z.enum(['active', 'active-and-pending', 'pending-only']).default('active'),
  propertyType: z.string().min(1).max(40).optional().catch(undefined),
  /**
   * LEGACY scalar sub-type param (old URLs / saved searches). Resolved to
   * EXACT canonical values by resolveLegacyPropertySubType — never substring.
   * New code sends the `propertySubTypes` array (featureShape).
   */
  propertySubType: z.string().min(1).max(80).optional().catch(undefined),

  // ── Ranges (registry kind 'range', DAL-canonical `${key}Min`/`${key}Max`) ─
  priceMin: z.number().positive().optional().catch(undefined),
  priceMax: z.number().positive().optional().catch(undefined),
  sqftMin: z.number().int().positive().optional().catch(undefined),
  sqftMax: z.number().int().positive().optional().catch(undefined),
  lotAcresMin: z.number().nonnegative().optional().catch(undefined),
  lotAcresMax: z.number().nonnegative().optional().catch(undefined),
  yearBuiltMin: z.number().int().min(1700).max(2100).optional().catch(undefined),
  yearBuiltMax: z.number().int().min(1700).max(2100).optional().catch(undefined),
  bedsMin: z.number().int().nonnegative().optional().catch(undefined),
  bedsMax: z.number().int().nonnegative().optional().catch(undefined),
  bathsMin: z.number().nonnegative().optional().catch(undefined),
  bathsMax: z.number().nonnegative().optional().catch(undefined),
  garageMin: z.number().int().nonnegative().optional().catch(undefined),
  domMax: z.number().int().positive().optional().catch(undefined),

  // ── Keywords (public_remarks ILIKE %kw%) ──────────────────────────────────
  keywords: z.string().min(2).max(120).optional().catch(undefined),

  // ── Sort / pagination ─────────────────────────────────────────────────────
  sort: z
    .enum([
      'newest',
      'oldest',
      'price_asc',
      'price_desc',
      'price_per_sqft_asc',
      'price_per_sqft_desc',
      'year_newest',
      'year_oldest',
    ])
    .default('newest'),
  limit: z.number().int().min(1).max(1000).default(60).catch(60),
  offset: z.number().int().nonnegative().default(0).catch(0),

  ...featureShape,
})

export type SearchListingsAllFilter = z.input<typeof FilterSchema>

/** Parsed (post-zod) filter shape — consumed by the searchShapes module. */
export type ParsedSearchListingsAllFilter = z.output<typeof FilterSchema>

export type SearchListingsAllResult = {
  rows: ListingTile[]
  totalCount: number
  /** True when rows beyond this page exist (totalCount > offset + rows). */
  capped: boolean
  /**
   * False when totalCount may UNDER-report — only the in-memory shapes
   * fallback can do that (its bbox overfetch is ceilinged at 1000 rows).
   * Every other path counts exactly. Callers surfacing "N+" should key off
   * this, not `capped`.
   */
  countIsExact: boolean
}

const EMPTY_RESULT: SearchListingsAllResult = { rows: [], totalCount: 0, capped: false, countIsExact: true }

// The predicate tables (BOOLEAN_PREDICATES, the registry-derived multi/text/
// range column maps) and the PostgREST literal escapers live in
// lib/data/listings/searchPredicates.ts — extracted 2026-07-30 (file-size
// budget), imported above.

/**
 * Structural view of the chainable PostgREST filter methods (same pattern as
 * getListingTiles' TileQueryBuilder — the real builder type is too deep for a
 * generic constraint, so we cast in and back out).
 */
type SearchQueryBuilder = {
  eq: (column: string, value: string | number | boolean) => SearchQueryBuilder
  neq: (column: string, value: string) => SearchQueryBuilder
  in: (column: string, values: readonly (string | number)[]) => SearchQueryBuilder
  gte: (column: string, value: string | number) => SearchQueryBuilder
  lte: (column: string, value: string | number) => SearchQueryBuilder
  not: (column: string, operator: string, value: unknown) => SearchQueryBuilder
  or: (filters: string) => SearchQueryBuilder
  contains: (column: string, value: string) => SearchQueryBuilder
  overlaps: (column: string, value: string) => SearchQueryBuilder
  ilike: (column: string, pattern: string) => SearchQueryBuilder
}

function applySearchFilters<T>(builder: T, parsed: z.output<typeof FilterSchema>): T {
  let query = builder as unknown as SearchQueryBuilder
  const record = parsed as unknown as Record<string, unknown>

  // ── Service-area guard (same default semantics as getListingTiles) ───────
  // county counts as explicit geography (accuracy audit 2026-07-30): without
  // it, the guard's service-area city list silently intersected the county
  // filter, so county=Lake could never match anything (its cities are not in
  // the service list) and Klamath under-reported. A user naming a county has
  // named their geography — the guard must stand down exactly as it does for
  // a city.
  const countyFilter = record.county
  const hasExplicitGeo = Boolean(
    parsed.city ||
      (parsed.cities && parsed.cities.length > 0) ||
      parsed.subdivision ||
      (parsed.subdivisions && parsed.subdivisions.length > 0) ||
      parsed.postalCode ||
      parsed.neighborhood ||
      parsed.bbox ||
      parsed.shapes ||
      (Array.isArray(countyFilter) && countyFilter.length > 0)
  )
  const applyServiceArea =
    parsed.scope === 'service-area' || (parsed.scope !== 'all' && !hasExplicitGeo)
  if (applyServiceArea) {
    query = query.in('city_lower', SERVICE_AREA_CITIES_LOWER)
  }

  // ── Geography ─────────────────────────────────────────────────────────────
  if (parsed.city) query = query.eq('city_lower', parsed.city.toLowerCase().trim())
  if (parsed.cities && parsed.cities.length > 0) {
    query = query.in(
      'city_lower',
      parsed.cities.map((c) => c.toLowerCase().trim()).filter(Boolean)
    )
  }
  if (parsed.subdivisions && parsed.subdivisions.length > 0) {
    query = query.in(
      'subdivision_lower',
      parsed.subdivisions.map((s) => s.toLowerCase().trim()).filter(Boolean)
    )
  } else if (parsed.subdivision) {
    query = query.eq('subdivision_lower', parsed.subdivision.toLowerCase().trim())
  }
  if (parsed.postalCode) query = query.eq('postal_code', parsed.postalCode)
  if (parsed.neighborhood) query = query.eq('boundary_neighborhood', parsed.neighborhood)
  if (parsed.bbox) {
    const { west, south, east, north } = parsed.bbox
    query = query.gte('lat', south).lte('lat', north).gte('lng', west).lte('lng', east)
  }

  // ── Status (the MV holds on-market rows only) ─────────────────────────────
  if (parsed.status === 'active') {
    query = query.in('standard_status', ACTIVE_STATUSES)
  } else if (parsed.status === 'active-and-pending') {
    query = query.in('standard_status', [...ACTIVE_STATUSES, ...PENDING_STATUSES])
  } else {
    query = query.in('standard_status', PENDING_STATUSES)
  }

  // ── Property type / sub-type ──────────────────────────────────────────────
  const ptCodes = propertyTypeFilterToCodes(parsed.propertyType)
  if (ptCodes && ptCodes.length > 0) query = query.in('property_type', ptCodes)
  if (parsed.propertySubType) {
    // EXACT resolution (plan §4.4, 2026-07-30 — supersedes the W3.2 substring
    // contract). The old `*value*` ILIKE papered over the 'Condo' vs
    // 'Condominium' vocabulary gap and produced three measured defects:
    // silent class-crossing ('Land' matched 668 rows across classes A+B),
    // /homes-for-sale/manufactured under-reporting by 34% (In Park /
    // On Leased Land never contain "Manufactured"), and one-value-per-search.
    // Known legacy strings now resolve to explicit canonical value sets
    // (resolveLegacyPropertySubType: 'Condo'→{Condominium}, 'Manufactured'→
    // the 3-value manufactured set, …); anything else is case-insensitive
    // EQUALITY against property_sub_type. NO substring matching remains on
    // this column anywhere in the DAL (§4.8.4). New callers should send the
    // enumerated `propertySubTypes` array instead.
    const resolved = resolveLegacyPropertySubType(parsed.propertySubType)
    if (resolved.kind === 'in') query = query.in('property_sub_type', [...resolved.values])
    else if (resolved.kind === 'ciEquals') query = query.ilike('property_sub_type', resolved.value)
  }

  // ── Ranges (every registry range field: gte `${key}Min`, lte `${key}Max`;
  // one-sided legacy fields — garageMin, domMax, hoaMonthlyMax, taxAnnualMax,
  // monthlyPaymentMax — resolve here too, their missing side has no schema
  // key and is skipped) ─────────────────────────────────────────────────────
  for (const [key, col] of Object.entries(RANGE_FIELD_COLUMNS)) {
    const min = record[`${key}Min`]
    const max = record[`${key}Max`]
    if (typeof min === 'number' && min > 0) query = query.gte(col, min)
    if (typeof max === 'number' && max > 0) query = query.lte(col, max)
  }

  // ── Booleans ──────────────────────────────────────────────────────────────
  for (const key of BOOLEAN_FILTER_KEYS) {
    if (record[key] !== true) continue
    const predicate = BOOLEAN_PREDICATES[key]
    switch (predicate.op) {
      case 'isTrue':
        query = query.eq(predicate.col, true)
        break
      case 'notTrue':
        query = query.not(predicate.col, 'is', true)
        break
      case 'eqValue':
        query = query.eq(predicate.col, predicate.value)
        break
      case 'containsAll':
        query = query.contains(predicate.col, arrayLiteral(predicate.values))
        break
      case 'overlapsAny':
        query = query.overlaps(predicate.col, arrayLiteral(predicate.values))
        break
      case 'orExpr':
        query = query.or(predicate.expr)
        break
      case 'hasView':
        query = query
          .not('view_types', 'is', null)
          .neq('view_types', '{}')
          .neq('view_types', arrayLiteral(['Neighborhood']))
        break
    }
  }

  // ── Multi-selects (column + match mode from the registry def) ────────────
  for (const def of MULTI_FIELD_DEFS) {
    const raw = record[def.key]
    if (!Array.isArray(raw) || raw.length === 0) continue
    const values = raw.filter((v): v is string => typeof v === 'string' && v.trim() !== '')
    if (values.length === 0) continue
    if (def.singleColumnIn) {
      query = query.in(def.mv, values.map((v) => v.trim()))
    } else if (def.matchMode === 'all') {
      query = query.contains(def.mv, arrayLiteral(values))
    } else {
      query = query.overlaps(def.mv, arrayLiteral(values))
    }
  }

  // ── Text fields (schools, zoning, irrigation district — ci exact) ─────────
  for (const [key, col] of Object.entries(TEXT_FIELD_COLUMNS)) {
    const raw = record[key]
    if (typeof raw !== 'string') continue
    const value = ilikeExact(raw)
    if (value) query = query.ilike(col, value)
  }

  // ── Keywords → address OR remarks, word-AND match ─────────────────────────
  // Each word must match EITHER the address/area vector (search_vector: street,
  // city, subdivision, zip) OR the public remarks. Remarks-only silently failed
  // address searches — "61192 Tall Timber" typed in the box found nothing
  // because the address is not in the remarks text (user report 2026-07-12).
  // `,`/`(`/`)` break the PostgREST or() grammar, so drop them alongside the
  // SQL/PostgREST wildcards.
  if (parsed.keywords) {
    const words = parsed.keywords
      .replace(/[%_*\\(),]/g, ' ')
      .split(/\s+/)
      .map((w) => w.trim())
      .filter((w) => w.length >= 2)
      .slice(0, 6)
    for (const word of words) {
      query = query.or(`public_remarks.ilike.*${word}*,search_vector.plfts.${word}`)
    }
  }

  return query as unknown as T
}

type SortableQuery = {
  order: (column: string, opts: { ascending: boolean; nullsFirst: boolean }) => SortableQuery
  range: (from: number, to: number) => SortableQuery
}

function applySort<T>(builder: T, sort: z.output<typeof FilterSchema>['sort']): T {
  const query = builder as unknown as SortableQuery
  // Nulls sink on every sort so rows missing the sort value (no sqft -> no
  // price/sqft, unknown year) never front-load the results.
  const sorted =
    sort === 'oldest'
      ? query.order('modified_at', { ascending: true, nullsFirst: false })
      : sort === 'price_asc'
        ? query.order('list_price', { ascending: true, nullsFirst: false })
        : sort === 'price_desc'
          ? query.order('list_price', { ascending: false, nullsFirst: false })
          : sort === 'price_per_sqft_asc'
            ? query.order('price_per_sqft', { ascending: true, nullsFirst: false })
            : sort === 'price_per_sqft_desc'
              ? query.order('price_per_sqft', { ascending: false, nullsFirst: false })
              : sort === 'year_newest'
                ? query.order('year_built', { ascending: false, nullsFirst: false })
                : sort === 'year_oldest'
                  ? query.order('year_built', { ascending: true, nullsFirst: false })
                  : query.order('modified_at', { ascending: false, nullsFirst: false })
  return sorted as unknown as T
}

/** Query-core callbacks handed to the searchShapes execution paths. */
const shapeSearchDeps: ShapeSearchDeps = {
  applyFilters: applySearchFilters,
  applySort,
}

async function fetchSearchListingsAll(
  parsed: z.output<typeof FilterSchema>
): Promise<SearchListingsAllResult> {
  const supabase = supabaseAnon()
  if (!supabase) return EMPTY_RESULT

  // Shapes get their own execution path (RPC key resolution + chunked .in()).
  if (parsed.shapes) return fetchSearchListingsAllInShapes(supabase, parsed, shapeSearchDeps)

  // Rows + exact total in ONE query (count: 'exact' rides the row fetch).
  let query = applySearchFilters(
    // Explicit tile columns: select('*') hauled the 36 feature arrays +
    // remarks + tsvector (~2 MB per 500 rows) that mvRowToTile discards.
    supabase.from('listing_search_mv').select(TILE_MV_SELECT_COLUMNS, { count: 'exact' }),
    parsed
  )
  query = applySort(query, parsed.sort)
  query = query.range(parsed.offset, parsed.offset + parsed.limit - 1)

  const { data, count, error } = await query
  if (error) {
    // THROW (never `return empty`) so a transient error is not cached as
    // "0 matching homes" for the whole TTL — resilient wrapper pattern.
    throw new Error(`[searchListingsAll] supabase error: ${error.message}`)
  }
  const rows = (data ?? []).map((row) => mvRowToTile(row as unknown as ListingSearchMvRow))
  const totalCount = count ?? rows.length
  return {
    rows,
    totalCount,
    capped: totalCount > parsed.offset + rows.length,
    countIsExact: true,
  }
}

/**
 * Cached entry point — the one search function for on-market listings across
 * every registry filter, bbox, sort, and pagination. Exact count included.
 */
/**
 * Stable cache key: raw Google-Maps bbox floats (15 sig figs) never repeat
 * across pans, so every viewport move was a cache miss + cold count:'exact'
 * query. Round bbox to ~4 decimals (~11m — finer than any listing needs) and
 * sort array filters so equivalent searches share one entry (attack finding
 * 2026-07-11).
 */
function stableCacheKey(parsed: Record<string, unknown>): string {
  const norm: Record<string, unknown> = {}
  for (const k of Object.keys(parsed).sort()) {
    const v = parsed[k]
    if (k === 'bbox' && v && typeof v === 'object') {
      const b = v as Record<string, number>
      norm.bbox = {
        west: Math.round(b.west * 1e4) / 1e4,
        south: Math.round(b.south * 1e4) / 1e4,
        east: Math.round(b.east * 1e4) / 1e4,
        north: Math.round(b.north * 1e4) / 1e4,
      }
    } else if (k === 'shapes' && v && typeof v === 'object') {
      norm.shapes = normalizeShapesForCacheKey(v as SearchShapes)
    } else if (Array.isArray(v)) {
      norm[k] = [...v].sort()
    } else {
      norm[k] = v
    }
  }
  return JSON.stringify(norm)
}

export const searchListingsAll = (filter: SearchListingsAllFilter): Promise<SearchListingsAllResult> => {
  const parsed = FilterSchema.parse(filter)
  const cacheKey = stableCacheKey(parsed)
  return makeResilientCached(
    () => fetchSearchListingsAll(parsed),
    ['search-listings-all-v1', cacheKey],
    {
      revalidate: CACHE_WINDOWS.listingTile,
      tags: [cacheTag.listings],
    },
    EMPTY_RESULT,
  )()
}

async function fetchSearchListingsAllCount(parsed: z.output<typeof FilterSchema>): Promise<number> {
  const supabase = supabaseAnon()
  if (!supabase) return 0

  // Shapes: resolve the key set, then sum per-chunk head counts (disjoint key
  // chunks → the sum is exact). Same fallback policy as the row path.
  if (parsed.shapes) return countSearchListingsAllInShapes(supabase, parsed, shapeSearchDeps)

  const query = applySearchFilters(
    supabase.from('listing_search_mv').select('listing_key', { count: 'exact', head: true }),
    parsed
  )
  const { count, error } = await query
  if (error) {
    throw new Error(`[searchListingsAllCount] supabase error: ${error.message}`)
  }
  return count ?? 0
}

/**
 * Head-count variant — powers the All-filters sheet's live "N homes" match
 * count. limit/offset/sort never change a count, so they are normalized out
 * of the cache key and every page of one filter shares a single total.
 */
export const searchListingsAllCount = (filter: SearchListingsAllFilter): Promise<number> => {
  const parsed = FilterSchema.parse(filter)
  const { limit: _limit, offset: _offset, sort: _sort, ...countScope } = parsed
  void _limit
  void _offset
  void _sort
  const cacheKey = stableCacheKey(countScope as unknown as Record<string, unknown>)
  return makeResilientCached(
    () => fetchSearchListingsAllCount(parsed),
    ['search-listings-all-count-v1', cacheKey],
    { revalidate: CACHE_WINDOWS.listingTile, tags: [cacheTag.listings] },
    0,
  )()
}

/**
 * Internal exports for unit tests ONLY (shapes schema validation + cache-key
 * stability). Product code imports searchListingsAll / searchListingsAllCount.
 */
export { FilterSchema as SearchListingsAllFilterSchema, stableCacheKey as searchListingsAllCacheKey }
