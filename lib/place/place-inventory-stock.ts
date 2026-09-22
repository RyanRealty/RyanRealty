/**
 * On-page place inventory. Four buyer buckets. A type with zero actives
 * is omitted — no empty stub. Listings stay on the place page.
 *
 * Market figures stay on their own traces (SFR leftover / plat inventory).
 * This module only groups the live stock a visitor can open.
 */
import { getBoundaryOnMarketKeys } from '@/lib/data/geo/place-on-market-stock'
import { getListingTiles, type ListingTile } from '@/lib/data'
import type { V3ListingRowData } from '@/components/site/v3/V3ListingRow'
import { formatCount } from '@/lib/format/count'
import { publishStreetLine } from '@/lib/listing/publish-street-line'
import { displaySubdivision, listingTileHref } from '@/lib/slug'
import { placeTypeKey } from '@/lib/place/place-type-style'

export const PLACE_STOCK_SECTION_ORDER = ['sfr', 'multifamily', 'attached', 'land'] as const

export type PlaceStockSectionKey = (typeof PLACE_STOCK_SECTION_ORDER)[number] | 'other'

export const PLACE_STOCK_HEADINGS: Record<PlaceStockSectionKey, string> = {
  sfr: 'Single-family homes',
  multifamily: 'Multifamily homes',
  attached: 'Townhomes and condos',
  land: 'Land',
  other: 'Other property',
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
  const price =
    tile.listPrice != null && Number.isFinite(tile.listPrice) && tile.listPrice > 0
      ? tile.listPrice
      : null
  const cityParts = [tile.city, 'OR'].filter(Boolean).join(', ')
  const cityZip = [cityParts, tile.postalCode].filter(Boolean).join(' ').trim()
  const subdivision = displaySubdivision(tile.subdivisionName)
  return {
    listingKey: tile.listingKey,
    href: listingTileHref(tile),
    photoUrl: tile.photoUrl,
    price,
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
    other: [],
  }
  for (const tile of tiles) {
    const section = placeStockSectionKey(tile.propertyType, tile.propertySubType) ?? 'other'
    const row = placeStockRowFromTile(tile)
    if (!row) continue
    buckets[section].push(row)
  }
  const ordered: PlaceStockSectionKey[] = [...PLACE_STOCK_SECTION_ORDER, 'other']
  return ordered.flatMap((key) => {
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

const TILE_PAGE = 1000
const TILE_CEILING = 8000

async function tilesForKeys(keys: readonly string[]): Promise<ListingTile[]> {
  const unique = [...new Set(keys.filter(Boolean))]
  if (unique.length === 0) return []
  const out: ListingTile[] = []
  for (let i = 0; i < unique.length && out.length < TILE_CEILING; i += TILE_PAGE) {
    const chunk = unique.slice(i, i + TILE_PAGE)
    const page = await getListingTiles({
      listingKeys: chunk,
      status: 'active',
      limit: chunk.length,
    })
    out.push(...page)
  }
  return out
}

async function tilesForSubdivisionName(subdivision: string, city: string | undefined): Promise<ListingTile[]> {
  const out: ListingTile[] = []
  for (let offset = 0; offset < TILE_CEILING; offset += TILE_PAGE) {
    const page = await getListingTiles({
      subdivision,
      ...(city ? { city } : {}),
      status: 'active',
      limit: TILE_PAGE,
      offset,
    })
    out.push(...page)
    if (page.length < TILE_PAGE) break
  }
  return out
}

export async function loadPlaceStockTiles(input: {
  listingKeys?: readonly string[]
  subdivisionNames?: readonly string[]
  city?: string | null
  /** Recorded boundary. Every publicly active listing inside it, every type. */
  boundary?: { geoType: 'subdivision' | 'neighborhood'; geoSlug: string } | null
}): Promise<ListingTile[]> {
  const boundaryKeys = input.boundary
    ? await getBoundaryOnMarketKeys(input.boundary.geoType, input.boundary.geoSlug)
    : []
  const keys = [...new Set([...(input.listingKeys ?? []), ...boundaryKeys].filter(Boolean))]
  const names = [...new Set((input.subdivisionNames ?? []).map((n) => n.trim()).filter(Boolean))]
  const city = input.city?.trim() || undefined
  const reads: Promise<ListingTile[]>[] = []
  if (keys.length > 0) reads.push(tilesForKeys(keys))
  for (const subdivision of names) {
    reads.push(tilesForSubdivisionName(subdivision, city))
  }
  if (reads.length === 0) return []
  const pages = await Promise.all(reads)
  return unionListingTiles(...pages)
}
