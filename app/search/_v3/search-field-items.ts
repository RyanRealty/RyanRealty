/**
 * Search listings -> V3FieldItem. Same honesty as city/homepage Field
 * mappers: price and street earn a row; photo and coordinates are optional.
 * Type key/label/cat ride the item so Field lead chips and navy-alpha pins
 * share one mark. Dedup is here so 8450 1st Street cannot print twice.
 */

import type { ListingTileRow } from '@/app/actions/listings'
import type { V3FieldItem } from '@/components/site/v3'
import { formatPublishedAsk } from '@/lib/listing/publish-listing-ask'
import { publishListingShareKind } from '@/lib/listing/publish-listing-share'
import { publishCardAddress, publishStreetLine } from '@/lib/listing/publish-street-line'
import { listingDetailPath, listingTileHref } from '@/lib/slug'

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
  listingKey: string
  listNumber: string | null
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

function rowIdentity(row: ListingTileRow): string[] {
  const key = (row.ListingKey ?? '').trim()
  const mls = (row.ListNumber ?? '').trim()
  const street = publishStreetLine({
    streetNumber: row.StreetNumber,
    streetName: row.StreetName,
    streetSuffix: row.StreetSuffix,
  })
  const city = (row.City ?? '').trim().toLowerCase()
  const price = row.ListPrice != null && Number.isFinite(row.ListPrice) ? String(row.ListPrice) : ''
  const address = street ? `${street.toLowerCase()}|${city}|${price}` : ''
  return [key && `k:${key}`, mls && `m:${mls}`, address && `a:${address}`].filter(Boolean)
}

/** One row per listing. Same address + ask collapses a duplicate feed row. */
export function dedupeListingRows<T extends ListingTileRow>(rows: readonly T[]): T[] {
  const seen = new Set<string>()
  const out: T[] = []
  for (const row of rows) {
    const marks = rowIdentity(row)
    if (marks.length === 0) continue
    if (marks.some((mark) => seen.has(mark))) continue
    for (const mark of marks) seen.add(mark)
    out.push(row)
  }
  return out
}

export function searchFieldItems(rows: readonly ListingTileRow[]): SearchFieldItem[] {
  const items: Omit<SearchFieldItem, 'cat'>[] = []

  for (const row of dedupeListingRows(rows)) {
    if (row.ListPrice == null || !Number.isFinite(row.ListPrice) || row.ListPrice <= 0) continue
    const street = publishStreetLine({
      streetNumber: row.StreetNumber,
      streetName: row.StreetName,
      streetSuffix: row.StreetSuffix,
    })
    if (!street) continue

    const listingKey = (row.ListingKey ?? row.ListNumber ?? '').toString().trim()
    if (!listingKey) continue

    const shareKind = publishListingShareKind({
      propertySubType: row.PropertySubType,
      subdivisionName: row.SubdivisionName,
      city: row.City,
      listNumber: row.ListNumber ?? null,
    })
    const sqft = row.TotalLivingAreaSqFt
    const meta = [
      row.BedroomsTotal != null ? `${row.BedroomsTotal} bd` : null,
      row.BathroomsTotal != null ? `${row.BathroomsTotal} ba` : null,
      sqft != null ? `${Math.round(sqft).toLocaleString('en-US')} sqft` : null,
      shareKind,
    ]
      .filter((part): part is string => Boolean(part))
      .join(' · ')

    const type = classifyType({
      propertyType: row.PropertyType,
      propertySubType: row.PropertySubType,
    })
    const photo = row.PhotoURL?.trim()
    const href =
      listingTileHref({
        listingKey: row.ListingKey,
        listNumber: row.ListNumber,
        streetNumber: row.StreetNumber,
        streetName: row.StreetName,
        city: row.City,
        subdivisionName: row.SubdivisionName,
      }) ||
      listingDetailPath(
        listingKey,
        { streetNumber: row.StreetNumber, streetName: row.StreetName, city: row.City },
        { city: row.City, subdivision: row.SubdivisionName },
        { mlsNumber: row.ListNumber ?? null },
      )

    items.push({
      id: listingKey,
      listingKey,
      listNumber: row.ListNumber ?? null,
      href,
      priceLabel: formatPublishedAsk(row.ListPrice) ?? 'Price on request',
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
