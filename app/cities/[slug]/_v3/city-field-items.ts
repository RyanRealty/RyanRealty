/**
 * Tile -> V3FieldItem, for the city node's inventory Field.
 *
 * The barrel formats nothing (components/site/v3/index.ts: "no primitive here
 * fetches, formats, rounds, or parses a date"), so the price string and the
 * supporting line are built here, through lib/format, and handed over finished.
 * That is what keeps the figure on screen the figure the Field's source trace
 * covers (CLAUDE.md section 0).
 *
 * Type key/label/cat ride the Field item so lead chips and pins share one mark.
 * Classification is MLS → those three fields. It is not a second Field.
 *
 * The destination is `listingDetailPath`, the same canonical helper the retired
 * dual-pane list used, so a row still opens the listing at the same URL.
 */

import type { V3FieldItem } from '@/components/site/v3'
import type { ListingTile } from '@/lib/data/types/listing'
import { formatPublishedAsk } from '@/lib/listing/publish-listing-ask'
import { publishListingShareKind } from '@/lib/listing/publish-listing-share'
import { publishCardAddress, publishStreetLine } from '@/lib/listing/publish-street-line'
import { listingDetailPath } from '@/lib/slug'

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

export type CityFieldTypeKey = (typeof TYPE_ORDER)[number]

export type CityFieldItem = V3FieldItem & {
  typeKey: CityFieldTypeKey
  typeLabel: string
  cat: 0 | 1 | 2 | 3 | 4
}

function classifyType(input: {
  propertyType?: string | null
  propertySubType?: string | null
}): { typeKey: CityFieldTypeKey; typeLabel: string } {
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

function withCats(items: readonly Omit<CityFieldItem, 'cat'>[]): CityFieldItem[] {
  const present = TYPE_ORDER.filter((key) => items.some((item) => item.typeKey === key))
  const catByKey = new Map(
    present.map((key, index) => [key, (index % 5) as CityFieldItem['cat']]),
  )
  return items.map((item) => ({
    ...item,
    cat: catByKey.get(item.typeKey) ?? 0,
  }))
}

/**
 * A tile earns a row when it carries a price and an address. Both are the row's
 * visible text: `priceLabel` is the figure and `title` is what the row is known
 * by, and V3FieldItem types neither as optional. A tile with no list price would
 * render a lone em dash standing where a figure
 * should be; a tile with no street would render an anonymous row. Dropping is
 * the honest answer to both, and the Field's count above the frame still states
 * the real total from its own query.
 *
 * A photograph is optional. The city opening is one Field (map + list of the
 * same set). A home with no photo is still listed and, when it has coordinates,
 * plotted. Dropping it to force a mosaic would make the caption count a
 * different population from the pins.
 */
export function cityFieldItems(tiles: readonly ListingTile[], limit?: number): CityFieldItem[] {
  const items: Omit<CityFieldItem, 'cat'>[] = []
  const cap = limit ?? Number.POSITIVE_INFINITY

  for (const tile of tiles) {
    if (items.length >= cap) break
    if (tile.listPrice == null || !Number.isFinite(tile.listPrice) || tile.listPrice <= 0) continue

    const street = publishStreetLine({
      streetNumber: tile.streetNumber,
      streetName: tile.streetName,
      streetSuffix: tile.streetSuffix,
    })
    if (!street) continue

    // A fractional ask never prints unlabeled: the share label rides the meta
    // line beside the price (the Camp Sherman quarter-share rule, carried from
    // the retired dual-pane list).
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

    const photo = tile.photoUrl?.trim()
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
      // Every card names its city (Matt 2026-08-27): cards travel — open
      // houses, trails, price drops, saved-search alerts — so a bare street
      // line made the reader guess. Applied on the city Field too, even
      // though the page is already city-scoped: consistency beats brevity.
      title:
        publishCardAddress({
          streetNumber: tile.streetNumber,
          streetName: tile.streetName,
          streetSuffix: tile.streetSuffix,
          city: tile.city,
        }) || street,
      ...(photo ? { photoSrc: photo } : {}),
      ...(meta ? { meta } : {}),
      lat: tile.lat,
      lng: tile.lng,
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
export function cityFieldPool(tiles: readonly ListingTile[], limit: number): CityFieldItem[] {
  const all = cityFieldItems(tiles)
  const keys = TYPE_ORDER.filter((key) => all.some((item) => item.typeKey === key))
  const buckets = new Map<string, CityFieldItem[]>()
  for (const key of keys) buckets.set(key, [])
  for (const item of all) buckets.get(item.typeKey)?.push(item)

  const out: CityFieldItem[] = []
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
