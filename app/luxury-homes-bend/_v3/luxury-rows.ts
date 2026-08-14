/**
 * Luxury Bend Field rows. A row earns a place when it has a price, a street,
 * and a photo. The $1.5M floor is applied by the DAL filter, not here.
 */

import type { V3FieldItem } from '@/components/site/v3'
import type { ListingTile } from '@/lib/data'
import { formatPrice } from '@/lib/format/money'
import { listingTileHref } from '@/lib/slug'

export const LUX_MIN = 1_500_000

export const LUX_COMMUNITIES = [
  { slug: 'broken-top', label: 'Broken Top' },
  { slug: 'tetherow', label: 'Tetherow' },
  { slug: 'pronghorn', label: 'Pronghorn' },
  { slug: 'awbrey-glen', label: 'Awbrey Glen' },
  { slug: 'northwest-crossing', label: 'NorthWest Crossing' },
] as const

export const LUX_TRACE =
  'live MLS through Oregon Data Share, active single-family homes in Bend with list price at or above $1,500,000'

export function luxuryFieldItems(tiles: readonly ListingTile[]): V3FieldItem[] {
  const items: V3FieldItem[] = []
  for (const tile of tiles) {
    if (tile.listPrice == null || !Number.isFinite(tile.listPrice) || tile.listPrice <= 0) continue
    const priceLabel = formatPrice(tile.listPrice)
    if (!priceLabel || !/\$/.test(priceLabel)) continue
    const photo = tile.photoUrl?.trim()
    if (!photo) continue
    const street = [tile.streetNumber, tile.streetName, tile.streetSuffix]
      .filter((part) => typeof part === 'string' && part.trim().length > 0)
      .join(' ')
      .trim()
    if (!street) continue
    const subdivision = tile.subdivisionName?.trim()
    const namedSubdivision = subdivision && !/^n\/?a$/i.test(subdivision) ? subdivision : null
    const meta = [
      tile.beds != null ? `${Math.round(tile.beds)} bd` : null,
      tile.baths != null ? `${tile.baths} ba` : null,
      tile.sqft != null ? `${tile.sqft.toLocaleString('en-US')} sqft` : null,
      namedSubdivision,
    ]
      .filter((part): part is string => part !== null && part !== '')
      .join(' · ')
    items.push({
      id: tile.listingKey,
      href: listingTileHref({
        listingKey: tile.listingKey,
        listNumber: tile.listNumber,
        streetNumber: tile.streetNumber,
        streetName: tile.streetName,
        city: tile.city,
        subdivisionName: tile.subdivisionName,
      }),
      priceLabel,
      title: street,
      photoSrc: photo,
      ...(meta ? { meta } : {}),
      lat: tile.lat,
      lng: tile.lng,
    })
  }
  return items
}
