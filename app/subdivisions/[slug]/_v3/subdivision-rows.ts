/**
 * Field rows and map pins for the plat node, built ONCE.
 *
 * A V3Field binds a row to its pin by a shared id, so a row and a pin that were
 * built by two different mappers can disagree about that id, about the door they
 * open, or about the price they print. One mapper removes the possibility.
 *
 * NOTHING HERE FETCHES OR ROUNDS ON ITS OWN. Listing cards print the exact
 * ListPrice through `formatPublishedAsk` (same string as the listing H1).
 *
 * A listing with no coordinates is dropped rather than placed at a guessed
 * point. That matches what the KB dual-pane listed and keeps the map honest.
 */

import type { ListingTile } from '@/lib/data'
import { v3Text, type V3FieldItem, type V3LedgerFigureRow } from '@/components/site/v3'
import { formatPublishedAsk } from '@/lib/listing/publish-listing-ask'
import { publishCardAddress, publishStreetLine } from '@/lib/listing/publish-street-line'
import { listingDetailPath } from '@/lib/slug'

/** Pins at or above this count are a map. Below it, the plat is a list. */
export const FIELD_MAP_MIN = 4

/** A Field item. Coordinates are optional so a home without pins still lists. */
export type FieldEntry = V3FieldItem & { lat?: number; lng?: number }

/** What a listing with no published price says instead of printing a zero. */
const NO_PRICE = 'Price not published'

function metaLine(
  beds: number | null | undefined,
  baths: number | null | undefined,
  hasVideo: boolean,
): string | undefined {
  const bits = [
    beds == null ? null : `${beds} bd`,
    baths == null ? null : `${baths} ba`,
    hasVideo ? 'Video tour' : null,
  ].filter(Boolean)
  return bits.length > 0 ? bits.join(' · ') : undefined
}

/** One active single-family tile as a Field row. Null only when the key is missing. */
export function toFieldEntry(tile: ListingTile, hasVideo: boolean): FieldEntry | null {
  if (!tile.listingKey) return null
  const street = publishStreetLine({
    streetNumber: tile.streetNumber,
    streetName: tile.streetName,
    streetSuffix: tile.streetSuffix,
  })
  return {
    id: tile.listingKey,
    href: listingDetailPath(
      tile.listingKey,
      { streetNumber: tile.streetNumber, streetName: tile.streetName, city: tile.city },
      { city: tile.city, subdivision: tile.subdivisionName },
      { mlsNumber: tile.listNumber },
    ),
    priceLabel: formatPublishedAsk(tile.listPrice) ?? NO_PRICE,
    // Every card names its city (Matt 2026-08-27): cards travel — open
    // houses, trails, price drops, saved-search alerts — so a bare street
    // line made the reader guess. Applied here too, even though the page is
    // already plat-scoped: consistency beats brevity.
    title:
      publishCardAddress({
        streetNumber: tile.streetNumber,
        streetName: tile.streetName,
        streetSuffix: tile.streetSuffix,
        city: tile.city,
      }) ||
      street ||
      'Listing',
    meta: metaLine(tile.beds, tile.baths, hasVideo),
    photoSrc: tile.photoUrl?.trim() || undefined,
    ...(tile.lat != null && tile.lng != null ? { lat: tile.lat, lng: tile.lng } : {}),
    cat: 0,
  }
}

export function toLedgerRows(items: readonly V3FieldItem[]): V3LedgerFigureRow[] {
  return items.flatMap((item) => {
    if (!item.href || !item.title) return []
    return [
      {
        href: item.href,
        when: v3Text(item.meta?.trim() || 'For sale'),
        what: v3Text(item.title),
        value: v3Text(item.priceLabel),
        id: item.id,
        ...(item.photoSrc ? { media: { src: item.photoSrc } } : {}),
      },
    ]
  })
}

export function platHomesMode(input: {
  activeCount: number | null
  homeRows: number
  pinCount: number
}): 'unknown' | 'empty' | 'field' | 'ledger' {
  if (input.activeCount == null) return 'unknown'
  if (input.activeCount === 0 || input.homeRows === 0) return 'empty'
  if (input.homeRows > 0) return 'field'
  return 'ledger'
}
