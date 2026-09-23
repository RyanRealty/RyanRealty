/**
 * On-page place inventory. One section per buyer bucket: houses,
 * multi-family, townhomes and condos, land, and commercial (Matt 2026-09-23:
 * "carousels of all available property types ... we haven't been doing
 * commercial and multi family"). A type with zero actives is omitted — no
 * empty stub. Listings stay on the place page.
 *
 * Market figures stay on their own traces (SFR leftover / plat inventory).
 * This module only groups the live stock a visitor can open.
 */
import {
  getBoundaryOnMarketKeys,
  type PlaceBoundaryGeoType,
} from '@/lib/data/geo/place-on-market-stock'
import { getListingTiles, type ListingTile } from '@/lib/data'
import type { V3ListingRowData } from '@/components/site/v3/V3ListingRow'
import { formatCount } from '@/lib/format/count'
import { publishStreetLine } from '@/lib/listing/publish-street-line'
import { displaySubdivision, listingTileHref } from '@/lib/slug'
import { placeTypeKey } from '@/lib/place/place-type-style'
import { listingPriceIsLeaseRate } from '@/lib/listing/publish-listing-figure'

export const PLACE_STOCK_SECTION_ORDER = ['sfr', 'multifamily', 'attached', 'land', 'commercial'] as const

export type PlaceStockSectionKey = (typeof PLACE_STOCK_SECTION_ORDER)[number] | 'other'

export const PLACE_STOCK_HEADINGS: Record<PlaceStockSectionKey, string> = {
  sfr: 'Single-family homes',
  multifamily: 'Multifamily homes',
  attached: 'Townhomes and condos',
  land: 'Land',
  commercial: 'Commercial property',
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
  // MLS F (commercial sale) and H (business opportunity) used to fall to
  // "Other property", which no buyer reads as commercial.
  commercial_sale: 'commercial',
  business: 'commercial',
}

/**
 * False for a commercial lease (MLS PropertyType 'G', "Commercial Lease" in
 * the feed's own label): its ListPrice is rent, and a lease is not for sale.
 * placeTypeKey has no key for 'G' and falls to 'sfr', which printed three
 * 671 Greenwood Avenue leases as "Single-family homes ... for sale" on
 * /subdivisions/center-addition-to-bend (2026-09-23). Every for-sale count
 * and carousel built here asks this first.
 */
export function placeStockIsForSale(propertyType?: string | null): boolean {
  return !listingPriceIsLeaseRate(propertyType)
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

/** 'Pending' for an under-contract listing, the word the rails print; else null. */
export function placeStockStatusLabel(status: ListingTile['status']): string | null {
  const t = String(status ?? '').toLowerCase()
  if (t.includes('pending') || t.includes('under contract')) return 'Pending'
  return null
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
    statusLabel: placeStockStatusLabel(tile.status),
  }
}

export function placeStockSectionsFromTiles(tiles: readonly ListingTile[]): PlaceStockSection[] {
  const buckets: Record<PlaceStockSectionKey, V3ListingRowData[]> = {
    sfr: [],
    multifamily: [],
    attached: [],
    land: [],
    commercial: [],
    other: [],
  }
  for (const tile of tiles) {
    if (!placeStockIsForSale(tile.propertyType)) continue
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
  boundary?: { geoType: PlaceBoundaryGeoType; geoSlug: string } | null
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
