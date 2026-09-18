/**
 * On-page place inventory. Four buyer buckets. A type with zero actives
 * is omitted — no empty stub. Listings stay on the place page.
 *
 * Market figures stay on their own traces (SFR leftover / plat inventory).
 * This module only groups the live stock a visitor can open.
 */
import { getListingTiles, type ListingTile } from '@/lib/data'
import type { V3ListingRowData } from '@/components/site/v3/V3ListingRow'
import { formatCount } from '@/lib/format/count'
import { publishStreetLine } from '@/lib/listing/publish-street-line'
import { displaySubdivision, listingTileHref } from '@/lib/slug'
import { placeTypeKey } from '@/lib/place/place-type-style'

export const PLACE_STOCK_SECTION_ORDER = ['sfr', 'multifamily', 'attached', 'land'] as const

export type PlaceStockSectionKey = (typeof PLACE_STOCK_SECTION_ORDER)[number]

export const PLACE_STOCK_HEADINGS: Record<PlaceStockSectionKey, string> = {
  sfr: 'Single-family homes',
  multifamily: 'Multifamily homes',
  attached: 'Townhomes and condos',
  land: 'Land',
}

export type PlaceStockSection = {
  key: PlaceStockSectionKey
  heading: string
  countLabel: string
  rows: V3ListingRowData[]
}

const KEY_TO_SECTION: Record<string, PlaceStockSectionKey> = {
  sfr: 'sfr',
  manufactured_land: 'sfr',
  manufactured_park: 'sfr',
  multifamily_2_4: 'multifamily',
  condo: 'attached',
  townhome: 'attached',
  land: 'land',
  farm: 'land',
}

export function placeStockSectionKey(
  propertyType?: string | null,
  propertySubType?: string | null,
): PlaceStockSectionKey | null {
  const typeKey = placeTypeKey(propertyType, propertySubType)
  return KEY_TO_SECTION[typeKey] ?? null
}

export function unionListingTiles(...groups: ReadonlyArray<readonly ListingTile[]>): ListingTile[] {
  const seen = new Set<string>()
  const out: ListingTile[] = []
  for (const group of groups) {
    for (const tile of group) {
      if (!tile.listingKey || seen.has(tile.listingKey)) continue
      seen.add(tile.listingKey)
      out.push(tile)
    }
  }
  return out
}

export function placeStockRowFromTile(tile: ListingTile): V3ListingRowData | null {
  const street =
    publishStreetLine({
      streetNumber: tile.streetNumber,
      streetDirPrefix: tile.streetDirPrefix,
      streetName: tile.streetName,
      streetSuffix: tile.streetSuffix,
      streetDirSuffix: tile.streetDirSuffix,
    }) ?? tile.listNumber
  if (!street) return null
  if (tile.listPrice == null || !Number.isFinite(tile.listPrice) || tile.listPrice <= 0) return null
  const cityParts = [tile.city, 'OR'].filter(Boolean).join(', ')
  const cityZip = [cityParts, tile.postalCode].filter(Boolean).join(' ').trim()
  const subdivision = displaySubdivision(tile.subdivisionName)
  return {
    listingKey: tile.listingKey,
    href: listingTileHref(tile),
    photoUrl: tile.photoUrl,
    price: tile.listPrice,
    addressLine: street,
    cityLine: subdivision ? `${cityZip} · ${subdivision}` : cityZip || 'Central Oregon',
    beds: tile.beds,
    baths: tile.baths,
    sqft: tile.sqft,
    pricePerSqft: tile.pricePerSqft,
    propertyType: tile.propertyType,
    propertySubType: tile.propertySubType,
    subdivisionName: tile.subdivisionName,
    city: tile.city,
    listNumber: tile.listNumber,
    tourUrl: tile.tourUrl,
    hasTour: tile.hasVirtualTour === true || Boolean(tile.tourUrl),
  }
}

export function placeStockSectionsFromTiles(tiles: readonly ListingTile[]): PlaceStockSection[] {
  const buckets: Record<PlaceStockSectionKey, V3ListingRowData[]> = {
    sfr: [],
    multifamily: [],
    attached: [],
    land: [],
  }
  for (const tile of tiles) {
    const section = placeStockSectionKey(tile.propertyType, tile.propertySubType)
    if (!section) continue
    const row = placeStockRowFromTile(tile)
    if (!row) continue
    buckets[section].push(row)
  }
  return PLACE_STOCK_SECTION_ORDER.flatMap((key) => {
    const rows = buckets[key]
    if (rows.length === 0) return []
    return [
      {
        key,
        heading: PLACE_STOCK_HEADINGS[key],
        countLabel: `${formatCount(rows.length)} for sale`,
        rows,
      },
    ]
  })
}

export async function loadPlaceStockTiles(input: {
  listingKeys?: readonly string[]
  subdivisionNames?: readonly string[]
  city?: string | null
}): Promise<ListingTile[]> {
  const keys = [...new Set((input.listingKeys ?? []).filter(Boolean))].slice(0, 500)
  const names = [...new Set((input.subdivisionNames ?? []).map((n) => n.trim()).filter(Boolean))].slice(
    0,
    40,
  )
  const city = input.city?.trim() || undefined
  const reads: Promise<ListingTile[]>[] = []
  if (keys.length > 0) {
    reads.push(getListingTiles({ listingKeys: keys, status: 'active', limit: 500 }))
  }
  for (const subdivision of names) {
    reads.push(
      getListingTiles({
        subdivision,
        ...(city ? { city } : {}),
        status: 'active',
        limit: 500,
      }),
    )
  }
  if (reads.length === 0) return []
  const pages = await Promise.all(reads)
  return unionListingTiles(...pages)
}
