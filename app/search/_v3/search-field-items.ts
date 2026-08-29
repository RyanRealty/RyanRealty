/**
 * Viewport listing row -> V3FieldItem for the search Field.
 *
 * Same honesty as app/_v3/home-field-items.ts: price, address, and a typed
 * ask. Search is inventory, not a curated photo set, so a photoless row still
 * earns a list line (it is not plotted when lat/lng are missing). Classification
 * is MLS → typeKey / typeLabel / cat. It is not a second Field.
 */

import type { ListingTileRow } from '@/app/actions/listings'
import type { V3FieldItem } from '@/components/site/v3'
import { formatPublishedSaleAsk } from '@/lib/listing/publish-listing-ask'
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

export type SearchFieldTypeKey = (typeof TYPE_ORDER)[number]

export type SearchFieldItem = V3FieldItem & {
  typeKey: SearchFieldTypeKey
  typeLabel: string
  cat: 0 | 1 | 2 | 3 | 4
}

function classifyType(input: {
  propertyType?: string | null
  propertySubType?: string | null
}): { typeKey: SearchFieldTypeKey; typeLabel: string } {
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

function withCats(items: readonly Omit<SearchFieldItem, 'cat'>[]): SearchFieldItem[] {
  const present = TYPE_ORDER.filter((key) => items.some((item) => item.typeKey === key))
  const catByKey = new Map(
    present.map((key, index) => [key, (index % 5) as SearchFieldItem['cat']]),
  )
  return items.map((item) => ({
    ...item,
    cat: catByKey.get(item.typeKey) ?? 0,
  }))
}

function rowSqft(row: ListingTileRow): number | null {
  const v = (row as { TotalLivingAreaSqFt?: number | null }).TotalLivingAreaSqFt
  return v ?? null
}

export function searchFieldItemId(row: ListingTileRow): string {
  return String(row.ListNumber ?? row.ListingKey ?? '').trim()
}

export function searchFieldItems(rows: readonly ListingTileRow[]): SearchFieldItem[] {
  const items: Omit<SearchFieldItem, 'cat'>[] = []

  for (const row of rows) {
    const id = searchFieldItemId(row)
    if (!id) continue

    const priceLabel = formatPublishedSaleAsk({
      price: row.ListPrice,
      propertyType: row.PropertyType,
    })
    if (!priceLabel) continue

    const street = publishStreetLine({
      streetNumber: row.StreetNumber,
      streetName: row.StreetName,
      streetSuffix: row.StreetSuffix,
    })
    if (!street) continue

    const shareKind = publishListingShareKind({
      propertySubType: row.PropertySubType,
      subdivisionName: row.SubdivisionName,
      city: row.City,
      listNumber: row.ListNumber,
    })
    const sqft = rowSqft(row)
    const meta = [
      row.BedroomsTotal != null ? `${row.BedroomsTotal} bd` : null,
      row.BathroomsTotal != null ? `${row.BathroomsTotal} ba` : null,
      sqft != null ? `${sqft.toLocaleString('en-US')} sqft` : null,
      shareKind,
    ]
      .filter((part): part is string => Boolean(part))
      .join(' · ')

    const type = classifyType({
      propertyType: row.PropertyType,
      propertySubType: row.PropertySubType,
    })
    const photo = row.PhotoURL?.trim()

    items.push({
      id,
      href: listingDetailPath(
        id,
        {
          streetNumber: row.StreetNumber,
          streetName: row.StreetName,
          city: row.City,
          state: row.State,
          postalCode: row.PostalCode,
        },
        { city: row.City, subdivision: row.SubdivisionName },
        { mlsNumber: row.ListNumber ?? null },
      ),
      priceLabel,
      title: publishCardAddress({
        streetNumber: row.StreetNumber,
        streetName: row.StreetName,
        streetSuffix: row.StreetSuffix,
        city: row.City,
      }),
      ...(photo ? { photoSrc: photo } : {}),
      ...(meta ? { meta } : {}),
      lat: row.Latitude,
      lng: row.Longitude,
      typeKey: type.typeKey,
      typeLabel: type.typeLabel,
    })
  }

  return withCats(items)
}

export function searchFieldPins(items: readonly SearchFieldItem[]) {
  return items.flatMap((item) =>
    item.lat != null && item.lng != null
      ? [
          {
            id: item.id,
            href: item.href,
            priceLabel: item.priceLabel,
            title: item.title,
            lat: item.lat,
            lng: item.lng,
            cat: item.cat,
          },
        ]
      : [],
  )
}
