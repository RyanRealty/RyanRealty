/**
 * Place-type page class: one type in one place.
 * Leftover / segment figures back the face. Photographed listings are a
 * separate set. Miss omits. Do not invent a count from list length.
 */
import type { AtlasDot, AtlasPopulation, V3ListingRowData } from '@/components/site/v3'
import type { ListingTile } from '@/lib/data/types/listing'
import { formatMonthsOfSupply } from '@/lib/format/months-of-supply'
import { formatPriceExact } from '@/lib/format/money'
import { publishStreetLine } from '@/lib/listing/publish-street-line'
import type { PlaceFaceStat } from '@/lib/market/publish-place-face'
import {
  PLACE_TYPE_COVER_SPECS,
  PLACE_TYPE_SEARCH_PRESET,
  placeTypeKeyFromPageSlug,
} from '@/lib/place/publish-place-type-cards'
import type { PlaceTypeKey } from '@/lib/place/place-type-style'
import type { SchemaInput } from '@/lib/site/json-ld'
import { displaySubdivision, listingDetailPath } from '@/lib/slug'

export type PlaceTypePageSpec = {
  key: PlaceTypeKey
  slug: string
  h1Type: string
  nounOne: string
  nounMany: string
  listingFilter: { propertyType?: string; propertySubType?: string }
  /** AtlasDot.t when the leftover type is 1:1 with classifyType. */
  atlasDotType: string | null
}

const H1_TYPE: Record<PlaceTypeKey, string> = {
  sfr: 'Single-family',
  condo: 'Condos',
  townhome: 'Townhomes',
  manufactured_land: 'Manufactured homes on land',
  manufactured_park: 'Manufactured homes in parks',
  multifamily_2_4: '2-4 unit buildings',
  land: 'Lots',
  farm: 'Farms',
  commercial_sale: 'Commercial properties',
  business: 'Businesses',
}

const NOUN: Record<PlaceTypeKey, { one: string; many: string }> = {
  sfr: { one: 'single-family home', many: 'single-family homes' },
  condo: { one: 'condo', many: 'condos' },
  townhome: { one: 'townhome', many: 'townhomes' },
  manufactured_land: { one: 'manufactured home on land', many: 'manufactured homes on land' },
  manufactured_park: { one: 'manufactured home in a park', many: 'manufactured homes in parks' },
  multifamily_2_4: { one: '2-4 unit building', many: '2-4 unit buildings' },
  land: { one: 'lot', many: 'lots' },
  farm: { one: 'farm', many: 'farms' },
  commercial_sale: { one: 'commercial property', many: 'commercial properties' },
  business: { one: 'business', many: 'businesses' },
}

/** 1:1 leftover type → AtlasDot.t. Mixed atlas buckets stay null. */
const ATLAS_DOT_TYPE: Partial<Record<PlaceTypeKey, string>> = {
  sfr: 'house',
  condo: 'condo',
  townhome: 'townhouse',
  multifamily_2_4: 'multi',
}

const COVER_FILTER = new Map(
  PLACE_TYPE_COVER_SPECS.map((row) => [
    row.key,
    {
      ...(row.propertyType ? { propertyType: row.propertyType } : {}),
      ...(row.propertySubType ? { propertySubType: row.propertySubType } : {}),
    },
  ]),
)

export function resolvePlaceTypePage(typeSlug: string): PlaceTypePageSpec | null {
  const key = placeTypeKeyFromPageSlug(typeSlug)
  if (!key) return null
  const slug = PLACE_TYPE_SEARCH_PRESET[key]
  if (!slug) return null
  return {
    key,
    slug,
    h1Type: H1_TYPE[key],
    nounOne: NOUN[key].one,
    nounMany: NOUN[key].many,
    listingFilter: COVER_FILTER.get(key) ?? {},
    atlasDotType: ATLAS_DOT_TYPE[key] ?? null,
  }
}

export function placeTypeHeadline(spec: PlaceTypePageSpec, placeName: string): string {
  return `${spec.h1Type} in ${placeName}`
}

export function placeTypeFaceStats(input: {
  spec: PlaceTypePageSpec
  count: number | null
  median: number | null
  mos: number | null
}): PlaceFaceStat[] {
  const stats: PlaceFaceStat[] = []
  if (input.count != null && Number.isFinite(input.count) && input.count >= 0) {
    const n = Math.floor(input.count)
    stats.push({
      id: 'active',
      value: n.toLocaleString('en-US'),
      label: n === 1 ? `${input.spec.nounOne} for sale` : `${input.spec.nounMany} for sale`,
    })
  }
  if (input.median != null && Number.isFinite(input.median) && input.median > 0) {
    stats.push({
      id: 'medianList',
      value: formatPriceExact(input.median),
      label: 'median list',
    })
  }
  if (input.mos != null && Number.isFinite(input.mos) && input.mos > 0) {
    stats.push({
      id: 'monthsOfSupply',
      value: formatMonthsOfSupply(input.mos),
      label: 'months of supply',
    })
  }
  return stats
}

export function filterAtlasDotsToType(
  dots: readonly AtlasDot[],
  atlasDotType: string | null,
): readonly AtlasDot[] | null {
  if (!atlasDotType) return null
  return dots.filter((dot) => dot.t === atlasDotType)
}

export function atlasViewForType(
  atlas: AtlasPopulation,
  atlasDotType: string | null,
): { dots: readonly AtlasDot[]; types: AtlasPopulation['types'] } {
  const filtered = filterAtlasDotsToType(atlas.dots, atlasDotType)
  if (!filtered || filtered.length === 0) {
    return { dots: atlas.dots, types: atlas.types }
  }
  const present = new Set(filtered.filter((dot) => dot.s !== 'sold').map((dot) => dot.t))
  const types = atlas.types.filter((row) => present.has(row.key))
  return { dots: filtered, types: types.length > 0 ? types : atlas.types }
}

export function placeTypeListingRows(tiles: readonly ListingTile[]): V3ListingRowData[] {
  const rows: V3ListingRowData[] = []
  for (const tile of tiles) {
    const photo = tile.photoUrl?.trim()
    if (!photo) continue
    if (tile.listPrice == null || !Number.isFinite(tile.listPrice) || tile.listPrice <= 0) continue
    if (!tile.streetName?.trim()) continue
    const street = publishStreetLine({
      streetNumber: tile.streetNumber,
      streetName: tile.streetName,
      streetSuffix: tile.streetSuffix,
    })
    if (!street) continue
    const cityParts = [tile.city, 'OR'].filter(Boolean).join(', ')
    const cityZip = [cityParts, tile.postalCode].filter(Boolean).join(' ').trim()
    const subdivision = displaySubdivision(tile.subdivisionName)
    rows.push({
      listingKey: tile.listingKey,
      href: listingDetailPath(
        tile.listingKey,
        { streetNumber: tile.streetNumber, streetName: tile.streetName, city: tile.city },
        { city: tile.city, subdivision: tile.subdivisionName },
        { mlsNumber: tile.listNumber },
      ),
      photoUrl: photo,
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
    })
  }
  return rows
}

export function placeTypeMetadataCopy(input: {
  spec: PlaceTypePageSpec
  placeName: string
  count: number | null
}): { title: string; description: string } {
  const title = `${input.spec.h1Type} in ${input.placeName}, Oregon`
  const noun =
    input.count === 1 ? input.spec.nounOne : input.spec.nounMany
  const description =
    input.count != null && input.count > 0
      ? `${input.count.toLocaleString('en-US')} ${noun} for sale in ${input.placeName}, Oregon. Live list prices from the regional MLS.`
      : `${input.spec.h1Type} for sale in ${input.placeName}, Oregon. Live list prices from the regional MLS.`
  return { title, description }
}

export function placeTypeSchemas(input: {
  spec: PlaceTypePageSpec
  placeName: string
  placeHref: string
  pagePath: string
  description: string
  listings: ReadonlyArray<{ addressLine: string; href: string }>
  /** Visible breadcrumb parent. City grain uses the city. Community uses the city too. */
  breadcrumbName?: string
  breadcrumbHref?: string
}): SchemaInput[] {
  const typeName = input.spec.h1Type
  const crumbName = input.breadcrumbName ?? input.placeName
  const crumbHref = input.breadcrumbHref ?? input.placeHref
  const schemas: SchemaInput[] = [
    {
      type: 'breadcrumb',
      items: [
        { name: crumbName, url: crumbHref },
        { name: typeName, url: input.pagePath },
      ],
    },
    {
      type: 'webPage',
      name: `${typeName} in ${input.placeName}`,
      description: input.description,
      url: input.pagePath,
    },
  ]
  if (input.listings.length > 0) {
    schemas.push({
      type: 'itemList',
      name: `${typeName} in ${input.placeName}`,
      items: input.listings.map((row) => ({ name: row.addressLine, url: row.href })),
    })
  }
  return schemas
}

/** Polygon / MultiPolygon, or a Feature wrapping one. Miss is null. */
export function asPlaceBoundary(value: unknown): GeoJSON.Geometry | null {
  if (!value || typeof value !== 'object') return null
  const rec = value as {
    type?: string
    coordinates?: unknown
    geometry?: { type?: string; coordinates?: unknown }
  }
  if ((rec.type === 'Polygon' || rec.type === 'MultiPolygon') && Array.isArray(rec.coordinates)) {
    return rec as GeoJSON.Geometry
  }
  const geom = rec.geometry
  if (geom && (geom.type === 'Polygon' || geom.type === 'MultiPolygon') && Array.isArray(geom.coordinates)) {
    return geom as GeoJSON.Geometry
  }
  return null
}
