import type { AdvancedListingsFilters } from '@/app/actions/listings'
import { homesForSalePath, listingsBrowsePath } from '@/lib/slug'

export type SavedSearchFilters = Record<string, unknown>

type Primitive = string | number | boolean

const FILTER_KEYS = [
  'city',
  'subdivision',
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
  'newListingsDays',
  'sort',
  'includeClosed',
] as const

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

export function normalizeSavedSearchFilters(input: SavedSearchFilters): SavedSearchFilters {
  const out: SavedSearchFilters = {}

  for (const key of FILTER_KEYS) {
    const value = input[key]
    if (value == null) continue

    if (key === 'city' || key === 'subdivision' || key === 'postalCode' || key === 'propertyType' || key === 'propertySubType' || key === 'statusFilter' || key === 'keywords' || key === 'viewContains' || key === 'sort') {
      const parsed = asTrimmedString(value)
      if (parsed) out[key] = parsed
      continue
    }

    if (key === 'includeClosed' || key === 'hasOpenHouse' || key === 'hasPool' || key === 'hasView' || key === 'hasWaterfront' || key === 'hasFireplace' || key === 'hasGolfCourse') {
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
  const validStatus = statusRaw && ['active', 'active_and_pending', 'pending', 'closed', 'all'].includes(statusRaw)
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

  return {
    city: asTrimmedString(normalized.city),
    subdivision: asTrimmedString(normalized.subdivision),
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
    hasOpenHouse: asBoolean(normalized.hasOpenHouse),
    garageMin: asNumber(normalized.garageMin),
    hasPool: asBoolean(normalized.hasPool),
    hasView: asBoolean(normalized.hasView),
    hasWaterfront: asBoolean(normalized.hasWaterfront),
    hasFireplace: asBoolean(normalized.hasFireplace),
    hasGolfCourse: asBoolean(normalized.hasGolfCourse),
    viewContains: asTrimmedString(normalized.viewContains),
    newListingsDays: asNumber(normalized.newListingsDays),
    sort: validSort,
    includeClosed: asBoolean(normalized.includeClosed),
  }
}

export function buildSearchUrlFromFilters(filters: SavedSearchFilters): string {
  const normalized = normalizeSavedSearchFilters(filters)
  const city = asTrimmedString(normalized.city)
  const subdivision = asTrimmedString(normalized.subdivision)
  const params = new URLSearchParams()

  for (const [key, value] of Object.entries(normalized)) {
    if (key === 'city' || key === 'subdivision') continue
    if (typeof value === 'boolean') {
      if (value === true) params.set(key, key === 'includeClosed' ? '1' : '1')
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
  const status = asTrimmedString(normalized.statusFilter)

  if (beds && beds > 0) parts.push(`${beds}+ Beds`)
  if (baths && baths > 0) parts.push(`${baths}+ Baths`)
  if (minPrice || maxPrice) {
    const min = minPrice ? `$${Math.round(minPrice / 1000)}K` : ''
    const max = maxPrice ? `$${Math.round(maxPrice / 1000)}K` : ''
    parts.push([min, max].filter(Boolean).join('-') || 'Any price')
  }
  if (city) parts.push(city)
  if (status) parts.push(status)

  return parts.length > 0 ? parts.join(', ') : 'Any filters'
}

export function getFilterNameFallback(filters: SavedSearchFilters): string {
  const normalized = normalizeSavedSearchFilters(filters)
  const city = asTrimmedString(normalized.city)
  const subdivision = asTrimmedString(normalized.subdivision)
  const minPrice = asNumber(normalized.minPrice)
  const maxPrice = asNumber(normalized.maxPrice)

  if (city && subdivision) return `${subdivision} in ${city}`
  if (city && minPrice && maxPrice) return `${city} $${Math.round(minPrice / 1000)}K-$${Math.round(maxPrice / 1000)}K`
  if (city) return `${city} homes`
  return 'Popular search'
}

export function toCacheListingKeys(listingRows: Array<{ ListingKey?: string | null; ListNumber?: string | null }>): string[] {
  const keys: string[] = []
  for (const row of listingRows) {
    const key = (row.ListNumber ?? row.ListingKey ?? '').toString().trim()
    if (key) keys.push(key)
  }
  return keys
}
