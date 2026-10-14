/**
 * Listing Open Graph title + image helpers.
 *
 * Social cards are not the SERP document title. The document title stays
 * address-first and budgeted (listingDocumentTitle). The share title is
 * address · price · beds/baths. The image is the listing's own hero photo,
 * or the curated landscape fallback — never a photo-less card.
 */

import { listingMlsAddressFull, listingMlsStreetLine } from '@/lib/listing/publish-street-line'
import { publishMoneyText } from '@/lib/listing/publish-listing-figure'
import {
  publishListingPublishedWholePropertyPrice,
  publishListingStatusWord,
} from '@/lib/listing/publish-listing-published-price'
import { shareOgImagePath } from '@/lib/og/share-image-url'

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

/** True when this listing may put its own hero on a share card. */
export function listingHasSharePhoto(photoUrl: string | null | undefined): boolean {
  return Boolean(photoUrl?.trim())
}

/**
 * Small price · beds/baths chip on the listing card. Address stays in
 * og:title (the preview bar). Skip when there is nothing to print, or
 * when the line would be too long to stay a chip.
 */
const LISTING_CHIP_MAX = 36

export function listingShareChip(listing: ListingShareFields): string | undefined {
  const parts = [publishedPriceText(listing), bedBathFacts(listing)].filter(
    (part): part is string => Boolean(part),
  )
  if (parts.length === 0) return undefined
  const chip = parts.join(' · ')
  return chip.length <= LISTING_CHIP_MAX ? chip : undefined
}

/**
 * Root-relative listing card path. Always the listing type so the image is
 * the MLS hero, or the landscape fallback — never the generic default card.
 */
export function listingOgImagePath(listing: Pick<ListingShareFields, 'listingKey'>): string {
  return shareOgImagePath({ type: 'listing', id: listing.listingKey })
}
