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
import { formatPrice } from '@/lib/format/money'
import { listingDetailPath } from '@/lib/slug'

/**
 * A tile earns a row when it carries a price and an address. Both are the row's
 * visible text: `priceLabel` is the figure and `title` is what the row is known
 * by, and V3FieldItem types neither as optional. A tile with no list price would
 * render `formatPrice(null)`, which is a lone em dash standing where a figure
 * should be; a tile with no street would render an anonymous row. Dropping is
 * the honest answer to both, and the Field's count above the frame still states
 * the real total from its own query.
 *
 * Photographs are required: V3Field's mosaic only opens when enough rows carry
 * `photoSrc`, and a house with no photo cannot be the first-screenful door.
 */
export function cityFieldItems(tiles: readonly ListingTile[], limit: number): V3FieldItem[] {
  const items: V3FieldItem[] = []

  for (const tile of tiles) {
    if (items.length >= limit) break
    if (tile.listPrice == null || !Number.isFinite(tile.listPrice) || tile.listPrice <= 0) continue
    if (!tile.photoUrl || tile.photoUrl.trim().length === 0) continue

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

    items.push({
      id: tile.listingKey,
      href: listingDetailPath(
        tile.listingKey,
        { streetNumber: tile.streetNumber, streetName: tile.streetName, city: tile.city },
        { city: tile.city, subdivision: tile.subdivisionName },
        { mlsNumber: tile.listNumber },
      ),
      priceLabel: formatPrice(tile.listPrice),
      title: street,
      photoSrc: tile.photoUrl,
      ...(meta ? { meta } : {}),
      lat: tile.lat,
      lng: tile.lng,
    })
  }

  return items
}
