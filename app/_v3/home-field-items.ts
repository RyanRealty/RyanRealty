/**
 * Tile -> V3FieldItem for the homepage inventory Field.
 *
 * Same honesty as app/cities/[slug]/_v3/city-field-items.ts: a tile earns a row
 * when it carries a price, an address, and a live MLS photograph (the curated
 * homepage set is photography-first, so dropping a photoless tile never
 * invents a door). The ask goes through formatPublishedAsk and
 * a fractional ask never prints unlabeled: publishListingShareKind rides the
 * meta line (the Camp Sherman quarter-share rule). The meta line also names the
 * town, because this list spans the whole region.
 *
 * Type key/label/cat ride the Field item so lead chips and pins share one mark.
 * Classification is MLS → those three fields. It is not a second Field.
 */

import type { V3FieldItem } from '@/components/site/v3'
import type { ListingTile } from '@/lib/data/types/listing'
import { formatPublishedAsk } from '@/lib/listing/publish-listing-ask'
import { publishListingShareKind } from '@/lib/listing/publish-listing-share'
import { publishCardAddress, publishStreetLine } from '@/lib/listing/publish-street-line'
import { listingDetailPath } from '@/lib/slug'

export type HomeFieldItem = V3FieldItem & {
  city: string
  typeKey: string
  typeLabel: string
  cat: 0 | 1 | 2 | 3 | 4
}

const TYPE_ORDER = [
  'house',
  'condo',
  'townhouse',
  'manufactured',
  'multi',
  'land',
  'commercial',
  'other',
] as const

function classifyType(input: {
  propertyType?: string | null
  propertySubType?: string | null
}): { typeKey: string; typeLabel: string } {
  const sub = (input.propertySubType ?? '').trim()
  const cls = (input.propertyType ?? '').trim().toUpperCase()

  switch (sub) {
    case 'Single Family Residence':
    case 'Tenancy in Common':
    case 'Residential Leased Land':
    case 'Stock Cooperative':
    case 'Timeshare':
      return { typeKey: 'house', typeLabel: 'House' }
    case 'Condominium':
      return { typeKey: 'condo', typeLabel: 'Condo' }
    case 'Townhouse':
      return { typeKey: 'townhouse', typeLabel: 'Townhouse' }
    case 'Manufactured On Land':
    case 'In Park':
    case 'On Leased Land':
      return { typeKey: 'manufactured', typeLabel: 'Manufactured' }
    case 'Duplex':
    case 'Triplex':
    case 'Quadruplex':
    case 'Multi Family':
      return { typeKey: 'multi', typeLabel: 'Multi-family' }
    case 'Residential Lots':
    case 'Recreational':
    case 'Agriculture':
    case 'Rangeland':
    case 'Investment':
    case 'Industrial':
      return { typeKey: 'land', typeLabel: 'Land' }
    default:
      break
  }

  if (cls === 'D' || cls === 'E') return { typeKey: 'land', typeLabel: 'Land' }
  if (cls === 'C') return { typeKey: 'multi', typeLabel: 'Multi-family' }
  if (cls === 'B') return { typeKey: 'manufactured', typeLabel: 'Manufactured' }
  if (cls === 'F' || cls === 'G' || cls === 'H') {
    return { typeKey: 'commercial', typeLabel: 'Commercial' }
  }
  return { typeKey: 'house', typeLabel: 'House' }
}

function withCats(items: readonly Omit<HomeFieldItem, 'cat'>[]): HomeFieldItem[] {
  const present = TYPE_ORDER.filter((key) => items.some((item) => item.typeKey === key))
  const catByKey = new Map(
    present.map((key, index) => [key, (index % 5) as HomeFieldItem['cat']]),
  )
  return items.map((item) => ({
    ...item,
    cat: catByKey.get(item.typeKey) ?? 0,
  }))
}

export function filterHomeFieldByCity(
  items: readonly HomeFieldItem[],
  city: string | null,
): HomeFieldItem[] {
  if (!city) return [...items]
  const needle = city.trim().toLowerCase()
  if (!needle) return [...items]
  return items.filter((item) => item.city.trim().toLowerCase() === needle)
}

export function homeFieldItems(tiles: readonly ListingTile[], limit: number): HomeFieldItem[] {
  const items: Omit<HomeFieldItem, 'cat'>[] = []

  for (const tile of tiles) {
    if (items.length >= limit) break
    if (tile.listPrice == null || !Number.isFinite(tile.listPrice) || tile.listPrice <= 0) continue

    const street = publishStreetLine({
      streetNumber: tile.streetNumber,
      streetName: tile.streetName,
      streetSuffix: tile.streetSuffix,
    })
    if (!street) continue
    if (!tile.photoUrl || tile.photoUrl.trim().length === 0) continue

    const shareKind = publishListingShareKind({
      propertySubType: tile.propertySubType,
      subdivisionName: tile.subdivisionName,
      city: tile.city,
      listNumber: tile.listNumber,
    })
    const meta = [
      tile.beds != null ? `${tile.beds} bd` : null,
      tile.baths != null ? `${tile.baths} ba` : null,
      tile.sqft != null ? `${tile.sqft.toLocaleString('en-US')} sqft` : null,
      shareKind,
    ]
      .filter((part): part is string => Boolean(part))
      .join(' · ')

    const type = classifyType({
      propertyType: tile.propertyType,
      propertySubType: tile.propertySubType,
    })

    items.push({
      id: tile.listingKey,
      href: listingDetailPath(
        tile.listingKey,
        { streetNumber: tile.streetNumber, streetName: tile.streetName, city: tile.city },
        { city: tile.city, subdivision: tile.subdivisionName },
        { mlsNumber: tile.listNumber },
      ),
      priceLabel: formatPublishedAsk(tile.listPrice) ?? 'Price on request',
      title: publishCardAddress({
        streetNumber: tile.streetNumber,
        streetName: tile.streetName,
        streetSuffix: tile.streetSuffix,
        city: tile.city,
      }),
      photoSrc: tile.photoUrl,
      ...(meta ? { meta } : {}),
      lat: tile.lat,
      lng: tile.lng,
      city: tile.city?.trim() ?? '',
      typeKey: type.typeKey,
      typeLabel: type.typeLabel,
    })
  }

  return withCats(items)
}

/**
 * One of each type first so a house-heavy feed cannot hide a lot. Types that
 * do not exist never reach a chip.
 */
export function homeFieldPool(tiles: readonly ListingTile[], limit: number): HomeFieldItem[] {
  const all = homeFieldItems(tiles, Number.POSITIVE_INFINITY)
  const keys = TYPE_ORDER.filter((key) => all.some((item) => item.typeKey === key))
  const buckets = new Map<string, HomeFieldItem[]>()
  for (const key of keys) buckets.set(key, [])
  for (const item of all) buckets.get(item.typeKey)?.push(item)

  const out: HomeFieldItem[] = []
  let depth = 0
  while (out.length < limit) {
    let added = false
    for (const key of keys) {
      const next = buckets.get(key)?.[depth]
      if (!next) continue
      out.push(next)
      added = true
      if (out.length >= limit) break
    }
    if (!added) break
    depth += 1
  }
  return out
}
