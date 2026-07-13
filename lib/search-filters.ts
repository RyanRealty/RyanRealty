import type { AdvancedListingsFilters } from '@/app/actions/listings'
import { homesForSalePath, listingsBrowsePath } from '@/lib/slug'
import { hrefForNeighborhoodSlug, labelForNeighborhoodSlug } from '@/lib/neighborhood-areas'
import { SEARCH_FIELDS, ALL_SEARCH_URL_PARAMS } from '@/lib/search/field-registry'

export type SavedSearchFilters = Record<string, unknown>

type Primitive = string | number | boolean

const LEGACY_FILTER_KEYS = [
  'city',
  'subdivision',
  'neighborhoodSlug',
  'minPrice',
  'maxPrice',
  'beds',
  'baths',
  'minSqFt',
  'maxSqFt',
  'maxBeds',
  'maxBaths',
  'yearBuiltMin',
  'yearBuiltMax',
  'lotAcresMin',
  'lotAcresMax',
  'postalCode',
  'propertyType',
  'propertySubType',
  'statusFilter',
  'keywords',
  'hasOpenHouse',
  'garageMin',
  'hasPool',
  'hasView',
  'hasWaterfront',
  'hasFireplace',
  'hasGolfCourse',
  'viewContains',
  'cities',
  'viewContainsAny',
  'offMarketWithinDays',
  'excludeSoldSince',
  'newListingsDays',
  'sort',
  'includeClosed',
  'view',
  'poly',
] as const

// Registry-driven param kinds (lib/search/field-registry.ts). Hash stability:
// rows saved before these keys existed normalize identically — normalize only
// emits keys present on the input.
const REGISTRY_MULTI_KEYS = new Set(
  SEARCH_FIELDS.filter((f) => f.kind === 'multi').map((f) => f.key),
)
const REGISTRY_BOOLEAN_KEYS = new Set(
  SEARCH_FIELDS.filter((f) => f.kind === 'boolean').map((f) => f.key),
)
const REGISTRY_TEXT_KEYS = new Set(
  SEARCH_FIELDS.filter((f) => f.kind === 'text').map((f) => f.key),
)

/** Legacy string[] keys — arrays only, never CSV (unchanged URL behavior). */
const LEGACY_ARRAY_KEYS = new Set(['cities', 'viewContainsAny'])

const LEGACY_STRING_KEYS = new Set([
  'city', 'subdivision', 'neighborhoodSlug', 'postalCode', 'propertyType',
  'propertySubType', 'statusFilter', 'keywords', 'viewContains', 'sort', 'view', 'poly',
])

const LEGACY_BOOLEAN_KEYS = new Set([
  'includeClosed', 'hasOpenHouse', 'hasPool', 'hasView', 'hasWaterfront',
  'hasFireplace', 'hasGolfCourse', 'excludeSoldSince',
])

const FILTER_KEYS: readonly string[] = Array.from(
  new Set([...LEGACY_FILTER_KEYS, ...ALL_SEARCH_URL_PARAMS]),
)

function asTrimmedString(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  const next = value.trim()
  return next.length > 0 ? next : undefined
}

function asNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) return parsed
  }
  return undefined
}

function asBoolean(value: unknown): boolean | undefined {
  if (typeof value === 'boolean') return value
  if (typeof value === 'string') {
    const next = value.trim().toLowerCase()
    if (next === '1' || next === 'true' || next === 'yes') return true
    if (next === '0' || next === 'false' || next === 'no') return false
  }
  return undefined
}

/** Registry multis: accept string[] or the URL's CSV grammar, emit string[]. */
function asStringArray(value: unknown): string[] | undefined {
  const parts = Array.isArray(value)
    ? value.map((v) => asTrimmedString(v)).filter((v): v is string => Boolean(v))
    : typeof value === 'string'
      ? value.split(',').map((v) => v.trim()).filter(Boolean)
      : []
  return parts.length > 0 ? parts : undefined
}

export function normalizeSavedSearchFilters(input: SavedSearchFilters): SavedSearchFilters {
  const out: SavedSearchFilters = {}

  for (const key of FILTER_KEYS) {
    const value = input[key]
    if (value == null) continue

    if (LEGACY_ARRAY_KEYS.has(key)) {
      if (Array.isArray(value)) {
        const parsed = value.map((v) => asTrimmedString(v)).filter((v): v is string => Boolean(v))
        if (parsed.length > 0) out[key] = parsed
      }
      continue
    }

    if (REGISTRY_MULTI_KEYS.has(key)) {
      const parsed = asStringArray(value)
      if (parsed) out[key] = parsed
      continue
    }

    if (LEGACY_STRING_KEYS.has(key) || REGISTRY_TEXT_KEYS.has(key)) {
      const parsed = asTrimmedString(value)
      if (parsed) out[key] = parsed
      continue
    }

    if (LEGACY_BOOLEAN_KEYS.has(key) || REGISTRY_BOOLEAN_KEYS.has(key)) {
      const parsed = asBoolean(value)
      if (parsed !== undefined) out[key] = parsed
      continue
    }

    const parsed = asNumber(value)
    if (parsed !== undefined) out[key] = parsed
  }

  return out
}

function stableSerialize(value: unknown): string {
  if (value == null) return 'null'
  if (typeof value === 'string') return JSON.stringify(value)
  if (typeof value === 'number' || typeof value === 'boolean') return JSON.stringify(value)
  if (Array.isArray(value)) return `[${value.map(stableSerialize).join(',')}]`
  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${JSON.stringify(k)}:${stableSerialize(v)}`)
    return `{${entries.join(',')}}`
  }
  return JSON.stringify(String(value))
}

export function getSavedSearchHash(input: SavedSearchFilters): string {
  const normalized = normalizeSavedSearchFilters(input)
  const serialized = stableSerialize(normalized)
  let hash = 5381
  for (let i = 0; i < serialized.length; i += 1) {
    hash = ((hash << 5) + hash) ^ serialized.charCodeAt(i)
  }
  return `s_${(hash >>> 0).toString(16)}`
}

export function savedFiltersToAdvanced(filters: SavedSearchFilters): AdvancedListingsFilters & { city?: string; subdivision?: string } {
  const normalized = normalizeSavedSearchFilters(filters)
  const statusRaw = asTrimmedString(normalized.statusFilter)
  const validStatus = statusRaw && ['active', 'active_and_pending', 'pending', 'closed', 'all', 'coming_soon', 'expired', 'withdrawn', 'canceled', 'off_market', 'active_or_offmarket'].includes(statusRaw)
    ? statusRaw
    : undefined
  const sortRaw = asTrimmedString(normalized.sort)
  const validSort = sortRaw && [
    'newest',
    'oldest',
    'price_asc',
    'price_desc',
    'price_per_sqft_asc',
    'price_per_sqft_desc',
    'year_newest',
    'year_oldest',
  ].includes(sortRaw)
    ? (sortRaw as AdvancedListingsFilters['sort'])
    : 'newest'

  const bool = (key: string) => asBoolean(normalized[key])
  const arr = (key: string) => asStringArray(normalized[key])

  return {
    city: asTrimmedString(normalized.city),
    subdivision: asTrimmedString(normalized.subdivision),
    neighborhoodSlug: asTrimmedString(normalized.neighborhoodSlug),
    minPrice: asNumber(normalized.minPrice),
    maxPrice: asNumber(normalized.maxPrice),
    minBeds: asNumber(normalized.beds),
    minBaths: asNumber(normalized.baths),
    minSqFt: asNumber(normalized.minSqFt),
    maxSqFt: asNumber(normalized.maxSqFt),
    maxBeds: asNumber(normalized.maxBeds),
    maxBaths: asNumber(normalized.maxBaths),
    yearBuiltMin: asNumber(normalized.yearBuiltMin),
    yearBuiltMax: asNumber(normalized.yearBuiltMax),
    lotAcresMin: asNumber(normalized.lotAcresMin),
    lotAcresMax: asNumber(normalized.lotAcresMax),
    postalCode: asTrimmedString(normalized.postalCode),
    propertyType: asTrimmedString(normalized.propertyType),
    propertySubType: asTrimmedString(normalized.propertySubType),
    statusFilter: validStatus,
    keywords: asTrimmedString(normalized.keywords),
    hasOpenHouse: bool('hasOpenHouse'),
    garageMin: asNumber(normalized.garageMin),
    hasPool: bool('hasPool'),
    hasView: bool('hasView'),
    hasWaterfront: bool('hasWaterfront'),
    hasFireplace: bool('hasFireplace'),
    hasGolfCourse: bool('hasGolfCourse'),
    viewContains: asTrimmedString(normalized.viewContains),
    cities: Array.isArray(normalized.cities) ? (normalized.cities as string[]) : undefined,
    viewContainsAny: Array.isArray(normalized.viewContainsAny) ? (normalized.viewContainsAny as string[]) : undefined,
    offMarketWithinDays: asNumber(normalized.offMarketWithinDays),
    excludeSoldSince: asBoolean(normalized.excludeSoldSince),
    newListingsDays: asNumber(normalized.newListingsDays),
    sort: validSort,
    includeClosed: asBoolean(normalized.includeClosed),
    // ── Registry-driven fields (lib/search/field-registry.ts) ───────────────
    // Ranges (max-only URL params)
    hoaMonthlyMax: asNumber(normalized.hoaMonthlyMax),
    taxAnnualMax: asNumber(normalized.taxAnnualMax),
    monthlyPaymentMax: asNumber(normalized.monthlyPaymentMax),
    daysOnMarket: asNumber(normalized.daysOnMarket),
    // Booleans
    newConstruction: bool('newConstruction'),
    basement: bool('basement'),
    horseProperty: bool('horseProperty'),
    seniorCommunity: bool('seniorCommunity'),
    noHoa: bool('noHoa'),
    irrigationRights: bool('irrigationRights'),
    hasVirtualTour: bool('hasVirtualTour'),
    priceReduced: bool('priceReduced'),
    ownerWillCarry: bool('ownerWillCarry'),
    strAllowed: bool('strAllowed'),
    gatedCommunity: bool('gatedCommunity'),
    guestHouse: bool('guestHouse'),
    shop: bool('shop'),
    rvParking: bool('rvParking'),
    rvGarage: bool('rvGarage'),
    evCharging: bool('evCharging'),
    heatedGarage: bool('heatedGarage'),
    singleLevel: bool('singleLevel'),
    primaryOnMain: bool('primaryOnMain'),
    inLawFloorplan: bool('inLawFloorplan'),
    fencedYard: bool('fencedYard'),
    onGolfCourse: bool('onGolfCourse'),
    adjoinsPublicLand: bool('adjoinsPublicLand'),
    onWell: bool('onWell'),
    publicWater: bool('publicWater'),
    onSeptic: bool('onSeptic'),
    publicSewer: bool('publicSewer'),
    // Multi-selects (canonical DB values)
    appliances: arr('appliances'),
    flooring: arr('flooring'),
    heatingTypes: arr('heatingTypes'),
    coolingTypes: arr('coolingTypes'),
    interiorFeatures: arr('interiorFeatures'),
    exteriorFeatures: arr('exteriorFeatures'),
    windowFeatures: arr('windowFeatures'),
    laundryFeatures: arr('laundryFeatures'),
    securityFeatures: arr('securityFeatures'),
    parkingFeatures: arr('parkingFeatures'),
    patioPorch: arr('patioPorch'),
    lotFeatures: arr('lotFeatures'),
    viewTypes: arr('viewTypes'),
    fireplaceTypes: arr('fireplaceTypes'),
    basementTypes: arr('basementTypes'),
    otherStructures: arr('otherStructures'),
    structureTypes: arr('structureTypes'),
    hoaAmenities: arr('hoaAmenities'),
    communityFeatures: arr('communityFeatures'),
    accessibilityFeatures: arr('accessibilityFeatures'),
    waterfrontTypes: arr('waterfrontTypes'),
    utilities: arr('utilities'),
    sewerTypes: arr('sewerTypes'),
    waterSource: arr('waterSource'),
    roadSurface: arr('roadSurface'),
    roofTypes: arr('roofTypes'),
    constructionMaterials: arr('constructionMaterials'),
    foundationTypes: arr('foundationTypes'),
    architecturalStyles: arr('architecturalStyles'),
    levelsOptions: arr('levelsOptions'),
    listingTerms: arr('listingTerms'),
    specialConditions: arr('specialConditions'),
    currentUse: arr('currentUse'),
    irrigationSource: arr('irrigationSource'),
    commonWalls: arr('commonWalls'),
    roadFrontage: arr('roadFrontage'),
    poolFeatures: arr('poolFeatures'),
    county: arr('county'),
    directionFaces: arr('directionFaces'),
    // School texts
    elementarySchool: asTrimmedString(normalized.elementarySchool),
    middleSchool: asTrimmedString(normalized.middleSchool),
    highSchool: asTrimmedString(normalized.highSchool),
    schoolDistrict: asTrimmedString(normalized.schoolDistrict),
  }
}

export function buildSearchUrlFromFilters(filters: SavedSearchFilters): string {
  const normalized = normalizeSavedSearchFilters(filters)
  const city = asTrimmedString(normalized.city)
  const subdivision = asTrimmedString(normalized.subdivision)
  const neighborhoodSlug = asTrimmedString(normalized.neighborhoodSlug)

  // Neighborhood-scoped searches land on the neighborhood's canonical page
  // (Bend district or resort community) — the richest "browse all" surface.
  if (neighborhoodSlug && !city && !subdivision) {
    return hrefForNeighborhoodSlug(neighborhoodSlug)
  }

  const params = new URLSearchParams()

  for (const [key, value] of Object.entries(normalized)) {
    if (key === 'city' || key === 'subdivision' || key === 'neighborhoodSlug') continue
    if (typeof value === 'boolean') {
      if (value === true) params.set(key, key === 'includeClosed' ? '1' : '1')
      continue
    }
    if (Array.isArray(value)) {
      // Registry multis round-trip as the URL's CSV grammar. Legacy array
      // keys (cities, viewContainsAny) keep their historical no-URL behavior.
      if (REGISTRY_MULTI_KEYS.has(key) && value.length > 0) params.set(key, value.join(','))
      continue
    }
    if (typeof value === 'string' || typeof value === 'number') {
      params.set(key, String(value))
    }
  }

  const query = params.toString()
  if (city && subdivision) return `${homesForSalePath(city, subdivision)}${query ? `?${query}` : ''}`
  if (city) return `${homesForSalePath(city)}${query ? `?${query}` : ''}`
  return `${listingsBrowsePath()}${query ? `?${query}` : ''}`
}

export function getFiltersSummary(filters: SavedSearchFilters): string {
  const normalized = normalizeSavedSearchFilters(filters)
  const parts: string[] = []
  const beds = asNumber(normalized.beds)
  const baths = asNumber(normalized.baths)
  const minPrice = asNumber(normalized.minPrice)
  const maxPrice = asNumber(normalized.maxPrice)
  const city = asTrimmedString(normalized.city)
  const neighborhoodSlug = asTrimmedString(normalized.neighborhoodSlug)
  const status = asTrimmedString(normalized.statusFilter)

  if (beds && beds > 0) parts.push(`${beds}+ Beds`)
  if (baths && baths > 0) parts.push(`${baths}+ Baths`)
  if (minPrice || maxPrice) {
    // $850K below a million, $1.5M / $2M at and above it — never "$1500K".
    const fmt = (value: number) =>
      value >= 1_000_000
        ? `$${(value / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`
        : `$${Math.round(value / 1000)}K`
    const min = minPrice ? fmt(minPrice) : ''
    const max = maxPrice ? fmt(maxPrice) : ''
    parts.push([min, max].filter(Boolean).join('-') || 'Any price')
  }
  if (neighborhoodSlug) parts.push(labelForNeighborhoodSlug(neighborhoodSlug))
  if (city) parts.push(city)
  if (status) parts.push(status)

  return parts.length > 0 ? parts.join(', ') : 'Any filters'
}

export function getFilterNameFallback(filters: SavedSearchFilters): string {
  const normalized = normalizeSavedSearchFilters(filters)
  const city = asTrimmedString(normalized.city)
  const subdivision = asTrimmedString(normalized.subdivision)
  const neighborhoodSlug = asTrimmedString(normalized.neighborhoodSlug)
  const minPrice = asNumber(normalized.minPrice)
  const maxPrice = asNumber(normalized.maxPrice)

  if (neighborhoodSlug) return `${labelForNeighborhoodSlug(neighborhoodSlug)} homes`
  if (city && subdivision) return `${subdivision} in ${city}`
  if (city && minPrice && maxPrice) return `${city} $${Math.round(minPrice / 1000)}K-$${Math.round(maxPrice / 1000)}K`
  if (city) return `${city} homes`
  return 'Popular search'
}

/**
 * Keys that do NOT narrow the result set: presentation (view, sort), a drawn
 * polygon the alert path cannot match server-side (poly), and status/scope
 * toggles that alone still match the whole feed. A saved search made of ONLY
 * these matches every active home — the empty-filter guard must treat it as
 * empty so it can never become a whole-feed alert (attack finding 2026-07-11).
 */
const NON_NARROWING_KEYS = new Set([
  'view', 'sort', 'poly', 'statusFilter', 'includeClosed',
])

/**
 * True when the normalized filters carry at least one predicate that actually
 * narrows inventory (a place, price, beds, an amenity, keywords, …). Use this,
 * NOT `Object.keys(...).length`, to gate alert creation and sending.
 */
export function hasNarrowingFilter(input: SavedSearchFilters): boolean {
  const normalized = normalizeSavedSearchFilters(input)
  return Object.keys(normalized).some((k) => {
    if (NON_NARROWING_KEYS.has(k)) return false
    const v = normalized[k]
    if (v == null) return false
    if (Array.isArray(v)) return v.length > 0
    if (typeof v === 'string') return v.trim() !== ''
    if (typeof v === 'boolean') return v === true
    return true
  })
}

