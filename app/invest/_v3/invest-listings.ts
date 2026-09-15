/**
 * Live income-property tiles for /invest — price, address, beds/baths/sqft.
 *
 * The Pulse and the segment table count types. This module names houses.
 * A tile without a publishable price or a street is dropped, not guessed.
 * Land rows carry acres instead of beds when the feed has no rooms.
 */
import type { ListingTile } from '@/lib/data/types/listing'
import { formatPriceExact } from '@/lib/format/money'
import { publishStreetLine } from '@/lib/listing/publish-street-line'
import { listingTileHref } from '@/lib/slug'

export type InvestListingRow = {
  listingKey: string
  href: string
  address: string
  city: string
  price: string
  beds: string | null
  baths: string | null
  size: string | null
  typeLabel: string
}

const TYPE_BY_CODE: Record<string, string> = {
  C: 'Multi-family',
  D: 'Lot',
  E: 'Farm',
  F: 'Commercial',
  H: 'Business',
}

const PER_TYPE = 1
const CAP = 4

export function investTypeLabel(tile: ListingTile): string {
  const code = String(tile.propertyType ?? '').toUpperCase()
  const fromCode = TYPE_BY_CODE[code]
  if (fromCode) return fromCode
  const sub = tile.propertySubType?.trim()
  return sub || 'Income property'
}

function qualify(tile: ListingTile): boolean {
  if (tile.listPrice == null || !Number.isFinite(tile.listPrice) || tile.listPrice <= 0) {
    return false
  }
  return Boolean(
    publishStreetLine({
      streetNumber: tile.streetNumber,
      streetDirPrefix: tile.streetDirPrefix,
      streetName: tile.streetName,
      streetSuffix: tile.streetSuffix,
      streetDirSuffix: tile.streetDirSuffix,
    }),
  )
}

function sizeBit(tile: ListingTile): string | null {
  if (tile.sqft != null && tile.sqft > 0) {
    return `${Math.round(tile.sqft).toLocaleString('en-US')} sqft`
  }
  if (tile.lotSizeAcres != null && tile.lotSizeAcres > 0) {
    const acres = tile.lotSizeAcres
    const label = acres >= 10 ? acres.toFixed(0) : acres.toFixed(2)
    return `${label} acres`
  }
  return null
}

function toRow(tile: ListingTile): InvestListingRow | null {
  if (!qualify(tile)) return null
  const street = publishStreetLine({
    streetNumber: tile.streetNumber,
    streetDirPrefix: tile.streetDirPrefix,
    streetName: tile.streetName,
    streetSuffix: tile.streetSuffix,
    streetDirSuffix: tile.streetDirSuffix,
  })
  if (!street) return null
  return {
    listingKey: tile.listingKey,
    href: listingTileHref(tile),
    address: street,
    city: tile.city?.trim() || 'Central Oregon',
    price: formatPriceExact(tile.listPrice),
    beds: tile.beds != null && tile.beds > 0 ? `${Math.round(tile.beds)} bd` : null,
    baths: tile.baths != null && tile.baths > 0 ? `${Math.round(tile.baths * 10) / 10} ba` : null,
    size: sizeBit(tile),
    typeLabel: investTypeLabel(tile),
  }
}

/**
 * One newest publishable tile from each type bucket, cap 4. A scrolling
 * twelve-row list is not catalog craft (Mini 0c7efd619). A bucket that
 * sent nothing is skipped.
 */
export function composeInvestListings(buckets: readonly (readonly ListingTile[])[]): InvestListingRow[] {
  const queues = buckets.map((bucket) => bucket.filter(qualify).map(toRow).filter((row): row is InvestListingRow => row != null).slice(0, PER_TYPE))
  const out: InvestListingRow[] = []
  const seen = new Set<string>()
  let added = true
  while (added && out.length < CAP) {
    added = false
    for (const queue of queues) {
      const next = queue.shift()
      if (!next || seen.has(next.listingKey)) continue
      seen.add(next.listingKey)
      out.push(next)
      added = true
      if (out.length >= CAP) break
    }
  }
  return out
}

export function investListingFacts(row: InvestListingRow): string {
  return [row.typeLabel, row.beds, row.baths, row.size].filter(Boolean).join(' · ')
}
