/**
 * The newest Bend listings as listing-dial rows for /buy/alerts: what the
 * alert would have sent this week, drawn the way every set of listings on the
 * site is drawn (PUBLIC_UI.md, the listing dial).
 *
 * Honesty: a tile earns a card when it has a price, a street and a live MLS
 * photo, the same bar the homepage shelves hold (app/_v3/home-rail-items.ts).
 * Badges come only from publishListingCardBadges. Nothing here invents a
 * figure; the count label the page prints is the length of this list.
 */
import type { V3ListingDialItem, V3ListingRowBadge } from '@/components/site/v3'
import type { ListingTile } from '@/lib/data/types/listing'
import { publishListingCardBadges } from '@/lib/listing/publish-listing-card-badges'
import { listingPriceIsLeaseRate } from '@/lib/listing/publish-listing-figure'
import { publishListingTourLabel } from '@/lib/listing/publish-listing-hero-video'
import { publicCardStatusLabel } from '@/lib/listing-status-public'
import { publishCardAddress, publishStreetLine } from '@/lib/listing/publish-street-line'
import { LISTING_FIELD_LEAD_PHOTO_SIZE, listingRowPhotoSrc } from '@/lib/listing/row-photo'
import { listingTileHref } from '@/lib/slug'

/** The MLS single-family sub type (CLAUDE.md §0: SFR is the sub type, not bare 'A'). */
export const BUY_ALERTS_DIAL_SUB_TYPE = 'Single Family Residence'
export const BUY_ALERTS_DIAL_LIMIT = 12

function photographedPriced(tile: ListingTile): boolean {
  if (tile.listPrice == null || !Number.isFinite(tile.listPrice) || tile.listPrice <= 0) return false
  if (!tile.photoUrl || tile.photoUrl.trim().length === 0) return false
  if (listingPriceIsLeaseRate(tile.propertyType)) return false
  return true
}

export function buyAlertsDialItems(
  tiles: readonly ListingTile[],
  nowMs: number,
  limit: number = BUY_ALERTS_DIAL_LIMIT,
): V3ListingDialItem[] {
  const out: V3ListingDialItem[] = []
  const seen = new Set<string>()
  for (const tile of tiles) {
    if (out.length >= limit) break
    if (seen.has(tile.listingKey)) continue
    if (!photographedPriced(tile)) continue
    const street = publishStreetLine({
      streetNumber: tile.streetNumber,
      streetName: tile.streetName,
      streetSuffix: tile.streetSuffix,
    })
    if (!street) continue
    seen.add(tile.listingKey)

    const badges = publishListingCardBadges({
      nowMs,
      standardStatus: tile.status,
      onMarketDate: tile.onMarketDate,
      listPrice: tile.listPrice,
      hasVirtualTour: tile.hasVirtualTour,
      hasTourUrl: Boolean(tile.tourUrl),
    }) as Array<{ kind: V3ListingRowBadge; label: string }>

    const cityLine = [tile.city?.trim(), tile.postalCode?.trim()].filter(Boolean).join(' ')
    const tourUrl = tile.tourUrl?.trim() || null

    out.push({
      listingKey: tile.listingKey,
      href: listingTileHref(tile),
      photoUrl: listingRowPhotoSrc(tile.photoUrl!.trim(), LISTING_FIELD_LEAD_PHOTO_SIZE),
      price: tile.listPrice,
      addressLine: street,
      cityLine:
        cityLine ||
        publishCardAddress({
          streetNumber: tile.streetNumber,
          streetName: tile.streetName,
          streetSuffix: tile.streetSuffix,
          city: tile.city,
        }),
      beds: tile.beds,
      baths: tile.baths,
      sqft: tile.sqft,
      pricePerSqft: tile.pricePerSqft,
      propertyType: tile.propertyType,
      propertySubType: tile.propertySubType,
      subdivisionName: tile.subdivisionName,
      city: tile.city,
      listNumber: tile.listNumber,
      tourUrl,
      hasTour: tile.hasVirtualTour === true || Boolean(tourUrl),
      tourLabel: publishListingTourLabel(tourUrl),
      badges,
      statusLabel: publicCardStatusLabel(tile.status),
      standardStatus: tile.status,
      hasVideo: null,
    })
  }
  return out
}
