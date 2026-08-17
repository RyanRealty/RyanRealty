/**
 * Map verified listing tiles onto the blog related-homes Ledger.
 * Prices go through formatPublishedAsk (exact ListPrice). Rows without a
 * street or an ask are dropped — v3Text throws on blank.
 */
import { v3Text, type V3LedgerFigureRow } from '@/components/site/v3'
import { formatPublishedAsk } from '@/lib/listing/publish-listing-ask'
import { listingTileHref } from '@/lib/slug'
import type { ListingTile } from '@/lib/data/types/listing'

function streetLine(tile: ListingTile): string {
  return [tile.streetNumber, tile.streetName, tile.streetSuffix].filter(Boolean).join(' ').trim()
}

export function blogRelatedHomeRows(tiles: readonly ListingTile[]): V3LedgerFigureRow[] {
  const rows: V3LedgerFigureRow[] = []
  for (const tile of tiles) {
    const street = streetLine(tile)
    if (!street) continue
    const price = formatPublishedAsk(tile.listPrice)
    if (!price) continue
    const beds = tile.beds != null ? `${tile.beds} bed` : null
    const baths = tile.baths != null ? `${tile.baths} bath` : null
    const sqft = tile.sqft != null ? `${tile.sqft.toLocaleString('en-US')} sq ft` : null
    const detail = [beds, baths, sqft].filter((part) => part).join(' · ')
    const city = tile.city?.trim()
    rows.push({
      what: v3Text(street),
      value: v3Text(price),
      href: listingTileHref(tile),
      when: v3Text(city || 'For sale'),
      detail: detail ? v3Text(detail) : undefined,
      media: tile.photoUrl ? { src: tile.photoUrl } : undefined,
      id: tile.listingKey,
    })
  }
  return rows
}
