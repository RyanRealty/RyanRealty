import type { ListingTile } from '@/lib/data'
import { formatPrice } from '@/lib/format/money'
import { displaySubdivision, listingTileHref } from '@/lib/slug'
import { v3Text, type V3LedgerPlainRow } from '@/components/site/v3'

/**
 * One Ledger row for a home on a private Saved surface.
 *
 * Plain rows (no value column): a missing list price is not printed as a
 * figure under a live-MLS trace. When a price exists it rides in detail
 * next to beds and baths, already formatted at this call site.
 */
export function tileToSavedLedgerRow(tile: ListingTile): V3LedgerPlainRow | null {
  const address = [tile.streetNumber, tile.streetName, tile.streetSuffix]
    .filter(Boolean)
    .join(' ')
    .trim()
  const city = tile.city?.trim() ?? ''
  const what = address || city
  if (!what) return null

  const subdivision = displaySubdivision(tile.subdivisionName)
  const when = (subdivision || city || 'Listing').trim()
  if (!when) return null

  const priceLabel =
    tile.listPrice != null && Number.isFinite(tile.listPrice) && tile.listPrice > 0
      ? formatPrice(tile.listPrice)
      : ''
  const meta = [
    tile.beds != null ? `${tile.beds} bd` : null,
    tile.baths != null ? `${tile.baths} ba` : null,
    tile.sqft != null ? `${tile.sqft.toLocaleString('en-US')} sqft` : null,
    priceLabel || null,
  ]
    .filter((part): part is string => Boolean(part))
    .join(' · ')

  const photo = tile.photoUrl?.trim()
  const id = (tile.listingKey || tile.listNumber || what).toString().trim()
  if (!id) return null

  return {
    href: listingTileHref(tile),
    when: v3Text(when),
    what: v3Text(what),
    detail: meta ? v3Text(meta) : undefined,
    id,
    media: photo ? { src: photo } : undefined,
  }
}

export function tileLabel(tile: ListingTile): string {
  const address = [tile.streetNumber, tile.streetName, tile.streetSuffix]
    .filter(Boolean)
    .join(' ')
    .trim()
  return address || tile.city?.trim() || 'Listing'
}
