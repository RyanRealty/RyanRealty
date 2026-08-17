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

import type { ListingRow } from '@/app/actions/communities'
import type { ListingTile } from '@/lib/data'
import { v3Text, type V3FieldItem, type V3LedgerFigureRow } from '@/components/site/v3'
import { formatPublishedAsk } from '@/lib/listing/publish-listing-ask'
import { listingDetailPath } from '@/lib/slug'

/** Pins at or above this count are a map. Below it, the plat is a list. */
export const FIELD_MAP_MIN = 4

/** A Field item that is known to carry coordinates, so it can also be a pin. */
export type FieldEntry = V3FieldItem & { lat: number; lng: number }

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

/** One active single-family tile as a Field row. Null when it cannot be placed. */
export function toFieldEntry(tile: ListingTile, hasVideo: boolean): FieldEntry | null {
  if (tile.lat == null || tile.lng == null) return null
  const street = [tile.streetNumber, tile.streetName, tile.streetSuffix]
    .filter(Boolean)
    .join(' ')
    .trim()
  return {
    id: tile.listingKey,
    href: listingDetailPath(
      tile.listingKey,
      { streetNumber: tile.streetNumber, streetName: tile.streetName, city: tile.city },
      { city: tile.city, subdivision: tile.subdivisionName },
      { mlsNumber: tile.listNumber },
    ),
    priceLabel: formatPublishedAsk(tile.listPrice) ?? NO_PRICE,
    title: street || 'Listing',
    meta: metaLine(tile.beds, tile.baths, hasVideo),
    photoSrc: tile.photoUrl?.trim() || undefined,
    lat: tile.lat,
    lng: tile.lng,
  }
}

/**
 * The registry-name rows, used only when the listing-tile query returned
 * nothing. A different query, so the page hands the Field a different trace.
 */
export function fallbackFieldRows(
  rows: readonly ListingRow[],
  videoKeys: ReadonlySet<string>,
): V3FieldItem[] {
  const out: V3FieldItem[] = []
  for (const row of rows) {
    const key = row.ListingKey
    if (!key) continue
    const street = [row.StreetNumber, row.StreetName, row.StreetSuffix]
      .filter(Boolean)
      .join(' ')
      .trim()
    out.push({
      id: key,
      href: listingDetailPath(
        key,
        { streetNumber: row.StreetNumber, streetName: row.StreetName, city: row.City },
        { city: row.City, subdivision: row.SubdivisionName },
        { mlsNumber: row.ListNumber },
      ),
      priceLabel: formatPublishedAsk(row.ListPrice) ?? NO_PRICE,
      title: street || 'Listing',
      meta: metaLine(row.BedroomsTotal, row.BathroomsTotal, videoKeys.has(key)),
      photoSrc: row.PhotoURL?.trim() || undefined,
      lat: row.Latitude,
      lng: row.Longitude,
    })
  }
  return out
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
  if (input.pinCount >= FIELD_MAP_MIN) return 'field'
  return 'ledger'
}
