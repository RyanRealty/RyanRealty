/**
 * Tile -> V3FieldItem for the homepage inventory Field.
 *
 * Same honesty as app/cities/[slug]/_v3/city-field-items.ts: a tile earns a row
 * when it carries a price and an address. formatPrice(null) is a placeholder,
 * not a figure, so those tiles are dropped. The Field's count still states the
 * region total from its own pulse query.
 */

import type { V3FieldItem } from '@/components/site/v3'
import type { ListingTile } from '@/lib/data/types/listing'
import { listingDetailPath } from '@/lib/slug'
import { livePrice } from './live-format'

export function homeFieldItems(tiles: readonly ListingTile[], limit: number): V3FieldItem[] {
  const items: V3FieldItem[] = []

  for (const tile of tiles) {
    if (items.length >= limit) break
    const priceLabel = livePrice(tile.listPrice)
    if (!priceLabel) continue

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
      priceLabel,
      title: street,
      ...(meta ? { meta } : {}),
      lat: tile.lat,
      lng: tile.lng,
    })
  }

  return items
}
