/**
 * COMMERCIAL SPACE FOR LEASE on a place page (Matt 2026-09-23).
 *
 * A commercial lease (MLS PropertyType 'G') is not for sale: its ListPrice is
 * rent. Every for-sale list and count on a place page drops it
 * (placeStockIsForSale, place-child-stock, the map pins, the type cards, the
 * rails and their ItemList). This module is the other half: the same live
 * tiles the page already read, the leases among them, as their own section
 * AFTER "Commercial property", counted "N for lease" and never "for sale".
 *
 * Each lease row carries the feed's own rent unit (getLeaseRateOptions), and
 * the card prints publishListingLeaseFigure: the rate with its unit, or "Lease
 * rate not published". A place with no active lease gets null and no section.
 */
import { getLeaseRateOptions, type LeaseRateOptionsByKey, type ListingTile } from '@/lib/data'
import type { V3ListingRowData } from '@/components/site/v3/V3ListingRow'
import { formatCount } from '@/lib/format/count'
import { listingPriceIsLeaseRate } from '@/lib/listing/publish-listing-figure'
import { withTimeoutFallback } from '@/lib/with-timeout-fallback'
import { placeStockRowFromTile } from '@/lib/place/place-inventory-stock'
import { PLACE_LEASE_HEADING } from '@/lib/place/place-lease-heading'

export { PLACE_LEASE_HEADING }

export type PlaceLeaseSection = {
  key: 'lease'
  heading: string
  /** "3 for lease". A lease is never counted "for sale". */
  countLabel: string
  rows: V3ListingRowData[]
}

/** The commercial leases among a place's live tiles, each once, in the order given. */
export function placeLeaseTiles(tiles: readonly ListingTile[]): ListingTile[] {
  const seen = new Set<string>()
  const out: ListingTile[] = []
  for (const tile of tiles) {
    if (!tile.listingKey || seen.has(tile.listingKey)) continue
    if (!listingPriceIsLeaseRate(tile.propertyType)) continue
    seen.add(tile.listingKey)
    out.push(tile)
  }
  return out
}

/** One lease tile as a card row, carrying its rent unit (null when the feed gives none). */
export function placeLeaseRowFromTile(
  tile: ListingTile,
  rateOptions: Readonly<LeaseRateOptionsByKey>,
): V3ListingRowData | null {
  const row = placeStockRowFromTile(tile)
  if (!row) return null
  return { ...row, leaseRateOption: rateOptions[tile.listingKey] ?? null }
}

/**
 * The lease section for a place, or null when it has no active lease. Pure:
 * the page passes the tiles it already read and the units it looked up.
 */
export function placeLeaseSectionFromTiles(
  tiles: readonly ListingTile[],
  rateOptions: Readonly<LeaseRateOptionsByKey>,
): PlaceLeaseSection | null {
  const rows = placeLeaseTiles(tiles).flatMap((tile) => {
    const row = placeLeaseRowFromTile(tile, rateOptions)
    return row ? [row] : []
  })
  if (rows.length === 0) return null
  return {
    key: 'lease',
    heading: PLACE_LEASE_HEADING,
    countLabel: `${formatCount(rows.length)} for lease`,
    rows,
  }
}

/**
 * Read the rent units for a place's leases and build the section. Reads
 * nothing when the place has no lease. A slow or failed unit read never blocks
 * the page: every lease still lists, reading "Lease rate not published".
 */
export async function loadPlaceLeaseSection(
  tiles: readonly ListingTile[],
): Promise<PlaceLeaseSection | null> {
  const leases = placeLeaseTiles(tiles)
  if (leases.length === 0) return null
  const rateOptions = await withTimeoutFallback(
    getLeaseRateOptions(leases.map((tile) => tile.listingKey)),
    {} as LeaseRateOptionsByKey,
    3000,
    'place:lease-rates',
  )
  return placeLeaseSectionFromTiles(leases, rateOptions)
}
