/**
 * What listing-detail client islands actually need. Passing the full listing
 * row, broker bios/signatures, or 50 review texts into 'use client' trees is
 * what bloated the RSC flight payload (~950 KB HTML on a Bend house URL).
 */
import type { ListingDetail, ListingPhoto } from '@/lib/data/types/listing'
import type { Broker } from '@/lib/data/types/broker'
import type { ReviewsSummary } from '@/lib/data/reviews/getReviews'

export type PriceCtaListing = Pick<
  ListingDetail,
  | 'listingKey'
  | 'listNumber'
  | 'onMarketDate'
  | 'listPrice'
  | 'closePrice'
  | 'closeDate'
  | 'status'
  | 'dom'
  | 'pricePerSqft'
  | 'propertySubType'
  | 'propertyType'
  | 'streetNumber'
  | 'streetDirPrefix'
  | 'streetName'
  | 'streetSuffix'
  | 'streetDirSuffix'
  | 'city'
  | 'postalCode'
  | 'subdivisionName'
  | 'originalListPrice'
  | 'priceDropCount'
  | 'beds'
  | 'baths'
  | 'sqft'
  | 'totalLivingAreaSqFt'
  | 'lotSizeAcres'
  | 'taxAnnualAmount'
  | 'hoaMonthly'
  | 'listAgentName'
  | 'listOfficeName'
  | 'listAgentPhone'
  | 'listOfficePhone'
  | 'lat'
  | 'lng'
>

export type SlimHistoryRow = {
  event?: string | null
  event_date?: string | null
  price?: number | null
  price_change?: number | null
}

export function pickPriceCtaListing(listing: ListingDetail): PriceCtaListing {
  return {
    listingKey: listing.listingKey,
    listNumber: listing.listNumber,
    onMarketDate: listing.onMarketDate,
    listPrice: listing.listPrice,
    closePrice: listing.closePrice,
    closeDate: listing.closeDate,
    status: listing.status,
    dom: listing.dom,
    pricePerSqft: listing.pricePerSqft,
    propertySubType: listing.propertySubType,
    propertyType: listing.propertyType,
    streetNumber: listing.streetNumber,
    streetDirPrefix: listing.streetDirPrefix ?? null,
    streetName: listing.streetName,
    streetSuffix: listing.streetSuffix,
    streetDirSuffix: listing.streetDirSuffix ?? null,
    city: listing.city,
    postalCode: listing.postalCode,
    subdivisionName: listing.subdivisionName,
    originalListPrice: listing.originalListPrice,
    priceDropCount: listing.priceDropCount,
    beds: listing.beds,
    baths: listing.baths,
    sqft: listing.sqft,
    totalLivingAreaSqFt: listing.totalLivingAreaSqFt,
    lotSizeAcres: listing.lotSizeAcres,
    taxAnnualAmount: listing.taxAnnualAmount,
    hoaMonthly: listing.hoaMonthly,
    listAgentName: listing.listAgentName,
    listOfficeName: listing.listOfficeName,
    listAgentPhone: listing.listAgentPhone,
    listOfficePhone: listing.listOfficePhone,
    lat: listing.lat,
    lng: listing.lng,
  }
}

export function slimListingMedia(photos: readonly ListingPhoto[]): ListingPhoto[] {
  return photos.map((photo) => ({
    url: photo.url,
    caption: photo.caption ?? null,
    order: photo.order,
  }))
}

export function slimListingHistory(rows: readonly SlimHistoryRow[]): SlimHistoryRow[] {
  return rows.map((row) => ({
    event: row.event ?? null,
    event_date: row.event_date ?? null,
    price: row.price ?? null,
    price_change: row.price_change ?? null,
  }))
}

/** Contact-card fields only. Bios and Gmail signatures are kilobytes each. */
export function slimPublicBroker(broker: Broker): Broker {
  return {
    slug: broker.slug,
    fullName: broker.fullName,
    title: broker.title,
    email: broker.email,
    phoneDirect: broker.phoneDirect,
    phoneFub: broker.phoneFub,
    headshotPng: broker.headshotPng,
    headshotJpg: broker.headshotJpg,
    licenseNumber: broker.licenseNumber,
    bio: null,
    isPrincipal: broker.isPrincipal,
    emailSignature: null,
    gmailSignatureHtml: null,
    gmailSignatureSyncedAt: null,
    tagline: null,
    specialties: undefined,
    designations: undefined,
    yearsExperience: null,
    photoUrl: null,
    reviews: undefined,
    social: undefined,
    introVideoUrl: null,
  }
}

export function slimListingReviews(reviews: ReviewsSummary | null): ReviewsSummary | null {
  if (!reviews) return null
  const first = reviews.reviews[0]
  return {
    count: reviews.count,
    averageRating: reviews.averageRating,
    source: reviews.source,
    reviews: first ? [first] : [],
  }
}
