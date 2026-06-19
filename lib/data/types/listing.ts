/**
 * Listing types — the core domain object.
 *
 * `ListingTile` = compact card-shaped projection (used in grids/sliders)
 * `ListingDetail` = full detail page payload (one MV row per listing)
 */

import type { Currency, IsoTimestamp, Slug } from './shared'
import type { VideoEmbed } from './video'

export type ListingStatus =
  | 'Active'
  | 'Coming Soon'
  | 'Active Under Contract'
  | 'Pending'
  | 'Closed'
  | 'Withdrawn'
  | 'Expired'
  | 'Canceled'

export type ListingTile = {
  listingKey: string
  listNumber: string | null
  status: ListingStatus
  listPrice: Currency | null
  closePrice: Currency | null
  closeDate: IsoTimestamp | null
  beds: number | null
  baths: number | null
  sqft: number | null
  streetNumber: string | null
  streetName: string | null
  city: string | null
  citySlug: string | null
  postalCode: string | null
  subdivisionName: string | null
  subdivisionSlug: string | null
  lat: number | null
  lng: number | null
  photoUrl: string | null
  propertyType: string | null
  propertySubType: string | null
  onMarketDate: IsoTimestamp | null
  modifiedAt: IsoTimestamp | null
  pricePerSqft: number | null
  lotSizeAcres: number | null
  yearBuilt: number | null
  garageSpaces: number | null
  poolYn: boolean | null
  hasVirtualTour: boolean | null
  /** Scalar virtual-tour / video URL from listing_tile_mv (the embeddable
   *  source for inline play on a video card). Null when the listing has no
   *  tour, or when has_virtual_tour is true but the URL didn't project. */
  tourUrl: string | null
  dom: number | null
  priceDropCount: number | null
  addressSlug: Slug | null
  boundaryCity: string | null
  boundaryNeighborhood: string | null
  boundarySubdivision: string | null
}

export type ListingDetail = ListingTile & {
  // Wider listing detail fields beyond the tile projection.
  originalListPrice: Currency | null
  totalLivingAreaSqFt: number | null
  fireplaceYn: boolean | null
  waterfrontYn: boolean | null
  architecturalStyle: string | null
  newConstructionYn: boolean | null
  schoolDistrict: string | null
  elementarySchool: string | null
  middleSchool: string | null
  highSchool: string | null
  taxAnnualAmount: number | null
  taxAssessedValue: number | null
  hoaMonthly: number | null
  propertyAge: number | null
  listingQualityScore: number | null
  closePricePerSqft: number | null
  saleToListRatio: number | null
  estimatedMonthlyPiti: number | null
  // Structure / interior
  storiesTotal: number | null
  levels: string | null
  roomsTotal: number | null
  basementYn: boolean | null
  buildingAreaTotal: number | null
  heatingYn: boolean | null
  coolingYn: boolean | null
  fireplacesTotal: number | null
  spaYn: boolean | null
  // Exterior / lot
  lotSizeSqft: number | null
  lotFeatures: string | null
  fencing: string | null
  directionFaces: string | null
  viewDescription: string | null
  roof: string | null
  constructionMaterials: string | null
  foundationDetails: string | null
  propertyAttachedYn: boolean | null
  // Parking
  parkingTotal: number | null
  carportSpaces: number | null
  garageYn: boolean | null
  // Utilities
  sewer: string | null
  water: string | null
  // Financial / tax
  county: string | null
  taxYear: number | null
  parcelNumber: string | null
  associationFee: number | null
  associationFeeFrequency: string | null
  walkScore: number | null
  // Listing dates
  listDate: IsoTimestamp | null
  cumulativeDaysOnMarket: number | null
  // Listing-detail-specific
  photos: ListingPhoto[]
  videos: VideoEmbed[]
  listAgentName: string | null
  listAgentEmail: string | null
  listAgentPhone: string | null
  listOfficeName: string | null
  publicRemarks: string | null
  // Community context
  communityId: string | null
  communityName: string | null
  communitySlug: Slug | null
  neighborhoodName: string | null
  neighborhoodSlug: Slug | null
  refreshedAt: IsoTimestamp
}

export type ListingPhoto = {
  url: string
  caption?: string | null
  order: number
  width?: number | null
  height?: number | null
}

export type ListingFilters = {
  minPrice?: number
  maxPrice?: number
  minBeds?: number
  minBaths?: number
  minSqft?: number
  status?: ListingStatus[]
  propertyType?: string[]
  subdivision?: string[]
  hasOpenHouse?: boolean
  hasVideo?: boolean
  hasVirtualTour?: boolean
}

export type SearchResult = {
  items: ListingTile[]
  totalCount: number
  query: string
}
