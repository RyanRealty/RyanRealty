/**
 * Tile -> V3FieldItem, for the city node's inventory Field.
 *
 * The barrel formats nothing (components/site/v3/index.ts: "no primitive here
 * fetches, formats, rounds, or parses a date"), so the price string and the
 * supporting line are built here, through lib/format, and handed over finished.
 * That is what keeps the figure on screen the figure the Field's source trace
 * covers (CLAUDE.md section 0).
 *
 * The destination is `listingDetailPath`, the same canonical helper the retired
 * dual-pane list used, so a row still opens the listing at the same URL.
 */

import type { V3FieldItem } from '@/components/site/v3'
import type { ListingTile } from '@/lib/data/types/listing'
import { formatPublishedAsk } from '@/lib/listing/publish-listing-ask'
import { listingDetailPath } from '@/lib/slug'

/**
 * A tile earns a row when it carries a price and an address. Both are the row's
 * visible text: `priceLabel` is the figure and `title` is what the row is known
 * by, and V3FieldItem types neither as optional. A tile with no list price would
 * render a lone em dash standing where a figure
 * should be; a tile with no street would render an anonymous row. Dropping is
 * the honest answer to both, and the Field's count above the frame still states
 * the real total from its own query.
 *
 * A photograph is optional. The city opening is one Field (map + list of the
 * same set). A home with no photo is still listed and, when it has coordinates,
 * plotted. Dropping it to force a mosaic would make the caption count a
 * different population from the pins.
 */
export function cityFieldItems(tiles: readonly ListingTile[], limit?: number): V3FieldItem[] {
  const items: V3FieldItem[] = []
  const cap = limit ?? Number.POSITIVE_INFINITY

  for (const tile of tiles) {
    if (items.length >= cap) break
    if (tile.listPrice == null || !Number.isFinite(tile.listPrice) || tile.listPrice <= 0) continue

    const street = [tile.streetNumber, tile.streetName, tile.streetSuffix]
      .filter((part) => typeof part === 'string' && part.trim().length > 0)
      .join(' ')
      .trim()
    if (!street) continue

    const meta = [
      tile.beds != null ? `${tile.beds} bd` : null,
      tile.baths != null ? `${tile.baths} ba` : null,
      tile.sqft != null ? `${tile.sqft.toLocaleString('en-US')} sqft` : null,
    ]
      .filter((part): part is string => part !== null)
      .join(' · ')

    const photo = tile.photoUrl?.trim()

    items.push({
      id: tile.listingKey,
      href: listingDetailPath(
        tile.listingKey,
        { streetNumber: tile.streetNumber, streetName: tile.streetName, city: tile.city },
        { city: tile.city, subdivision: tile.subdivisionName },
        { mlsNumber: tile.listNumber },
      ),
      priceLabel: formatPublishedAsk(tile.listPrice) ?? 'Price on request',
      title: street,
      ...(photo ? { photoSrc: photo } : {}),
      ...(meta ? { meta } : {}),
      lat: tile.lat,
      lng: tile.lng,
    })
  }

  return items
}
