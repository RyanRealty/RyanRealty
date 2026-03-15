'use server'

import {
  getListingsWithAdvanced,
  getListingsForMap,
  type AdvancedListingsFilters,
} from '@/app/actions/listings'
import type { ListingTileRow } from '@/app/actions/listings'
import type { MapListingRow } from '@/app/actions/listings'

export type SearchFilters = {
  city?: string
  subdivision?: string
  minPrice?: number
  maxPrice?: number
  beds?: number
  baths?: number
  status?: string
  sort?: string
  minSqFt?: number
  maxSqFt?: number
  lotAcresMin?: number
  lotAcresMax?: number
  yearBuiltMin?: number
  yearBuiltMax?: number
  propertyType?: string
  hasPool?: boolean
  hasView?: boolean
  hasWaterfront?: boolean
  garageMin?: number
  daysOnMarket?: string
  hoa?: string
  maxHoa?: number
  newConstruction?: boolean
  seniorCommunity?: boolean
  horseProperty?: boolean
  golfCourse?: boolean
  keywords?: string
  communityIds?: string[]
  postalCode?: string
}

function toAdvancedFilters(
  f: SearchFilters,
  overrides?: { limit?: number; offset?: number }
): AdvancedListingsFilters & { city?: string; subdivision?: string; limit?: number; offset?: number } {
  const statusFilter: AdvancedListingsFilters['statusFilter'] =
    f.status === 'Sold' ? 'closed'
    : f.status === 'Pending' ? 'pending'
    : f.status === 'Active' ? 'active'
    : 'active_and_pending'

  let domFilter: number | undefined
  if (f.daysOnMarket === '7') domFilter = 7
  else if (f.daysOnMarket === '30') domFilter = 30
  else if (f.daysOnMarket === '90') domFilter = 90

  return {
    city: f.city,
    subdivision: f.subdivision,
    minPrice: f.minPrice,
    maxPrice: f.maxPrice,
    minBeds: f.beds,
    minBaths: f.baths,
    statusFilter,
    sort: (f.sort as AdvancedListingsFilters['sort']) ?? 'newest',
    minSqFt: f.minSqFt,
    maxSqFt: f.maxSqFt,
    yearBuiltMin: f.yearBuiltMin,
    yearBuiltMax: f.yearBuiltMax,
    lotAcresMin: f.lotAcresMin,
    lotAcresMax: f.lotAcresMax,
    propertyType: f.propertyType,
    hasPool: f.hasPool,
    hasView: f.hasView,
    hasWaterfront: f.hasWaterfront,
    garageMin: f.garageMin,
    newListingsDays: domFilter,
    keywords: f.keywords?.trim() || undefined,
    ...overrides,
  }
}

export async function getSearchListings(
  filters: SearchFilters,
  page: number
): Promise<{ listings: ListingTileRow[]; totalCount: number }> {
  const limit = 24
  const offset = (page - 1) * limit
  const opts = toAdvancedFilters(filters, { limit, offset })
  return getListingsWithAdvanced(opts)
}

export async function getSearchMapListings(filters: SearchFilters): Promise<MapListingRow[]> {
  const statusFilter =
    filters.status === 'Sold' ? 'closed'
    : filters.status === 'Pending' ? 'pending'
    : filters.status === 'Active' ? 'active'
    : 'active_and_pending'
  return getListingsForMap({
    city: filters.city,
    subdivision: filters.subdivision,
    statusFilter,
    minPrice: filters.minPrice,
    maxPrice: filters.maxPrice,
    minBeds: filters.beds,
    minBaths: filters.baths,
    minSqFt: filters.minSqFt,
    maxSqFt: filters.maxSqFt,
    yearBuiltMin: filters.yearBuiltMin,
    yearBuiltMax: filters.yearBuiltMax,
    lotAcresMin: filters.lotAcresMin,
    lotAcresMax: filters.lotAcresMax,
    postalCode: filters.postalCode?.trim() || undefined,
    propertyType: filters.propertyType,
  })
}
