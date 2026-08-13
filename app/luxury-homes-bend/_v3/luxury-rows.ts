/**
 * Luxury Bend listing rows. A row earns a place when it has a price, a street,
 * and a photo. The $1.5M floor is applied by the DAL filter, not here.
 */

import type { V3LedgerFigureRow } from '@/components/site/v3'
import { v3Text } from '@/components/site/v3'
import type { ListingTile } from '@/lib/data'
import { listingTileHref } from '@/lib/slug'
import { livePrice } from '@/app/_v3/live-format'

export const LUX_MIN = 1_500_000

export const LUX_COMMUNITIES = [
  { slug: 'broken-top', label: 'Broken Top' },
  { slug: 'tetherow', label: 'Tetherow' },
  { slug: 'pronghorn', label: 'Pronghorn' },
  { slug: 'awbrey-glen', label: 'Awbrey Glen' },
  { slug: 'northwest-crossing', label: 'NorthWest Crossing' },
] as const

export function luxuryRows(tiles: readonly ListingTile[]): V3LedgerFigureRow[] {
  const rows: V3LedgerFigureRow[] = []
  for (const tile of tiles) {
    const price = livePrice(tile.listPrice)
    if (!price) continue
    const photo = tile.photoUrl?.trim()
    if (!photo) continue
    const street = [tile.streetNumber, tile.streetName, tile.streetSuffix]
      .filter((part) => typeof part === 'string' && part.trim().length > 0)
      .join(' ')
      .trim()
    if (!street) continue
    const meta = [
      tile.beds != null ? `${Math.round(tile.beds)} bd` : null,
      tile.baths != null ? `${tile.baths} ba` : null,
      tile.sqft != null ? `${tile.sqft.toLocaleString('en-US')} sqft` : null,
    ]
      .filter((part): part is string => part !== null)
      .join(' · ')
    const sub = tile.subdivisionName?.trim()
    rows.push({
      href: listingTileHref({
        listingKey: tile.listingKey,
        listNumber: tile.listNumber,
        streetNumber: tile.streetNumber,
        streetName: tile.streetName,
        city: tile.city,
        subdivisionName: tile.subdivisionName,
      }),
      when: v3Text(sub || 'Bend'),
      what: v3Text(street),
      detail: meta ? v3Text(meta) : undefined,
      value: v3Text(price),
      id: tile.listingKey,
      media: { src: photo },
    })
  }
  return rows
}
