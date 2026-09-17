/**
 * Collapse same-street duplicate cards in search results.
 *
 * listing_search_mv can surface more than one ListingKey at one street line
 * (relist / concurrent office copies). Search grids must show one card.
 * Unit-distinguished addresses keep separate street lines via
 * listingMlsStreetLine, so true multi-unit rows stay.
 */
import type { ListingTile } from '@/lib/data/types/listing'
import { listingMlsStreetLine } from '@/lib/listing/publish-street-line'

export function dedupeListingTilesByStreet<T extends ListingTile>(tiles: readonly T[]): T[] {
  const seen = new Set<string>()
  const out: T[] = []
  for (const tile of tiles) {
    const street = listingMlsStreetLine(tile).trim().toLowerCase()
    const city = (tile.city ?? '').trim().toLowerCase()
    const zip = (tile.postalCode ?? '').trim()
    const addressKey =
      street.length > 0 ? `st:${street}|${city}|${zip}` : `key:${tile.listingKey}`
    if (seen.has(addressKey) || seen.has(`key:${tile.listingKey}`)) continue
    seen.add(addressKey)
    seen.add(`key:${tile.listingKey}`)
    out.push(tile)
  }
  return out
}
