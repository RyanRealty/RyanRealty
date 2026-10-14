/**
 * Listing Open Graph title + image helpers.
 *
 * Social cards are not the SERP document title. The document title stays
 * address-first and budgeted (listingDocumentTitle). The share title is
 * address · price · beds/baths, and the image is the listing's own hero
 * photo — never the default aerial — unless that listing has no photo.
 */

import { listingMlsAddressFull, listingMlsStreetLine } from '@/lib/listing/publish-street-line'
import { publishMoneyText } from '@/lib/listing/publish-listing-figure'
import {
  publishListingPublishedWholePropertyPrice,
  publishListingStatusWord,
} from '@/lib/listing/publish-listing-published-price'
import { shareOgImagePath, shortOgTitle } from '@/lib/og/share-image-url'

export type ListingShareFields = {
  listingKey: string
  listNumber?: string | null
  status?: string | null
  listPrice?: number | null
  closePrice?: number | null
  propertyType?: string | null
  propertySubType?: string | null
  subdivisionName?: string | null
  city?: string | null
  postalCode?: string | null
  streetNumber?: string | number | null
  streetDirPrefix?: string | null
  streetName?: string | null
  streetSuffix?: string | null
  streetDirSuffix?: string | null
  beds?: number | null
  baths?: number | null
  photoUrl?: string | null
}

function roomFact(count: number | null | undefined, noun: string): string | null {
  if (typeof count !== 'number' || !Number.isFinite(count) || count <= 0) return null
  return `${count} ${noun}`
}

function publishedPriceText(listing: ListingShareFields): string | null {
  const price = publishListingPublishedWholePropertyPrice({
    status: listing.status,
    listPrice: listing.listPrice,
    closePrice: listing.closePrice,
    propertyType: listing.propertyType,
    propertySubType: listing.propertySubType,
    subdivisionName: listing.subdivisionName,
    city: listing.city,
    listNumber: listing.listNumber,
  })
  return publishMoneyText(price, 'exact')
}

function bedBathFacts(listing: Pick<ListingShareFields, 'beds' | 'baths'>): string | null {
  const facts = [roomFact(listing.beds, 'bed'), roomFact(listing.baths, 'bath')].filter(
    (part): part is string => Boolean(part),
  )
  return facts.length > 0 ? facts.join(', ') : null
}

/** Social og:title — address · price · beds/baths. Status first when the home is off market. */
export function listingShareOgTitle(
  listing: ListingShareFields & { addressTitle?: string | null },
): string {
  const address =
    listing.addressTitle?.trim() ||
    listingMlsAddressFull(listing) ||
    listingMlsStreetLine(listing) ||
    listing.city?.trim() ||
    'Home'
  const parts = [
    publishListingStatusWord(listing.status),
    address,
    publishedPriceText(listing),
    bedBathFacts(listing),
  ].filter((part): part is string => Boolean(part))
  return parts.join(' · ')
}

/** Card lines: street on the headline, price + rooms on the second line. */
export function listingShareCardLines(listing: ListingShareFields): {
  title: string
  subtitle: string
} {
  const street = listingMlsStreetLine(listing) || listing.city?.trim() || 'Home for sale'
  const subtitle = [publishedPriceText(listing), bedBathFacts(listing)]
    .filter((part): part is string => Boolean(part))
    .join(' · ')
  return {
    title: shortOgTitle(street, 42) || street,
    subtitle,
  }
}

/** True when this listing may put its own hero on a share card. */
export function listingHasSharePhoto(photoUrl: string | null | undefined): boolean {
  return Boolean(photoUrl?.trim())
}

/**
 * Root-relative listing card path, or undefined so pageMetadata falls back to
 * the default aerial only when the listing has no photo.
 */
export function listingOgImagePath(listing: Pick<ListingShareFields, 'listingKey' | 'photoUrl'>): string | undefined {
  if (!listingHasSharePhoto(listing.photoUrl)) return undefined
  return shareOgImagePath({ type: 'listing', id: listing.listingKey })
}
