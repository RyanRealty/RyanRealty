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
import { CACHE_WINDOWS, cacheTag } from '@/lib/data/cache/unstable-cache'
import { makeResilientCached } from '@/lib/data/cache/resilient'
import type { ListingTile, ListingStatus } from '@/lib/data/types/listing'
import { propertyTypeFilterToCodes } from '@/lib/property-type'
import { SERVICE_AREA_CITIES_LOWER } from '@/lib/data/listings/service-area'
import { SEARCH_FIELDS } from '@/lib/search/field-registry'

const ACTIVE_STATUSES: ListingStatus[] = ['Active', 'Coming Soon', 'Active Under Contract']
const PENDING_STATUSES: ListingStatus[] = ['Pending']

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
  // Multi-selects (registry kind 'multi') — column + match mode resolve from
  // the registry def (matchMode 'all' -> contains, default -> overlaps,
  // singleColumnIn -> IN on the scalar column).
  appliances: multi(),
  flooring: multi(),
  heatingTypes: multi(),
  coolingTypes: multi(),
  interiorFeatures: multi(),
  exteriorFeatures: multi(),
  windowFeatures: multi(),
  laundryFeatures: multi(),
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
  directionFaces: multi(),
  // Text (registry kind 'text', schools) — case-insensitive exact match.
  elementarySchool: text(),
  middleSchool: text(),
  highSchool: text(),
  schoolDistrict: text(),
  // Max-only ranges (registry: min unused in the UI).
  hoaMonthlyMax: z.number().nonnegative().optional(),
  taxAnnualMax: z.number().nonnegative().optional(),
  monthlyPaymentMax: z.number().nonnegative().optional(),
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
  /** Service-area guard — same default logic as getListingTiles. */
  scope: z.enum(['service-area', 'all']).optional(),

  // ── Status / property type ────────────────────────────────────────────────
  status: z.enum(['active', 'active-and-pending', 'pending-only']).default('active'),
  propertyType: z.string().min(1).max(40).optional().catch(undefined),
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

export type SearchListingsAllResult = {
  rows: ListingTile[]
  totalCount: number
  /** True when rows beyond this page exist (totalCount > offset + rows). */
  capped: boolean
}

const EMPTY_RESULT: SearchListingsAllResult = { rows: [], totalCount: 0, capped: false }

/**
 * PostgREST array literal with every element quoted — safe for values carrying
 * spaces, slashes, or parens ("RV Access/Parking", "Skylight(s)"). Braces,
 * quotes, and backslashes are stripped from elements: no registry vocabulary
 * uses them, so a URL-injected value simply matches nothing.
 */
function arrayLiteral(values: readonly string[]): string {
  return `{${values.map((v) => `"${v.replace(/[\\"{}]/g, '').trim()}"`).join(',')}}`
}

/** Strip ILIKE wildcards + escapes for exact case-insensitive matching. */
function ilikeExact(value: string): string {
  // * is a PostgREST wildcard (translated to %) — strip it along with SQL's.
  return value.replace(/[%_*\\]/g, '').trim()
}

type BooleanFilterKey =
  | 'hasFireplace' | 'hasPool' | 'hasWaterfront' | 'hasView' | 'hasGolfCourse'
  | 'newConstruction' | 'basement' | 'horseProperty' | 'seniorCommunity' | 'noHoa'
  | 'irrigationRights' | 'hasVirtualTour' | 'hasOpenHouse' | 'priceReduced'
  | 'ownerWillCarry' | 'strAllowed' | 'gatedCommunity' | 'guestHouse' | 'shop'
  | 'rvParking' | 'rvGarage' | 'evCharging' | 'heatedGarage' | 'singleLevel'
  | 'primaryOnMain' | 'inLawFloorplan' | 'fencedYard' | 'onGolfCourse'
  | 'adjoinsPublicLand' | 'onWell' | 'publicWater' | 'onSeptic' | 'publicSewer'

type BooleanPredicate =
  | { op: 'isTrue'; col: string }
  /** col IS DISTINCT FROM true (noHoa). */
  | { op: 'notTrue'; col: string }
  | { op: 'eqValue'; col: string; value: string }
  | { op: 'containsAll'; col: string; values: readonly string[] }
  | { op: 'overlapsAny'; col: string; values: readonly string[] }
  /** Multi-column OR in PostgREST syntax (contract "DAL expression" fields). */
  | { op: 'orExpr'; expr: string }
  /** view_types is a real non-empty view beyond bare 'Neighborhood'. */
  | { op: 'hasView' }

/** Boolean predicates, 1:1 with the contract's boolean table. */
const BOOLEAN_PREDICATES: Record<BooleanFilterKey, BooleanPredicate> = {
  hasFireplace: { op: 'isTrue', col: 'fireplace_yn' },
  hasPool: { op: 'isTrue', col: 'pool_yn' },
  hasWaterfront: { op: 'isTrue', col: 'waterfront_yn' },
  hasView: { op: 'hasView' },
  hasGolfCourse: {
    op: 'orExpr',
    expr: `view_types.cs.${arrayLiteral(['Golf Course'])},lot_features_arr.cs.${arrayLiteral(['On Golf Course'])}`,
  },
  newConstruction: { op: 'isTrue', col: 'new_construction_yn' },
  basement: { op: 'isTrue', col: 'basement_yn' },
  horseProperty: { op: 'isTrue', col: 'horse_yn' },
  seniorCommunity: { op: 'isTrue', col: 'senior_community_yn' },
  noHoa: { op: 'notTrue', col: 'association_yn' },
  irrigationRights: { op: 'isTrue', col: 'irrigation_water_rights_yn' },
  hasVirtualTour: { op: 'isTrue', col: 'has_virtual_tour' },
  hasOpenHouse: { op: 'isTrue', col: 'has_open_house' },
  priceReduced: { op: 'isTrue', col: 'price_reduced' },
  ownerWillCarry: { op: 'containsAll', col: 'listing_terms', values: ['Owner Will Carry'] },
  strAllowed: { op: 'containsAll', col: 'community_features', values: ['Short Term Rentals Allowed'] },
  gatedCommunity: {
    op: 'orExpr',
    expr: `hoa_amenities.cs.${arrayLiteral(['Gated'])},parking_features.cs.${arrayLiteral(['Gated'])}`,
  },
  guestHouse: { op: 'containsAll', col: 'other_structures', values: ['Guest House'] },
  shop: {
    op: 'orExpr',
    expr: `other_structures.cs.${arrayLiteral(['Workshop'])},parking_features.cs.${arrayLiteral(['Workshop in Garage'])}`,
  },
  rvParking: {
    op: 'orExpr',
    expr: `parking_features.ov.${arrayLiteral(['RV Access/Parking', 'RV Garage'])},other_structures.cs.${arrayLiteral(['RV/Boat Storage'])}`,
  },
  rvGarage: { op: 'containsAll', col: 'parking_features', values: ['RV Garage'] },
  evCharging: { op: 'containsAll', col: 'parking_features', values: ['Electric Vehicle Charging Station(s)'] },
  heatedGarage: { op: 'containsAll', col: 'parking_features', values: ['Heated Garage'] },
  singleLevel: { op: 'eqValue', col: 'levels', value: 'One' },
  primaryOnMain: { op: 'containsAll', col: 'interior_features', values: ['Primary Downstairs'] },
  inLawFloorplan: { op: 'containsAll', col: 'interior_features', values: ['In-Law Floorplan'] },
  fencedYard: { op: 'containsAll', col: 'lot_features_arr', values: ['Fenced'] },
  onGolfCourse: { op: 'containsAll', col: 'lot_features_arr', values: ['On Golf Course'] },
  adjoinsPublicLand: {
    op: 'orExpr',
    expr: `lot_features_arr.cs.${arrayLiteral(['Adjoins Public Lands'])},community_features.cs.${arrayLiteral(['Access to Public Lands'])}`,
  },
  onWell: { op: 'overlapsAny', col: 'water_source', values: ['Well', 'Shared Well'] },
  publicWater: { op: 'containsAll', col: 'water_source', values: ['Public'] },
  onSeptic: {
    op: 'overlapsAny',
    col: 'sewer_types',
    values: [
      'Septic Tank',
      'Standard Leach Field',
      'Sand Filter',
      'Alternative Treatment Tech System',
      'Holding Tank',
      'Capping Fill',
    ],
  },
  publicSewer: { op: 'containsAll', col: 'sewer_types', values: ['Public Sewer'] },
}

const BOOLEAN_FILTER_KEYS = Object.keys(BOOLEAN_PREDICATES) as BooleanFilterKey[]

/** Registry multi defs, resolved once at module load. */
const MULTI_FIELD_DEFS = SEARCH_FIELDS.filter((def) => def.kind === 'multi')

const SCHOOL_TEXT_COLUMNS: Record<string, string> = {
  elementarySchool: 'elementary_school',
  middleSchool: 'middle_school',
  highSchool: 'high_school',
  schoolDistrict: 'school_district',
}

/** Range predicates: filter key -> MV column (gte on Min, lte on Max). */
const RANGE_COLUMNS = {
  price: 'list_price',
  sqft: 'sqft',
  lotAcres: 'lot_size_acres',
  yearBuilt: 'year_built',
  beds: 'beds',
  baths: 'baths',
} as const

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
  const hasExplicitGeo = Boolean(
    parsed.city ||
      (parsed.cities && parsed.cities.length > 0) ||
      parsed.subdivision ||
      (parsed.subdivisions && parsed.subdivisions.length > 0) ||
      parsed.postalCode ||
      parsed.neighborhood ||
      parsed.bbox
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
    const sub = ilikeExact(parsed.propertySubType)
    if (sub) query = query.ilike('property_sub_type', sub)
  }

  // ── Ranges ────────────────────────────────────────────────────────────────
  for (const [key, col] of Object.entries(RANGE_COLUMNS)) {
    const min = record[`${key}Min`]
    const max = record[`${key}Max`]
    if (typeof min === 'number' && min > 0) query = query.gte(col, min)
    if (typeof max === 'number' && max > 0) query = query.lte(col, max)
  }
  if (parsed.garageMin) query = query.gte('garage_spaces', parsed.garageMin)
  if (parsed.domMax) query = query.lte('dom', parsed.domMax)
  if (parsed.hoaMonthlyMax != null && parsed.hoaMonthlyMax > 0) {
    query = query.lte('hoa_monthly', parsed.hoaMonthlyMax)
  }
  if (parsed.taxAnnualMax != null && parsed.taxAnnualMax > 0) {
    query = query.lte('tax_annual_amount', parsed.taxAnnualMax)
  }
  if (parsed.monthlyPaymentMax != null && parsed.monthlyPaymentMax > 0) {
    query = query.lte('estimated_monthly_piti', parsed.monthlyPaymentMax)
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

  // ── School text fields (case-insensitive exact) ───────────────────────────
  for (const [key, col] of Object.entries(SCHOOL_TEXT_COLUMNS)) {
    const raw = record[key]
    if (typeof raw !== 'string') continue
    const value = ilikeExact(raw)
    if (value) query = query.ilike(col, value)
  }

  // ── Keywords → public_remarks word-AND match ──────────────────────────────
  // Each word must appear somewhere in the remarks (order-independent), the
  // same contract as the legacy websearch_to_tsquery path — one literal
  // phrase match silently failed multi-word queries like "shop mountain view"
  // (review finding 2026-07-11). * and _ are PostgREST/SQL wildcards; strip
  // them with the escapes.
  if (parsed.keywords) {
    const words = parsed.keywords
      .replace(/[%_*\\]/g, ' ')
      .split(/\s+/)
      .map((w) => w.trim())
      .filter((w) => w.length >= 2)
      .slice(0, 6)
    for (const word of words) {
      query = query.ilike('public_remarks', `%${word}%`)
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

/** MV row shape — listing_search_mv carries every listing_tile_mv column. */
type ListingSearchMvRow = {
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

function mvRowToTile(row: ListingSearchMvRow): ListingTile {
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

const TILE_SELECT_COLUMNS = [
  'listing_key', 'list_number', 'standard_status', 'list_price', 'close_price',
  'close_date', 'beds', 'baths', 'sqft', 'street_number', 'street_name',
  'street_suffix', 'city', 'postal_code', 'subdivision_name', 'lat', 'lng',
  'photo_url', 'property_type', 'property_sub_type', 'on_market_date',
  'modified_at', 'price_per_sqft', 'lot_size_acres', 'year_built',
  'garage_spaces', 'pool_yn', 'has_virtual_tour', 'dom', 'price_drop_count',
  'address_slug', 'boundary_city', 'boundary_neighborhood', 'boundary_subdivision',
].join(',')

async function fetchSearchListingsAll(
  parsed: z.output<typeof FilterSchema>
): Promise<SearchListingsAllResult> {
  const supabase = supabaseAnon()
  if (!supabase) return EMPTY_RESULT

  // Rows + exact total in ONE query (count: 'exact' rides the row fetch).
  let query = applySearchFilters(
    // Explicit tile columns: select('*') hauled the 36 feature arrays +
    // remarks + tsvector (~2 MB per 500 rows) that mvRowToTile discards.
    supabase.from('listing_search_mv').select(TILE_SELECT_COLUMNS, { count: 'exact' }),
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
