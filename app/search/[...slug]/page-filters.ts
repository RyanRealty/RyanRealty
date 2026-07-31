import { coerceRegistryParams, searchFieldByKey } from '@/lib/search/field-registry'
import { PUBLIC_SEARCH_STATUS_FILTERS } from '@/lib/listing-status-public'
import { pickSearchFeatureFilters } from '@/lib/data'
import { type AdvancedSort } from '../../actions/listings'
import { resolvePresetYearBuiltMin } from '../../../lib/search-presets'
import { type SearchPreset } from './resolve-slug'

export type SearchParams = {
  /** On the on-golf-course landing, ?all=1 falls through to the standard filterable list. */
  all?: string
  minPrice?: string
  maxPrice?: string
  beds?: string
  baths?: string
  minSqFt?: string
  maxSqFt?: string
  maxBeds?: string
  maxBaths?: string
  yearBuiltMin?: string
  yearBuiltMax?: string
  lotAcresMin?: string
  lotAcresMax?: string
  postalCode?: string
  propertyType?: string
  propertySubType?: string
  /** Enumerated sub types, CSV of exact canonical values (registry multi). */
  propertySubTypes?: string
  statusFilter?: string
  keywords?: string
  hasOpenHouse?: string
  garageMin?: string
  hasPool?: string
  hasView?: string
  hasWaterfront?: string
  hasFireplace?: string
  hasGolfCourse?: string
  gatedCommunity?: string
  newListingsDays?: string
  /** Registry dom range's URL param — a days-on-market ceiling. */
  daysOnMarket?: string
  sort?: string
  includeClosed?: string
  page?: string
  perPage?: string
  view?: string
  poly?: string
}

/** Preset breadcrumb label for filter-only searches (e.g. Under $500K, Luxury). */
export function getPresetSearchLabel(sp: SearchParams): string | null {
  if (sp.maxPrice === '500000') return 'Under $500K'
  if (sp.minPrice === '1000000') return 'Luxury'
  if (sp.keywords?.toLowerCase().includes('new construction')) return 'New Construction'
  if (sp.hasWaterfront === '1') return 'Waterfront'
  return null
}

export function hasFilterOnlySearch(sp: SearchParams): boolean {
  return Boolean(sp.maxPrice || sp.minPrice || (sp.keywords?.trim()) || sp.hasWaterfront === '1')
}

/** Number -> string for the filter-bar props (the UI reflects the resolved
 *  filterOpts, including preset-supplied values), undefined when unset. */
export function numStr(n: number | null | undefined): string | undefined {
  return n != null && !Number.isNaN(n) ? String(n) : undefined
}

/** searchParams -> query filter coercion + preset merge for the search page. */
export function buildSearchFilters(args: {
  sp: SearchParams
  city: string | undefined
  decodedSubdivision: string | undefined
  neighborhood: string | undefined
  preset: SearchPreset
}) {
  // const bindings (not parameter destructures) so `preset` narrowing survives
  // into the presetChips closure below.
  const { sp, city, decodedSubdivision, neighborhood, preset } = args
  const filterOptsBase = {
    // Registry fields (fireplace, shop, well water, appliances, …) — without
    // this spread the AllFiltersSheet/chips on this surface would claim filters
    // the query ignores (review finding 2026-07-11).
    ...pickSearchFeatureFilters(coerceRegistryParams(sp as Record<string, string | undefined>)),
    city: city || undefined,
    subdivision: decodedSubdivision,
    neighborhood,
    minPrice: sp.minPrice ? Number(sp.minPrice) : undefined,
    maxPrice: sp.maxPrice ? Number(sp.maxPrice) : undefined,
    minBeds: sp.beds ? Number(sp.beds) : undefined,
    minBaths: sp.baths ? Number(sp.baths) : undefined,
    minSqFt: sp.minSqFt ? Number(sp.minSqFt) : undefined,
    maxSqFt: sp.maxSqFt ? Number(sp.maxSqFt) : undefined,
    maxBeds: sp.maxBeds ? Number(sp.maxBeds) : undefined,
    maxBaths: sp.maxBaths ? Number(sp.maxBaths) : undefined,
    yearBuiltMin: sp.yearBuiltMin ? Number(sp.yearBuiltMin) : undefined,
    yearBuiltMax: sp.yearBuiltMax ? Number(sp.yearBuiltMax) : undefined,
    lotAcresMin: sp.lotAcresMin != null ? Number(sp.lotAcresMin) : undefined,
    lotAcresMax: sp.lotAcresMax != null ? Number(sp.lotAcresMax) : undefined,
    postalCode: sp.postalCode?.trim() || undefined,
    propertyType: sp.propertyType?.trim() || undefined,
    propertySubType: sp.propertySubType?.trim() || undefined,
    // Sanitized here, not just for the UI toggle below: the raw param used to
    // reach the fetch, making ?statusFilter=coming_soon a public browse mode.
    statusFilter: PUBLIC_SEARCH_STATUS_FILTERS.includes(sp.statusFilter?.trim() ?? '')
      ? sp.statusFilter!.trim()
      : undefined,
    keywords: sp.keywords?.trim() || undefined,
    hasOpenHouse: sp.hasOpenHouse === '1',
    garageMin: sp.garageMin != null ? Number(sp.garageMin) : undefined,
    hasPool: sp.hasPool === '1',
    hasView: sp.hasView === '1',
    hasWaterfront: sp.hasWaterfront === '1',
    newListingsDays: sp.newListingsDays ? Number(sp.newListingsDays) : undefined,
    // The registry dom filter writes ?daysOnMarket=N. This page never read it
    // (W-URL audit 2026-07-30): the AllFiltersSheet showed an applied chip
    // while the query ran unfiltered — the worst failure mode a filter has.
    // getAdvancedListings folds it with newListingsDays, tightest ceiling wins.
    daysOnMarket: sp.daysOnMarket ? Number(sp.daysOnMarket) : undefined,
    sort:
      sp.sort === 'newest' || sp.sort === 'oldest' || sp.sort === 'price_asc' || sp.sort === 'price_desc' ||
      sp.sort === 'price_per_sqft_asc' || sp.sort === 'price_per_sqft_desc' || sp.sort === 'year_newest' || sp.sort === 'year_oldest'
        ? (sp.sort as AdvancedSort)
        : 'newest',
    includeClosed: sp.includeClosed === '1',
  }
  // Predefined preset: apply preset params (preset wins for its keys so the page shows the right results)
  const presetYearBuiltMin = preset ? resolvePresetYearBuiltMin(preset) : undefined
  // A preset only FILLS filters the visitor has not explicitly set in the URL.
  // An explicit query param (the visitor changed a filter) wins over the preset
  // for that one key. Without the `!sp.*` guards the preset always won, so
  // changing price / sort / status on a preset page did nothing — "if you change
  // a filter it breaks." Amenity booleans gained their off-switch 2026-07-30
  // (W-UI audit trap T1): `?hasPool=0` on /with-pool now clears the pool
  // filter — the guard is `sp.<key> == null` (URL silent → preset fills), so a
  // visitor landing from search is no longer trapped in a filter they can see
  // but not remove.
  const filterOpts = preset
    ? {
        ...filterOptsBase,
        ...(preset.params.maxPrice != null && !sp.maxPrice && { maxPrice: preset.params.maxPrice }),
        ...(preset.params.minPrice != null && !sp.minPrice && { minPrice: preset.params.minPrice }),
        ...(preset.params.statusFilter != null && !sp.statusFilter && { statusFilter: preset.params.statusFilter }),
        ...(preset.params.newListingsDays != null && !sp.newListingsDays && { newListingsDays: preset.params.newListingsDays }),
        ...(preset.params.hasOpenHouse != null && sp.hasOpenHouse == null && { hasOpenHouse: preset.params.hasOpenHouse }),
        ...(preset.params.hasPool != null && sp.hasPool == null && { hasPool: preset.params.hasPool }),
        ...(preset.params.hasView != null && sp.hasView == null && { hasView: preset.params.hasView }),
        ...(preset.params.hasFireplace != null && sp.hasFireplace == null && { hasFireplace: preset.params.hasFireplace }),
        ...(preset.params.hasGolfCourse != null && sp.hasGolfCourse == null && { hasGolfCourse: preset.params.hasGolfCourse }),
        ...(preset.params.hasWaterfront != null && sp.hasWaterfront == null && { hasWaterfront: preset.params.hasWaterfront }),
        ...(preset.params.viewContains != null && preset.params.viewContains !== '' && { viewContains: preset.params.viewContains }),
        ...(preset.params.lotAcresMin != null && !sp.lotAcresMin && { lotAcresMin: preset.params.lotAcresMin }),
        ...(presetYearBuiltMin != null && !sp.yearBuiltMin && { yearBuiltMin: presetYearBuiltMin }),
        ...(preset.params.propertySubType != null && preset.params.propertySubType !== '' && !sp.propertySubType && { propertySubType: preset.params.propertySubType }),
        // Enumerated sub-type sets (condos / townhomes / manufactured, plan
        // §4.4). URL CSV (?propertySubTypes=...) wins over the preset — the
        // registry spread in filterOptsBase already parsed it.
        ...(preset.params.propertySubTypes != null && preset.params.propertySubTypes.length > 0 && !sp.propertySubTypes && { propertySubTypes: preset.params.propertySubTypes }),
        // lots-and-land: PropertyType filter (Land -> code D); an explicit URL
        // propertyType still wins, same contract as the other preset keys.
        ...(preset.params.propertyType != null && preset.params.propertyType !== '' && !sp.propertyType && { propertyType: preset.params.propertyType }),
        // gated-community: MLS-verified gated flag. Same off-switch contract.
        ...(preset.params.gatedCommunity != null && sp.gatedCommunity == null && { gatedCommunity: preset.params.gatedCommunity }),
        ...(preset.params.keywords != null && preset.params.keywords !== '' && !sp.keywords && { keywords: preset.params.keywords }),
        ...(preset.params.sort != null && !sp.sort && { sort: preset.params.sort as AdvancedSort }),
      }
    : filterOptsBase

  // Preset-applied amenity chips for the filter bar: filters the ROUTE applies
  // that the query string does not carry. Their chip removal writes `<key>=0`,
  // which the preset merge above honors (W-UI audit T1, 2026-07-30).
  const AMENITY_PRESET_KEYS = [
    'hasOpenHouse', 'hasPool', 'hasView', 'hasFireplace', 'hasGolfCourse',
    'hasWaterfront', 'gatedCommunity',
  ] as const
  const presetChips = preset
    ? AMENITY_PRESET_KEYS.flatMap((k) =>
        (preset.params as Record<string, unknown>)[k] != null && (sp as Record<string, string | undefined>)[k] == null
          ? [{ param: k, label: searchFieldByKey(k)?.label ?? k }]
          : []
      )
    : []

  return { filterOpts, presetChips }
}
