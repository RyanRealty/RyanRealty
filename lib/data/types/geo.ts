/**
 * Geographic domain types — cities, neighborhoods, communities (resort
 * subdivisions), zips, and the landing-page data shape each one needs.
 */

import type { Currency, GeoType, IsoTimestamp, Slug } from './shared'
import type { ListingTile } from './listing'
import type { MarketStats, MarketPulse, PriceHistoryPoint } from './market'

export type CityRow = {
  slug: Slug
  name: string
  county: string | null
  state: string
  heroImageUrl: string | null
  activeListingCount: number
  medianListPrice: Currency | null
  communityCount: number
}

export type NeighborhoodRow = {
  slug: Slug
  name: string
  citySlug: Slug
  boundaryGeoJson: GeoJSON.GeoJSON | null
  heroImageUrl: string | null
}

export type CommunityRow = {
  slug: Slug
  name: string
  citySlug: Slug | null
  neighborhoodSlug: Slug | null
  isResort: boolean
  amenities: string[]
  hoaMonthly: Currency | null
  heroImageUrl: string | null
}

/** Common LP payload shape — used as base for City/Neighborhood/Community/Zip. */
export type GeoLPDataBase = {
  geoType: GeoType
  slug: Slug
  name: string
  heroImageUrl: string | null
  marketStats: MarketStats
  marketPulse: MarketPulse | null
  priceHistory: PriceHistoryPoint[]
  activeListings: ListingTile[]
  pendingListings: ListingTile[]
  recentSoldListings: ListingTile[]
  refreshedAt: IsoTimestamp
}

export type CityLPData = GeoLPDataBase & {
  geoType: 'city'
  neighborhoods: NeighborhoodRow[]
  communities: CommunityRow[]
}

export type NeighborhoodLPData = GeoLPDataBase & {
  geoType: 'neighborhood'
  citySlug: Slug
  cityName: string
  boundaryGeoJson: GeoJSON.GeoJSON | null
}

export type CommunityLPData = GeoLPDataBase & {
  geoType: 'community'
  citySlug: Slug | null
  cityName: string | null
  isResort: boolean
  amenities: string[]
  hoaMonthly: Currency | null
}

export type ZipLPData = GeoLPDataBase & {
  geoType: 'zip'
  zip: string
  citiesInZip: string[]
}
